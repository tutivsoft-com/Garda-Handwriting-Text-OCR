import { gatewayFor, addLivePacks } from "./preview-gateway";
import { Notice, PluginSettingTab, Setting } from "obsidian";
import type GardaPlugin from "./main";
import { openCheckout, syncBalance } from "./billing";
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
    const updateStatus = (message?: string): void => { setupStatus.setText(message ?? (getConfigurationError(this.plugin) || "Signed in. Test the managed connection before your first scan.")); };
    updateStatus();
    addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "garda-handwriting-text-ocr", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
    const balance = new Setting(containerEl).setName("OCR credits");
    const updateBalance = () => balance.setDesc(`${this.plugin.settings.cachedBalance.toLocaleString()} pages available for your account.`);
    updateBalance();
    balance.addButton(button => button.setButtonText("Refresh balance").onClick(async () => {
      button.setDisabled(true); button.setButtonText("Refreshing…");
      try { await syncBalance(this.plugin, true); updateBalance(); }
      catch (error) { new Notice(error instanceof Error ? error.message : "Could not refresh balance. Try again."); }
      finally { button.setDisabled(false); button.setButtonText("Refresh balance"); }
    }));
    addLivePacks(containerEl,gatewayFor(this.plugin.settings));
    new Setting(containerEl).setName("Managed connection").setDesc("Checks the OCR provider and your account session without uploading an attachment.")
      .addButton(button => button.setButtonText("Test connection").onClick(async () => {
        button.setDisabled(true); updateStatus("Checking managed OCR service…");
        try { await validateConnection(this.plugin); updateStatus("Connected. Garda is ready for OCR."); }
        catch (error) { updateStatus(error instanceof Error ? error.message : "Connection check failed. Try again."); }
        finally { button.setDisabled(false); }
      }));
    containerEl.createEl("p", { text: "OCR sends only the attachment you select to Constance for authorized server-side OCR. Review extracted text before relying on it. Replace embed is blocked when a page needs manual review." });
    void syncBalance(this.plugin).then(updateBalance).catch(() => {});
    if (this.plugin.settings.settingsMode !== "advanced") return;
    new Setting(containerEl).setName("Service and privacy").setHeading();
    new Setting(containerEl).setName("Managed OCR service").setDesc("Garda chooses the model and uses its own provider key. Constance manages your account and credits; no personal API key or custom endpoint is needed.");
    containerEl.createEl("p", { text: "Images and PDF pages are prepared locally and sent to Constance for authorized server-side OCR. Completed results are cached locally for unchanged attachments." });
    this.plugin.support.addDiagnosticsSetting(containerEl);
  }
}
