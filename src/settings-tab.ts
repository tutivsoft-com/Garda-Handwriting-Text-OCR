import { Notice, PluginSettingTab, Setting } from "obsidian";
import type GardaPlugin from "./main";
import { addLivePacks } from "./billing-packs";
import { syncBalance } from "./billing";
import { getConfigurationError, validateConnection } from "./ocr";
import { addBillingAccountSettings } from "./constance-account";

export class GardaSettingTab extends PluginSettingTab {
  constructor(app: ConstructorParameters<typeof PluginSettingTab>[0], private readonly plugin: GardaPlugin) { super(app, plugin); }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Garda Handwriting Text OCR" });
    new Setting(containerEl).setName("Settings mode").setDesc("Simple shows everyday controls. Advanced adds customization and troubleshooting.")
      .addDropdown(dropdown => dropdown.addOption("simple", "Simple").addOption("advanced", "Advanced")
        .setValue(this.plugin.settings.settingsMode).onChange(async value => {
          this.plugin.settings.settingsMode = value === "advanced" ? "advanced" : "simple";
          await this.plugin.saveSettings(); this.display();
        }));
    containerEl.createEl("p", { text: "Select an image or PDF, then choose a Garda extraction command. Clipboard and new-note commands preserve the original. Each processed page uses one OCR credit." });
    const setupStatus = containerEl.createEl("p", { cls: "garda-setup-status" });
    const updateStatus = (message?: string): void => { setupStatus.setText(message ?? (getConfigurationError(this.plugin) || "Signed in. Test the provider connection before your first scan.")); };
    updateStatus();
    addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "garda-handwriting-text-ocr", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
    const balance = new Setting(containerEl).setName("OCR credits");
    const updateBalance = () => balance.setDesc(`${this.plugin.settings.cachedBalance.toLocaleString()} pages available for your account.`);
    this.plugin.refreshBillingCredits = updateBalance;
    updateBalance();
    balance.addButton(button => button.setButtonText("Refresh balance").onClick(async () => {
      button.setDisabled(true); button.setButtonText("Refreshing…");
      try { await syncBalance(this.plugin, true); updateBalance(); }
      catch (error) { new Notice(error instanceof Error ? error.message : "Could not refresh balance. Try again."); }
      finally { button.setDisabled(false); button.setButtonText("Refresh balance"); }
    }));
    addLivePacks(containerEl, { appId: "garda-handwriting-text-ocr", installationId: this.plugin.settings.constanceDeviceId,
      state: this.plugin.settings, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin) });
    new Setting(containerEl).setName("Provider connection").setDesc("Checks the OpenRouter provider key and your billing account without uploading an attachment.")
      .addButton(button => button.setButtonText("Test connection").onClick(async () => {
        button.setDisabled(true); updateStatus("Checking OpenRouter and billing account…");
        try { await validateConnection(this.plugin); updateStatus("Connected. Garda is ready for OCR."); }
        catch (error) { updateStatus(error instanceof Error ? error.message : "Connection check failed. Try again."); }
        finally { button.setDisabled(false); }
      }));
    containerEl.createEl("p", { text: "OCR prepares images and PDF pages locally, then sends them directly to OpenRouter using Garda's managed key. Constance handles account verification and credits. Review extracted text before relying on it. Replace embed is blocked when a page needs manual review." });
    void syncBalance(this.plugin).then(updateBalance).catch(() => {});
    if (this.plugin.settings.settingsMode !== "advanced") return;
    new Setting(containerEl).setName("Service and privacy").setHeading();
    new Setting(containerEl).setName("OpenRouter OCR").setDesc("Garda uses its existing managed OpenRouter key. Constance handles account verification, billing and credit spending; no personal API key or custom endpoint is needed.");
    containerEl.createEl("p", { text: "Images and PDF pages are prepared locally and sent directly to OpenRouter. Completed results are cached locally for unchanged attachments." });
    this.plugin.support.addDiagnosticsSetting(containerEl);
  }
}
