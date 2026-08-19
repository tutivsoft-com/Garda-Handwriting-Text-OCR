import { PluginSettingTab, Setting } from "obsidian";
import type GardaPlugin from "./main";
import { openCheckout, syncBalance } from "./billing";

export class GardaSettingTab extends PluginSettingTab {
  constructor(app: ConstructorParameters<typeof PluginSettingTab>[0], private readonly plugin: GardaPlugin) { super(app, plugin); }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Garda Handwriting Text OCR" });
    new Setting(containerEl).setName("Garda backend URL").setDesc("HTTPS endpoint used for remote OCR.").addText((text) => text.setValue(this.plugin.settings.backendUrl).onChange(async (value) => { this.plugin.settings.backendUrl = value.trim().replace(/\/$/, ""); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Garda API key").setDesc("The key authorizes this plugin with the Garda backend. It is stored in Obsidian plugin data.").addText((text) => text.setPlaceholder("garda-...").setValue(this.plugin.settings.apiKey).onChange(async (value) => { this.plugin.settings.apiKey = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Constance billing email").setDesc("Used only to open the existing Constance checkout.").addText((text) => text.setValue(this.plugin.settings.billingEmail).onChange(async (value) => { this.plugin.settings.billingEmail = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("OCR credits").setDesc(`Available credits: ${this.plugin.settings.cachedBalance}`).addButton((button) => button.setButtonText("Refresh").onClick(() => { void syncBalance(this.plugin).then(() => this.display()); }));
    new Setting(containerEl).setName("20-page pack").setDesc("$1 one-time purchase").addButton((button) => button.setButtonText("Buy").setCta().onClick(() => openCheckout(this.plugin, "pages20")));
    new Setting(containerEl).setName("160-page pack").setDesc("$5 one-time purchase").addButton((button) => button.setButtonText("Buy").setCta().onClick(() => openCheckout(this.plugin, "pages160")));
    new Setting(containerEl).setName("640-page pack").setDesc("$15 one-time purchase").addButton((button) => button.setButtonText("Buy").setCta().onClick(() => openCheckout(this.plugin, "pages640")));
    new Setting(containerEl).setName("Privacy").setHeading();
    containerEl.createEl("p", { text: "OCR uploads the selected vault file to the configured Garda backend, which sends the page to GPT-5 mini. Garda does not train models on images, text, or metadata, does not collect unrelated telemetry, and deletes uploaded data and derived page images after the configured retention window. The original vault file is never modified unless you explicitly choose Replace embed." });
    containerEl.createEl("p", { text: "Remote model: GPT-5 mini. Each processed page consumes one Constance OCR credit." });
  }
}
