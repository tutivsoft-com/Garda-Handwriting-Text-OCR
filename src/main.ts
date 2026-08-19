import { Editor, Notice, Plugin, TFile, TFolder, type Menu } from "obsidian";
import { openCheckout, spendPage, syncBalance } from "./billing";
import { combinePages, poll, stableHash, submit, SUPPORTED_EXTENSIONS } from "./ocr";
import { DEFAULT_SETTINGS } from "./settings";
import { GardaSettingTab } from "./settings-tab";
import type { GardaJobResult, GardaSettings } from "./types";

export default class GardaPlugin extends Plugin {
  declare settings: GardaSettings;
  private abortController: AbortController | null = null;

  async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.constanceDeviceId) { const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes); this.settings.constanceDeviceId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""); await this.saveSettings(); }
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => { if (file instanceof TFile && this.isSupported(file)) this.addFileActions(menu, file); if (file instanceof TFolder) this.addFolderAction(menu, file); }));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => { const file = this.app.workspace.getActiveFile(); if (file && this.isSupported(file) && this.embedAtCursor(editor)) this.addFileActions(menu, file); }));
    this.addCommand({ id: "extract-to-clipboard", name: "Garda: Extract handwriting to clipboard", callback: () => { void this.runActive("clipboard"); } });
    this.addCommand({ id: "append-to-current-note", name: "Garda: Append handwriting to current note", callback: () => { void this.runActive("append"); } });
    this.addCommand({ id: "replace-embed-with-text", name: "Garda: Replace handwriting embed with text", callback: () => { void this.runActive("replace"); } });
    this.addCommand({ id: "extract-to-new-note", name: "Garda: Extract handwriting to new note", callback: () => { void this.runActive("new-note"); } });
    this.addCommand({ id: "batch-extract-folder", name: "Garda: Batch extract folder", callback: () => { const folder = this.app.workspace.getActiveFile()?.parent; if (folder) void this.runFolder(folder); } });
    this.addSettingTab(new GardaSettingTab(this.app, this));
    void syncBalance(this);
  }

  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
  private isSupported(file: TFile): boolean { return SUPPORTED_EXTENSIONS.has(file.extension.toLowerCase()); }
  private embedAtCursor(editor: Editor): boolean { const line = editor.getLine(editor.getCursor().line); return /!\[[^\]]*\]\([^)]*\)|!\[\[[^\]]+\]\]/.test(line); }
  private addFileActions(menu: Menu, file: TFile): void { const actions: Array<[string, "clipboard" | "append" | "replace" | "new-note"]> = [["Extract to clipboard", "clipboard"], ["Append to current note", "append"], ["Replace embed with extracted text", "replace"], ["Extract to a new note", "new-note"]]; actions.forEach(([title, action]) => menu.addItem((item) => item.setTitle(`Garda: ${title}`).onClick(() => { void this.run(file, action); }))); }
  private addFolderAction(menu: Menu, folder: TFolder): void { menu.addItem((item) => item.setTitle("Garda: Batch extract folder").onClick(() => { void this.runFolder(folder); })); }
  private async runActive(action: "clipboard" | "append" | "replace" | "new-note"): Promise<void> { const file = this.app.workspace.getActiveFile(); if (!file || !this.isSupported(file)) { new Notice("Garda: select a supported image or PDF file."); return; } await this.run(file, action); }
  private async run(file: TFile, action: "clipboard" | "append" | "replace" | "new-note"): Promise<void> {
    try { const result = await this.transcribe(file); const text = combinePages(result.pages); if (result.pages.some((page) => page.needsReview)) new Notice("Garda: low-confidence pages require manual review before destructive actions."); if ((action === "replace") && result.pages.some((page) => page.needsReview)) return; if (action === "clipboard") await navigator.clipboard.writeText(text); else if (action === "append") { const active = this.app.workspace.getActiveFile(); if (!active) throw new Error("No current note."); await this.app.vault.append(active, `\n\n${text}\n`); } else if (action === "new-note") { await this.app.vault.create(`${file.path.replace(/\.[^.]+$/, "")}.transcription.md`, `# Transcription: ${file.basename}\n\n${text}\n`); } else { const active = this.app.workspace.activeEditor?.editor; if (!active) throw new Error("No active editor."); active.replaceSelection(text); } new Notice(`Garda extracted ${result.pages.length} page(s).`); } catch (error) { new Notice(`Garda: ${error instanceof Error ? error.message : "OCR failed."}`); }
  }
  private async transcribe(file: TFile): Promise<GardaJobResult> { const bytes = await this.app.vault.readBinary(file); const hash = stableHash(bytes); const key = `${file.path}:${hash}`; const cached = this.settings.cache[key]; if (cached) return { jobId: "cache", status: "completed", pages: cached.map((page) => ({ ...page, totalPages: cached.length })) }; const job = await submit(this, file.path, hash, file.name, bytes); this.abortController = new AbortController(); const result = await poll(this, job.jobId, (state) => new Notice(`Garda: ${state.currentPage ? `processing page ${state.currentPage}` : state.status}...`), this.abortController.signal); this.abortController = null; if (result.status !== "completed") throw new Error(result.error || "OCR job failed."); const successfulPages = result.pages.filter((page) => !page.failed); if (successfulPages.length === 0) throw new Error("OCR returned no usable pages."); for (const page of successfulPages) { if (!(await spendPage(this))) throw new Error("OCR credit unavailable for the next page."); } this.settings.cache[key] = result.pages; await this.saveSettings(); return result; }
  private async runFolder(folder: TFolder): Promise<void> { const files = folder.children.filter((child): child is TFile => child instanceof TFile && this.isSupported(child)); if (!files.length) { new Notice("Garda: no supported files in this folder."); return; } for (let i = 0; i < files.length; i++) { if (this.abortController?.signal.aborted) break; new Notice(`Garda batch: ${i + 1}/${files.length}, ${files[i].name}`); try { const result = await this.transcribe(files[i]); await this.app.vault.create(`${files[i].path.replace(/\.[^.]+$/, "")}.transcription.md`, `# Transcription: ${files[i].basename}\n\n${combinePages(result.pages)}\n`); } catch (error) { console.error(`Garda batch failed for ${files[i].path}`, error); } } }
}
