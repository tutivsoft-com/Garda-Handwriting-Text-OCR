import { Notice, requestUrl } from "obsidian";
import type GardaPlugin from "./main";

const BASE_URL = "https://app.tutivsoft.com";
const APP_ID = "garda-handwriting-text-ocr";
export const GARDA_PRICE_IDS = {
  pages20: "pri_01m0avr6r394qb1x3xpzy5wmys",
  pages160: "pri_01m0avr7b0btzhkf1976x1ycwr",
  pages640: "pri_01m0avr7x81s0tvb8203q0cqzx",
} as const;

function eventId(): string {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `evt_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function syncBalance(plugin: GardaPlugin): Promise<void> {
  if (!plugin.settings.constanceDeviceId) return;
  try {
    const response = await requestUrl({
      url: `${BASE_URL}/api/v1/public/browser/entitlements`, method: "POST", throw: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: APP_ID, external_customer_id: plugin.settings.constanceDeviceId, machine_id: plugin.settings.constanceDeviceId }),
    });
    if (response.status >= 200 && response.status < 300) {
      plugin.settings.cachedBalance = Math.max(0, Number(response.json?.data?.credits?.balance) || 0);
      await plugin.saveSettings();
    }
  } catch (error) {
    console.warn("Garda: Constance balance sync failed", error);
  }
}

export async function spendPage(plugin: GardaPlugin): Promise<boolean> {
  try {
    const response = await requestUrl({
      url: `${BASE_URL}/api/v1/public/browser/credits/spend`, method: "POST", throw: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: APP_ID, external_customer_id: plugin.settings.constanceDeviceId, machine_id: plugin.settings.constanceDeviceId, amount: 1, event_id: eventId() }),
    });
    if (response.status === 402 || response.status === 404) {
      new Notice("Garda: no OCR credits remain. Buy credits in plugin settings.");
      plugin.settings.cachedBalance = 0;
      await plugin.saveSettings();
      return false;
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
    plugin.settings.cachedBalance = Math.max(0, Number(response.json?.data?.credits?.balance) || 0);
    await plugin.saveSettings();
    return true;
  } catch (error) {
    console.error("Garda: credit spend failed", error);
    new Notice("Garda could not verify credits. No OCR was started.");
    return false;
  }
}

export function openCheckout(plugin: GardaPlugin, pack: keyof typeof GARDA_PRICE_IDS): void {
  const email = plugin.settings.billingEmail.trim();
  if (!email) { new Notice("Enter a billing email in Garda settings first."); return; }
  const params = new URLSearchParams({ app_id: APP_ID, price_id: GARDA_PRICE_IDS[pack], email, external_customer_id: plugin.settings.constanceDeviceId });
  window.open(`${BASE_URL}/buy?${params.toString()}`, "_blank");
}
