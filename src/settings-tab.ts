import { PluginSettingTab, Setting } from "obsidian";
import type GardaPlugin from "./main";
import { openCheckout, syncBalance } from "./billing";
import { getConfigurationError, validateConnection } from "./ocr";
import { addBillingAccountSettings } from "./constance-account";

export class GardaSettingTab extends PluginSettingTab {
  constructor(app: ConstructorParameters<typeof PluginSettingTab>[0], private readonly plugin: GardaPlugin) { super(app, plugin); }
  /** Render setup guidance first, with advanced controls below the safe path. */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Garda Handwriting Text OCR" });
    new Setting(containerEl).setName("Setup").setHeading();
    const setupStatus = containerEl.createEl("p", { cls: "garda-setup-status" });
    const updateSetupStatus = (message?: string): void => { setupStatus.textContent = message ?? (getConfigurationError(this.plugin) || "Configuration looks complete. Test the connection before your first scan."); };
    updateSetupStatus();
    new Setting(containerEl).setName("Connection").setDesc("Check the backend and API key without uploading a file.").addButton((button) => button.setButtonText("Test connection").setCta().onClick(async () => { button.setDisabled(true); updateSetupStatus("Checking Garda connection…"); try { await validateConnection(this.plugin); updateSetupStatus("Connected. Garda is ready for OCR."); } catch (error) { updateSetupStatus(error instanceof Error ? error.message : "Connection check failed."); } finally { button.setDisabled(false); } }));
    new Setting(containerEl).setName("Garda backend URL").setDesc("HTTPS endpoint used for remote OCR.").addText((text) => text.setPlaceholder("https://…").setValue(this.plugin.settings.backendUrl).onChange(async (value) => { this.plugin.settings.backendUrl = value.trim().replace(/\/$/, ""); await this.plugin.saveSettings(); updateSetupStatus(); }));
    new Setting(containerEl).setName("Garda API key").setDesc("Stored in Obsidian plugin data and sent only to the configured Garda backend.").addText((text) => { text.inputEl.type = "password"; text.setPlaceholder("garda-...").setValue(this.plugin.settings.apiKey).onChange(async (value) => { this.plugin.settings.apiKey = value.trim(); await this.plugin.saveSettings(); updateSetupStatus(); }); });
    addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "garda-handwriting-text-ocr", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
    new Setting(containerEl).setName("OCR credits").setDesc(`Available credits: ${this.plugin.settings.cachedBalance}`).addButton((button) => button.setButtonText("Refresh").onClick(() => { void syncBalance(this.plugin).then(() => this.display()); }));
    new Setting(containerEl).setName("20-page pack").setDesc("$1 one-time purchase").addButton((button) => button.setButtonText("Buy").setCta().onClick(() => { void openCheckout(this.plugin, "pages20"); }));
    new Setting(containerEl).setName("160-page pack").setDesc("$5 one-time purchase").addButton((button) => button.setButtonText("Buy").setCta().onClick(() => { void openCheckout(this.plugin, "pages160"); }));
    new Setting(containerEl).setName("640-page pack").setDesc("$15 one-time purchase").addButton((button) => button.setButtonText("Buy").setCta().onClick(() => { void openCheckout(this.plugin, "pages640"); }));
    new Setting(containerEl).setName("Privacy").setHeading();
    containerEl.createEl("p", { text: "OCR uploads the selected vault file to the configured Garda backend, which sends the page to its configured OCR model. Garda does not train models on images, text, or metadata, does not collect unrelated telemetry, and deletes uploaded data and derived page images after the configured retention window. The original vault file is never modified unless you explicitly choose Replace embed." });
    containerEl.createEl("p", { text: "The OCR model is selected by the Garda backend. Each processed page consumes one Constance OCR credit." });
  }
}
