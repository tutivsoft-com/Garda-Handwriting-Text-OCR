import { diagnostics } from "./diagnostics";
import { Notice, PluginSettingTab, Setting } from "obsidian";
import type GardaPlugin from "./main";
import { addLivePacks } from "./billing-packs";
import { syncBalance } from "./billing";
import { getConfigurationError, validateConnection } from "./ocr";
import { addBillingAccountSettings } from "./constance-account";

export class GardaSettingTab extends PluginSettingTab {
  constructor(app: ConstructorParameters<typeof PluginSettingTab>[0], private readonly plugin: GardaPlugin) { super(app, plugin); }
  display(): void {
return diagnostics.guard("settings-tab.display_1", () => {
const diagnosticAction1 = () => {

    const { containerEl } = this;
    const diagnosticStage2 = diagnostics?.start?.("settings.render.clear") ?? (() => {});
containerEl.empty();
diagnosticStage2();

    const diagnosticStage3 = diagnostics?.start?.("settings.render.help") ?? (() => {});
this.plugin.support.addHelpSetting(containerEl);
diagnosticStage3();

this.plugin.support.addDebugSetting?.(containerEl);

    const diagnosticStage4 = diagnostics?.start?.("settings.render.stage_1") ?? (() => {});
containerEl.createEl("h2", { text: "Garda Handwriting Text OCR" });
diagnosticStage4();

    const diagnosticStage5 = diagnostics?.start?.("settings.render.settings_mode") ?? (() => {});
new Setting(containerEl).setName("Settings mode").setDesc("Simple shows everyday controls. Advanced adds customization and troubleshooting.")
      .addDropdown(dropdown => dropdown.addOption("simple", "Simple").addOption("advanced", "Advanced — optional")
        .setValue(this.plugin.settings.settingsMode).onChange(async value => {
return diagnostics.guard("settings-tab.control_2", async () => {
const diagnosticEnd21 = diagnostics?.start?.("control.settings_mode.onChange") ?? (() => {});
try {

          this.plugin.settings.settingsMode = value === "advanced" ? "advanced" : "simple";
          await this.plugin.saveSettings(); this.display();

} catch (diagnosticError21) { diagnostics?.failure?.("control.settings_mode.onChange", diagnosticError21); throw diagnosticError21; } finally { diagnosticEnd21(); }

});
}));
diagnosticStage5();

    const diagnosticStage6 = diagnostics?.start?.("settings.render.stage_2") ?? (() => {});
containerEl.createEl("p", { text: "Select an image or PDF, then choose a Garda extraction command. Clipboard and new-note commands preserve the original. Each processed page uses one OCR credit." });
diagnosticStage6();

    const setupStatus = containerEl.createEl("p", { cls: "garda-setup-status" });
    const updateStatus = (message?: string): void => { setupStatus.setText(message ?? (getConfigurationError(this.plugin) || "Signed in. Garda is ready for OCR; the connection test is optional.")); };
    const diagnosticStage7 = diagnostics?.start?.("settings.render.stage_3") ?? (() => {});
updateStatus();
diagnosticStage7();

    const diagnosticStage8 = diagnostics?.start?.("settings.render.account") ?? (() => {});
addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "garda-handwriting-text-ocr", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
diagnosticStage8();

    const balance = new Setting(containerEl).setName("OCR credits");
    const updateBalance = () => {
      const free = (this.plugin.settings as typeof this.plugin.settings & { cachedFreePages?: number }).cachedFreePages ?? 0;
      balance.setDesc(this.plugin.settings.billingAccountLinked ? `${free.toLocaleString()} free pages + ${this.plugin.settings.cachedBalance.toLocaleString()} purchased pages available for your account.` : "Connect your account to check your free and purchased pages.");
    };
    const diagnosticStage9 = diagnostics?.start?.("settings.render.stage_4") ?? (() => {});
this.plugin.refreshBillingCredits = updateBalance;
diagnosticStage9();

    const diagnosticStage10 = diagnostics?.start?.("settings.render.stage_5") ?? (() => {});
updateBalance();
diagnosticStage10();

    const diagnosticStage11 = diagnostics?.start?.("settings.render.stage_6") ?? (() => {});
balance.addButton(button => button.setButtonText("Refresh balance").onClick(async () => {
return diagnostics.guard("settings-tab.control_3", async () => {
const diagnosticEnd22 = diagnostics?.start?.("control.refresh_balance.onClick") ?? (() => {});
try {

      button.setDisabled(true); button.setButtonText("Refreshing…");
      try { await syncBalance(this.plugin, true); updateBalance(); }
      catch (error) {
diagnostics.failure("settings-tab.caught_4", error); new Notice(error instanceof Error ? error.message : "Could not refresh balance. Try again."); }
      finally { button.setDisabled(false); button.setButtonText("Refresh balance"); }

} catch (diagnosticError22) { diagnostics?.failure?.("control.refresh_balance.onClick", diagnosticError22); throw diagnosticError22; } finally { diagnosticEnd22(); }

});
}));
diagnosticStage11();

    const diagnosticStage12 = diagnostics?.start?.("settings.render.stage_7") ?? (() => {});
addLivePacks(containerEl, { appId: "garda-handwriting-text-ocr", installationId: this.plugin.settings.constanceDeviceId,
      state: this.plugin.settings, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin) });
diagnosticStage12();

    const diagnosticStage13 = diagnostics?.start?.("settings.render.provider_connection") ?? (() => {});
new Setting(containerEl).setName("AI connection").setDesc("Check the AI connection and your account without uploading an attachment.")
      .addButton(button => button.setButtonText("Test connection").onClick(async () => {
return diagnostics.guard("settings-tab.control_5", async () => {
const diagnosticEnd23 = diagnostics?.start?.("control.provider_connection.onClick") ?? (() => {});
try {

        button.setDisabled(true); updateStatus("Checking AI connection and account…");
        try { await validateConnection(this.plugin); updateStatus("Connected. Garda is ready for OCR."); }
        catch (error) {
diagnostics.failure("settings-tab.caught_6", error); updateStatus(error instanceof Error ? error.message : "Connection check failed. Try again."); }
        finally { button.setDisabled(false); }

} catch (diagnosticError23) { diagnostics?.failure?.("control.provider_connection.onClick", diagnosticError23); throw diagnosticError23; } finally { diagnosticEnd23(); }

});
}));
diagnosticStage13();

    const diagnosticStage14 = diagnostics?.start?.("settings.render.stage_8") ?? (() => {});
containerEl.createEl("p", { text: "Images and PDF pages are sent to OpenRouter for text extraction. Review the extracted text before using it. Pages that need manual review cannot replace an embed." });
diagnosticStage14();

    const diagnosticStage15 = diagnostics?.start?.("settings.render.stage_9") ?? (() => {});
void diagnostics.guard("settings-tab.background_7", () => (syncBalance(this.plugin).then(updateBalance).catch((rejectedError1) => {
diagnostics.failure("settings-tab.rejected_2", rejectedError1);})));
diagnosticStage15();

    const diagnosticStage16 = diagnostics?.start?.("settings.render.stage_10") ?? (() => {});
if (this.plugin.settings.settingsMode !== "advanced") return;
diagnosticStage16();

    const diagnosticStage17 = diagnostics?.start?.("settings.render.service_and_privacy") ?? (() => {});
new Setting(containerEl).setName("Service and privacy").setHeading();
diagnosticStage17();

    const diagnosticStage18 = diagnostics?.start?.("settings.render.openrouter_ocr") ?? (() => {});
new Setting(containerEl).setName("AI text extraction").setDesc("The AI connection is included. No API key is required.");
diagnosticStage18();

    const diagnosticStage19 = diagnostics?.start?.("settings.render.stage_11") ?? (() => {});
containerEl.createEl("p", { text: "Images and PDF pages are prepared locally and sent directly to OpenRouter. Completed results are cached locally for unchanged attachments." });
diagnosticStage19();

    const diagnosticStage20 = diagnostics?.start?.("settings.render.stage_12") ?? (() => {});
this.plugin.support.addDiagnosticsSetting(containerEl);
diagnosticStage20();


}; return diagnostics?.run ? diagnostics.run("settings.open", diagnosticAction1) : diagnosticAction1();

});
}

  hide(): void { const end = diagnostics?.start?.("settings.close") ?? (() => {}); try { super.hide(); } finally { end(); } }
}
