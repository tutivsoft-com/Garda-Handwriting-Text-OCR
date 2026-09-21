import { Editor, Notice, Plugin, TFile, TFolder, type Menu } from "obsidian";
import { openCheckout, retryPendingSpendEvents, spendPage, syncBalance } from "./billing";
import { combinePages, poll, stableHash, submit, SUPPORTED_EXTENSIONS } from "./ocr";
import { DEFAULT_SETTINGS } from "./settings";
import { GardaSettingTab } from "./settings-tab";
import type { GardaJobResult, GardaSettings } from "./types";
import { PluginSupport } from "./plugin-support";

type GardaAction = "clipboard" | "append" | "replace" | "new-note";
type EditorPosition = { line: number; ch: number };
type EmbedTarget = { file: TFile; editor: Editor; from: EditorPosition; to: EditorPosition; text: string };

/** Coordinates Garda's setup, single-file OCR, and folder-batch workflows. */
export default class GardaPlugin extends Plugin {
  declare settings: GardaSettings;
  support!: PluginSupport;
  private abortController: AbortController | null = null;
  private activeOperation: "single" | "batch" | null = null;
  private batchCancelRequested = false;
  private progressNotice: Notice | null = null;

  /** Register commands and menus, then load settings without starting a scan. */
  async onload(): Promise<void> {
    this.support = new PluginSupport(this, { name: "Garda Handwriting Text OCR", summary: "Extract text from supported images and PDFs into your notes.", quickStart: ["Sign in to billing in Settings.", "Open or select a supported attachment.", "Choose an OCR destination command."], commands: ["Extract to clipboard", "Append to current note", "Batch extract folder"], troubleshooting: ["Use Copy debug log before reporting a problem.", "Check the attachment type and active billing balance."] });
    this.support.start();
    const stored = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored, { cache: { ...DEFAULT_SETTINGS.cache, ...(stored?.cache ?? {}) } });
    if (!this.settings.constanceDeviceId) { const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes); this.settings.constanceDeviceId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""); await this.saveSettings(); }
    this.settings.billingAccessToken = typeof this.settings.billingAccessToken === "string" ? this.settings.billingAccessToken : "";
    this.settings.billingRefreshToken = typeof this.settings.billingRefreshToken === "string" ? this.settings.billingRefreshToken : "";
    this.settings.billingAccountLinked = this.settings.billingAccountLinked === true && Boolean(this.settings.billingAccessToken);
    this.settings.pendingSpendEvents = Array.isArray(this.settings.pendingSpendEvents) ? this.settings.pendingSpendEvents.filter((item) => item && typeof item.eventId === "string" && Number.isInteger(item.amount) && item.amount > 0) : [];
    await this.saveSettings();
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => { if (file instanceof TFile && this.isSupported(file)) this.addFileActions(menu, file); if (file instanceof TFolder) this.addFolderAction(menu, file); }));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => { const target = this.embedAtCursor(editor); if (target) this.addEditorActions(menu, target); }));
    this.addCommand({ id: "extract-to-clipboard", name: "Garda: Extract handwriting to clipboard", callback: () => { void this.runActive("clipboard"); } });
    this.addCommand({ id: "append-to-current-note", name: "Garda: Append handwriting to current note", callback: () => { void this.runActive("append"); } });
    this.addCommand({ id: "replace-embed-with-text", name: "Garda: Replace handwriting embed with text", callback: () => { void this.runActive("replace"); } });
    this.addCommand({ id: "extract-to-new-note", name: "Garda: Extract handwriting to new note", callback: () => { void this.runActive("new-note"); } });
    this.addCommand({ id: "batch-extract-folder", name: "Garda: Batch extract folder", callback: () => { const folder = this.app.workspace.getActiveFile()?.parent; if (folder) void this.runFolder(folder); } });
    this.addCommand({ id: "cancel-active-operation", name: "Garda: Cancel active OCR or batch", callback: () => this.cancelActiveOperation() });
    this.addSettingTab(new GardaSettingTab(this.app, this));
    void syncBalance(this).then(() => retryPendingSpendEvents(this));
  }

  onunload(): void { this.abortController?.abort(); this.progressNotice?.hide(); }

  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
  private isSupported(file: TFile): boolean { return SUPPORTED_EXTENSIONS.has(file.extension.toLowerCase()); }
  private embedAtCursor(editor: Editor | null | undefined): EmbedTarget | null {
    if (!editor) return null;
    const source = this.app.workspace.getActiveFile();
    if (!source) return null;
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const embeds = /!\[[^\]]*\]\(([^)]+)\)|!\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = embeds.exec(line))) {
      const start = match.index;
      const end = start + match[0].length;
      if (cursor.ch < start || cursor.ch > end) continue;
      const linkpath = (match[1] ?? match[2] ?? "").trim().replace(/^<|>$/g, "").split("|")[0].split("#")[0].split("?")[0].trim();
      if (!linkpath) return null;
      let decodedLinkpath: string;
      try { decodedLinkpath = decodeURIComponent(linkpath); } catch { return null; }
      const file = this.app.metadataCache.getFirstLinkpathDest(decodedLinkpath, source.path);
      if (!(file instanceof TFile) || !this.isSupported(file)) return null;
      return { file, editor, from: { line: cursor.line, ch: start }, to: { line: cursor.line, ch: end }, text: match[0] };
    }
    return null;
  }
  private addFileActions(menu: Menu, file: TFile): void {
    const replacement = this.embedAtCursor(this.app.workspace.activeEditor?.editor);
    const actions: Array<[string, GardaAction]> = [["Transcribe to clipboard", "clipboard"], ["Append transcription to current note", "append"], ["Create transcription note", "new-note"]];
    if (replacement?.file.path === file.path) actions.splice(2, 0, ["Replace embed at cursor", "replace"]);
    actions.forEach(([title, action]) => menu.addItem((item) => item.setTitle(`Garda: ${title}`).onClick(() => { void this.run(file, action, action === "replace" ? replacement ?? undefined : undefined); })));
  }
  private addEditorActions(menu: Menu, target: EmbedTarget): void {
    const actions: Array<[string, GardaAction]> = [["Transcribe to clipboard", "clipboard"], ["Append transcription to current note", "append"], ["Replace embed at cursor", "replace"], ["Create transcription note", "new-note"]];
    actions.forEach(([title, action]) => menu.addItem((item) => item.setTitle(`Garda: ${title}`).onClick(() => { void this.run(target.file, action, action === "replace" ? target : undefined); })));
  }
  private addFolderAction(menu: Menu, folder: TFolder): void { menu.addItem((item) => item.setTitle("Garda: Batch extract folder").onClick(() => { void this.runFolder(folder); })); }
  private async runActive(action: GardaAction): Promise<void> {
    if (action === "replace") {
      const target = this.embedAtCursor(this.app.workspace.activeEditor?.editor);
      if (!target) { new Notice("Garda: place the cursor inside a supported image or PDF embed first."); return; }
      await this.run(target.file, action, target);
      return;
    }
    const file = this.app.workspace.getActiveFile();
    if (!file || !this.isSupported(file)) { new Notice("Garda: select a supported image or PDF file."); return; }
    await this.run(file, action);
  }
  /** Run one OCR action and either create a transcript or replace its embed target. */
  private async run(file: TFile, action: GardaAction, replacement?: EmbedTarget): Promise<void> {
    if (this.activeOperation) { new Notice("Garda: another OCR operation is already running."); return; }
    this.activeOperation = "single";
    try {
      if (action === "replace" && (!replacement || replacement.file.path !== file.path)) throw new Error("Place the cursor inside the embed you want to replace.");
      const result = await this.transcribe(file, (state) => this.updateProgress(`Garda: ${file.name} — ${state.currentPage ? `processing page ${state.currentPage}` : state.status}...`));
      const text = combinePages(result.pages);
      if (result.pages.some((page) => page.needsReview)) new Notice("Garda: low-confidence pages require manual review before destructive actions.");
      if (action === "replace" && result.pages.some((page) => page.needsReview)) return;
      if (action === "clipboard") await navigator.clipboard.writeText(text);
      else if (action === "append") { const active = this.app.workspace.getActiveFile(); if (!active) throw new Error("No current note."); await this.app.vault.append(active, `\n\n${text}\n`); }
      else if (action === "new-note") await this.app.vault.create(`${file.path.replace(/\.[^.]+$/, "")}.transcription.md`, `# Transcription: ${file.basename}\n\n${text}\n`);
      else {
        if (!replacement) throw new Error("Place the cursor inside the embed you want to replace.");
        const currentLine = replacement.editor.getLine(replacement.from.line);
        if (currentLine.slice(replacement.from.ch, replacement.to.ch) !== replacement.text) throw new Error("The embed changed while OCR was running. Nothing was replaced.");
        replacement.editor.replaceRange(text, replacement.from, replacement.to);
      }
      new Notice(`Garda extracted ${result.pages.length} page(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "OCR failed.";
      new Notice(`Garda: ${message}`);
    } finally {
      this.activeOperation = null;
      this.batchCancelRequested = false;
      this.clearProgress();
    }
  }
  /** Submit a file, poll until completion, and surface progress to the notice UI. */
  private async transcribe(file: TFile, onProgress?: (state: GardaJobResult) => void): Promise<GardaJobResult> {
    const bytes = await this.app.vault.readBinary(file);
    const hash = stableHash(bytes);
    const key = `${file.path}:${hash}`;
    const cached = this.settings.cache[key];
    if (cached) return { jobId: "cache", status: "completed", pages: cached.map((page) => ({ ...page, totalPages: cached.length })) };
    const controller = new AbortController();
    this.abortController = controller;
    try {
      const job = await submit(this, file.path, hash, file.name, bytes);
      const result = await poll(this, job.jobId, (state) => onProgress?.(state), controller.signal);
      if (result.status !== "completed") throw new Error(result.error || "OCR job failed.");
      const successfulPages = result.pages.filter((page) => !page.failed);
      if (successfulPages.length === 0) throw new Error("OCR returned no usable pages.");
      // Spend the complete successful-page count in one idempotent server
      // operation. Per-page calls could charge the first pages and then fail,
      // leaving the user with no transcript but a partially consumed pack.
      if (!(await spendPage(this, successfulPages.length))) throw new Error("OCR credits are unavailable for this document.");
      this.settings.cache[key] = result.pages;
      await this.saveSettings();
      return result;
    } finally {
      if (this.abortController === controller) this.abortController = null;
    }
  }
  /** OCR each supported file in a folder and create one transcript note per source. */
  private async runFolder(folder: TFolder): Promise<void> {
    const files = folder.children.filter((child): child is TFile => child instanceof TFile && this.isSupported(child));
    if (!files.length) { new Notice("Garda: no supported files in this folder."); return; }
    if (this.activeOperation) { new Notice("Garda: another OCR operation is already running."); return; }
    this.activeOperation = "batch";
    this.batchCancelRequested = false;
    let completed = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        if (this.batchCancelRequested) break;
        const file = files[i];
        this.updateProgress(`Garda batch ${i + 1}/${files.length}: ${file.name}`);
        try {
          const result = await this.transcribe(file, (state) => this.updateProgress(`Garda batch ${i + 1}/${files.length}: ${file.name} — ${state.currentPage ? `processing page ${state.currentPage}` : state.status}...`));
          await this.app.vault.create(`${file.path.replace(/\.[^.]+$/, "")}.transcription.md`, `# Transcription: ${file.basename}\n\n${combinePages(result.pages)}\n`);
          completed++;
        } catch (error) {
          if (this.batchCancelRequested || (error instanceof Error && error.message === "Operation cancelled.")) break;
          console.error(`Garda batch failed for ${file.path}`, error);
        }
      }
      new Notice(this.batchCancelRequested ? `Garda batch cancelled after ${completed}/${files.length} file(s).` : `Garda batch complete: ${completed}/${files.length} file(s).`);
    } finally {
      this.activeOperation = null;
      this.batchCancelRequested = false;
      this.clearProgress();
    }
  }
  private cancelActiveOperation(): void {
    if (!this.activeOperation) { new Notice("Garda: no active OCR operation."); return; }
    this.batchCancelRequested = true;
    this.abortController?.abort();
    new Notice(this.activeOperation === "batch" ? "Garda: batch cancellation requested." : "Garda: cancellation requested.");
  }
  private updateProgress(message: string): void { if (!this.progressNotice) this.progressNotice = new Notice(message, 0); else this.progressNotice.setMessage(message); }
  private clearProgress(): void { this.progressNotice?.hide(); this.progressNotice = null; }
}
