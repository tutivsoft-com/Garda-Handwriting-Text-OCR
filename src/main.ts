import { selectedFiles, markdownFile, registerSelectionAction } from "./selection-scope";
import { diagnostics } from "./diagnostics";
import { showAccountWelcome } from "./constance-account";
import { Editor, MarkdownView, Modal, Notice, Plugin, Setting, TFile, TFolder, type Menu } from "obsidian";
import { retryPendingSpendEvents, spendPage, syncBalance } from "./billing";
import { combinePages, transcribeDirect, stableHash, SUPPORTED_EXTENSIONS } from "./ocr";
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
  refreshBillingCredits?: () => void;
  private abortController: AbortController | null = null;
  private activeOperation: "single" | "batch" | null = null;
  private batchCancelRequested = false;
  private progressNotice: Notice | null = null;

  /** Register commands and menus, then load settings without starting a scan. */
  async onload(): Promise<void> {
let diagnosticStartupEnd: () => void = () => {};

const diagnosticEnd1 = diagnostics?.start?.("main.onload") ?? (() => {});
try {

    this.support = new PluginSupport(this, { name: "Garda Handwriting Text OCR", summary: "Extract text from supported images and PDFs into your notes.", quickStart: ["Sign in to your account in Settings.", "Open or select a supported attachment.", "Choose an OCR destination command."], commands: ["Extract to clipboard", "Append to current note", "Batch extract folder"], troubleshooting: ["Use Copy diagnostic log before reporting a problem.", "Check the attachment type and your available credits."] });
    this.support.start();
    const stored = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored, { cache: { ...DEFAULT_SETTINGS.cache, ...(stored?.cache ?? {}) } });
diagnosticStartupEnd = diagnostics?.start?.("startup.initialize") ?? (() => {});

    this.settings.settingsMode = this.settings.settingsMode === "advanced" ? "advanced" : "simple";
    if (!this.settings.constanceDeviceId) { const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes); this.settings.constanceDeviceId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""); await this.saveSettings(); }
    this.settings.billingAccessToken = typeof this.settings.billingAccessToken === "string" ? this.settings.billingAccessToken : "";
    this.settings.billingRefreshToken = typeof this.settings.billingRefreshToken === "string" ? this.settings.billingRefreshToken : "";
    this.settings.billingAccountLinked = this.settings.billingAccountLinked === true && Boolean(this.settings.billingAccessToken);
    this.settings.pendingSpendEvents = Array.isArray(this.settings.pendingSpendEvents) ? this.settings.pendingSpendEvents.filter((item) => item && typeof item.eventId === "string" && Number.isInteger(item.amount) && item.amount > 0) : [];
    await this.saveSettings();
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
return diagnostics.guard("main.event_1", () => { if (file instanceof TFile && this.isSupported(file)) this.addFileActions(menu, file); if (file instanceof TFolder) this.addFolderAction(menu, file);
});
}));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => {
return diagnostics.guard("main.event_2", () => { const target = this.embedAtCursor(editor); if (target) this.addEditorActions(menu, target);
});
}));
    this.addCommand({ id: "extract-to-clipboard", name: "Extract handwriting to clipboard", callback: () => this.runActive("clipboard") });
    this.addCommand({ id: "append-to-current-note", name: "Append handwriting to current note", callback: () => this.runActive("append") });
    this.addCommand({ id: "replace-embed-with-text", name: "Replace handwriting embed with text", callback: () => this.runActive("replace") });
    this.addCommand({ id: "extract-to-new-note", name: "Extract handwriting to new note", callback: () => this.runActive("new-note") });
    this.addCommand({ id: "batch-extract-folder", name: "Batch extract folder", callback: () => { const folder = this.app.workspace.getActiveFile()?.parent; if (folder) return this.runFolder(folder); new Notice("Garda: open a note or attachment in the folder you want to process."); } });
    this.addCommand({ id: "cancel-active-operation", name: "Cancel active OCR or batch", callback: () => this.cancelActiveOperation() });
    registerSelectionAction(this, { name: "Garda: Extract selected attachments to notes", icon: "scan-text", accepts: file => this.isSupported(file),
      run: files => this.runFolder(this.app.vault.getRoot(), files) });
    this.addSettingTab(new GardaSettingTab(this.app, this));
    this.support.showWelcome();
    await showAccountWelcome(this, this.settings, () => this.saveSettings());
    void diagnostics.guard("main.background_3", () => (syncBalance(this).then(() => retryPendingSpendEvents(this))));

} catch (diagnosticError1) { diagnostics?.failure?.("main.onload", diagnosticError1); throw diagnosticError1; } finally { diagnosticStartupEnd();  diagnostics?.legacy?.("info", "startup.finished"); diagnosticEnd1(); }
}

  onunload(): void {
return diagnostics.guard("main.onunload_4", () => {
const diagnosticAction2 = () => {
 this.abortController?.abort(); this.progressNotice?.hide();
}; return diagnostics?.run ? diagnostics.run("main.onunload", diagnosticAction2) : diagnosticAction2();

});
}

  async saveSettings(): Promise<void> {
const diagnosticEnd3 = diagnostics?.start?.("main.saveSettings") ?? (() => {});
try {
 await this.saveData(this.settings);
} catch (diagnosticError3) { diagnostics?.failure?.("main.saveSettings", diagnosticError3); throw diagnosticError3; } finally { diagnosticEnd3(); }
}
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
      try { decodedLinkpath = decodeURIComponent(linkpath); } catch (caughtError5) {
diagnostics.failure("main.caught_6", caughtError5); return null; }
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
    actions.forEach(([title, action]) => menu.addItem((item) => item.setTitle(`Garda: ${title}`).onClick(() => {
return diagnostics.guard("main.control_7", () => {
const diagnosticAction4 = () => {
 void diagnostics.guard("main.background_8", () => (this.run(file, action, action === "replace" ? replacement ?? undefined : undefined)));
}; return diagnostics?.run ? diagnostics.run("control.6666.onClick", diagnosticAction4) : diagnosticAction4();

});
})));
  }
  private addEditorActions(menu: Menu, target: EmbedTarget): void {
    const actions: Array<[string, GardaAction]> = [["Transcribe to clipboard", "clipboard"], ["Append transcription to current note", "append"], ["Replace embed at cursor", "replace"], ["Create transcription note", "new-note"]];
    actions.forEach(([title, action]) => menu.addItem((item) => item.setTitle(`Garda: ${title}`).onClick(() => {
return diagnostics.guard("main.control_9", () => {
const diagnosticAction5 = () => {
 void diagnostics.guard("main.background_10", () => (this.run(target.file, action, action === "replace" ? target : undefined)));
}; return diagnostics?.run ? diagnostics.run("control.7176.onClick", diagnosticAction5) : diagnosticAction5();

});
})));
  }
  private addFolderAction(menu: Menu, folder: TFolder): void { menu.addItem((item) => item.setTitle("Garda: Batch extract folder").onClick(() => {
return diagnostics.guard("main.control_11", () => {
const diagnosticAction6 = () => {
 void diagnostics.guard("main.background_12", () => (this.runFolder(folder)));
}; return diagnostics?.run ? diagnostics.run("control.7412.onClick", diagnosticAction6) : diagnosticAction6();

});
})); }
  private async runActive(action: GardaAction): Promise<void> {
const diagnosticEnd7 = diagnostics?.start?.("main.runActive") ?? (() => {});
try {

    if (action === "replace") {
      const target = this.embedAtCursor(this.app.workspace.activeEditor?.editor);
      if (!target) { new Notice("Garda: place the cursor inside a supported image or PDF embed first."); return; }
      await this.run(target.file, action, target);
      return;
    }
    const file = this.app.workspace.getActiveFile();
    if (!file || !this.isSupported(file)) { new Notice("Garda: select a supported image or PDF file."); return; }
    await this.run(file, action);

} catch (diagnosticError7) { diagnostics?.failure?.("main.runActive", diagnosticError7); throw diagnosticError7; } finally { diagnosticEnd7(); }
}
  /** Run one OCR action and either create a transcript or replace its embed target. */
  private async run(file: TFile, action: GardaAction, replacement?: EmbedTarget): Promise<void> {
const diagnosticEnd8 = diagnostics?.start?.("main.run") ?? (() => {});
try {

    if (this.activeOperation) { new Notice("Garda: another OCR operation is already running."); return; }
    const destination = action === "append" ? this.app.workspace.getActiveViewOfType(MarkdownView)?.file : null;
    if (action === "append" && (!destination || destination.extension.toLowerCase() !== "md")) {
      new Notice("Garda: open a Markdown note before appending a transcription.");
      return;
    }
    this.activeOperation = "single";
    try {
      if (action === "replace" && (!replacement || replacement.file.path !== file.path)) throw new Error("Place the cursor inside the embed you want to replace.");
      const sourceHash=stableHash(await this.app.vault.readBinary(file));
      const result = await this.transcribe(file, (state) => this.updateProgress(`Garda: ${file.name} — ${state.currentPage ? `processing page ${state.currentPage}` : state.status}...`));
      const text = combinePages(result.pages);
      if(stableHash(await this.app.vault.readBinary(file))!==sourceHash)throw new Error("Source attachment changed. The original transcript is preserved; no output was applied.");
      if (result.pages.some((page) => page.needsReview)) new Notice("Garda: low-confidence pages require manual review before destructive actions.");
      if (action === "replace" && result.pages.some((page) => page.needsReview)) return;
      if (action === "clipboard") await navigator.clipboard.writeText(text);
      else if (action === "append") { if (!destination) throw new Error("No Markdown note is open."); await this.app.vault.append(destination, `\n\n${text}\n`); }
      else if (action === "new-note") await this.createTranscriptNote(file, text);
      else {
        if (!replacement) throw new Error("Place the cursor inside the embed you want to replace.");
        const currentLine = replacement.editor.getLine(replacement.from.line);
        if (currentLine.slice(replacement.from.ch, replacement.to.ch) !== replacement.text) throw new Error("The embed changed while OCR was running. Nothing was replaced.");
        replacement.editor.replaceRange(text, replacement.from, replacement.to);
      }
      new Notice(`Garda extracted ${result.pages.length} page(s).`);
    } catch (error) {
diagnostics.failure("main.caught_13", error);
      const message = error instanceof Error ? error.message : "OCR failed.";
      new Notice(`Garda: ${message}`);
    } finally {
      this.activeOperation = null;
      this.batchCancelRequested = false;
      this.clearProgress();
    }

} catch (diagnosticError8) { diagnostics?.failure?.("main.run", diagnosticError8); throw diagnosticError8; } finally { diagnosticEnd8(); }
}
  /** Transcribe directly with the provider and surface page progress. */
  private async transcribe(file: TFile, onProgress?: (state: GardaJobResult) => void): Promise<GardaJobResult> {
const diagnosticEnd9 = diagnostics?.start?.("main.transcribe") ?? (() => {});
try {

    const bytes = await this.app.vault.readBinary(file);
    const hash = stableHash(bytes);
    const key = `${file.path}:${hash}`;
    const cached = this.settings.cache[key];
    if (cached) return { jobId: "cache", status: "completed", pages: cached.map((page) => ({ ...page, totalPages: cached.length })) };
    if (!this.settings.billingAccountLinked || !this.settings.billingAccessToken) {
      throw new Error("Sign in to your account in Garda settings before starting OCR.");
    }
    const controller = new AbortController();
    this.abortController = controller;
    try {
      const result = await transcribeDirect(this, file.name, bytes, (state) => onProgress?.(state), controller.signal);
      if (result.status !== "completed") throw new Error(result.error || "OCR job failed.");
      const successfulPages = result.pages.filter((page) => !page.failed);
      if (successfulPages.length === 0) throw new Error("OCR returned no usable pages.");
      // Spend the complete successful-page count in one idempotent server
      // operation. Per-page calls could charge the first pages and then fail,
      // leaving the user with no transcript but a partially consumed pack.
      if (!(await spendPage(this, successfulPages.length))) throw new Error("OCR credits are unavailable for this document.");
      this.settings.cache[key] = result.pages;
      await this.saveSettings();
      return await (result);
    } finally {
      if (this.abortController === controller) this.abortController = null;
    }

} catch (diagnosticError9) { diagnostics?.failure?.("main.transcribe", diagnosticError9); throw diagnosticError9; } finally { diagnosticEnd9(); }
}
  /** OCR each supported file in a folder and create one transcript note per source. */
  private async runFolder(folder: TFolder, retryFiles?: TFile[]): Promise<void> {
const diagnosticEnd10 = diagnostics?.start?.("main.runFolder") ?? (() => {});
try {

    const files = retryFiles ?? selectedFiles([folder], file => this.isSupported(file));
    if (!files.length) { new Notice("Garda: no supported files in this folder."); return; }
    if (this.activeOperation) { new Notice("Garda: another OCR operation is already running."); return; }
    this.activeOperation = "batch";
    this.batchCancelRequested = false;
    let completed = 0;
    const failed: TFile[] = [];
    const outputs: TFile[] = [];
    let cancelled = false;
    try {
      for (let i = 0; i < files.length; i++) {
        if (this.batchCancelRequested) break;
        const file = files[i];
        this.updateProgress(`Garda batch ${i + 1}/${files.length}: ${file.name}`);
        try {
          const result = await this.transcribe(file, (state) => this.updateProgress(`Garda batch ${i + 1}/${files.length}: ${file.name} — ${state.currentPage ? `processing page ${state.currentPage}` : state.status}...`));
          outputs.push(await this.createTranscriptNote(file, combinePages(result.pages)));
          completed++;
        } catch (error) {
diagnostics.failure("main.caught_14", error);
          if (this.batchCancelRequested || (error instanceof Error && error.message === "Operation cancelled.")) break;
          failed.push(file);
          this.support.warn("batch.file_failed", { operation: "folder-ocr" });
        }
      }
      cancelled = this.batchCancelRequested;
      new Notice(cancelled ? `Garda batch cancelled after ${completed}/${files.length} file(s).` : `Garda batch complete: ${completed}/${files.length} file(s); ${failed.length} failed.`);
    } finally {
      this.activeOperation = null;
      this.batchCancelRequested = false;
      this.clearProgress();
    }
    if (!this.support.automaticWindowsEnabled()) return;
    const summary = new Modal(this.app);
    summary.titleEl.setText("Garda batch results");
    summary.contentEl.createEl("p", { text: `${completed}/${files.length} files completed; ${failed.length} failed.${cancelled ? " The batch was cancelled; unprocessed files were left unchanged." : ""}` });
    for (const output of outputs) new Setting(summary.contentEl).setName(output.name).addButton(button => button.setButtonText("Open transcript").onClick(() => {
return diagnostics.guard("main.control_15", () => {
const diagnosticAction11 = () => {
 void diagnostics.guard("main.background_16", () => (this.app.workspace.openLinkText(output.path, "", true)));
}; return diagnostics?.run ? diagnostics.run("control.open_transcript.onClick", diagnosticAction11) : diagnosticAction11();

});
}));
    if (failed.length) {
      summary.contentEl.createEl("p", { text: "Could not process: " + failed.map(file => file.name).join(", ") + ". Check Account, your connection, and that each file is supported before retrying. Completed files will not be processed again." });
      new Setting(summary.contentEl).addButton(button => button.setButtonText("Retry failed files").onClick(() => {
return diagnostics.guard("main.control_17", () => {
const diagnosticAction12 = () => {
 summary.close(); void diagnostics.guard("main.background_18", () => (this.runFolder(folder, failed)));
}; return diagnostics?.run ? diagnostics.run("control.retry_failed_files.onClick", diagnosticAction12) : diagnosticAction12();

});
}));
    }
    new Setting(summary.contentEl).addButton(button => button.setButtonText("Close").onClick(() => {
return diagnostics.guard("main.control_19", () => { const diagnosticAction13 = () => (summary.close()); return diagnostics?.run ? diagnostics.run("control.close.onClick", diagnosticAction13) : diagnosticAction13();
});
}));
    summary.open();

} catch (diagnosticError10) { diagnostics?.failure?.("main.runFolder", diagnosticError10); throw diagnosticError10; } finally { diagnosticEnd10(); }
}
  private async createTranscriptNote(file: TFile, text: string): Promise<TFile> {
const diagnosticEnd14 = diagnostics?.start?.("main.createTranscriptNote") ?? (() => {});
try {

    const base = `${file.path.replace(/\.[^.]+$/, "")}.transcription`;
    let path = `${base}.md`;
    for (let suffix = 2; this.app.vault.getAbstractFileByPath(path); suffix++) path = `${base}-${suffix}.md`;
    return await (this.app.vault.create(path, `# Transcription: ${file.basename}\n\n${text}\n`));

} catch (diagnosticError14) { diagnostics?.failure?.("main.createTranscriptNote", diagnosticError14); throw diagnosticError14; } finally { diagnosticEnd14(); }
}
  private cancelActiveOperation(): void {
const diagnosticAction15 = () => {

    if (!this.activeOperation) { new Notice("Garda: no active OCR operation."); return; }
    this.batchCancelRequested = true;
    this.abortController?.abort();
    new Notice(this.activeOperation === "batch" ? "Garda: batch cancellation requested." : "Garda: cancellation requested.");

}; return diagnostics?.run ? diagnostics.run("main.cancelActiveOperation", diagnosticAction15) : diagnosticAction15();
}
  private updateProgress(message: string): void { if (!this.progressNotice) this.progressNotice = new Notice(message, 0); else this.progressNotice.setMessage(message); }
  private clearProgress(): void { this.progressNotice?.hide(); this.progressNotice = null; }
}
