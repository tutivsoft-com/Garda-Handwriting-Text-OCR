import { resumeAccountCheckout } from "./billing-checkout";
import { openAccountCheckout } from "./billing-checkout";
import { Notice, requestUrl } from "obsidian";
import type GardaPlugin from "./main";
import { refreshBillingSession, spendAccountCredits } from "./constance-account";

const BASE_URL = "https://app.tutivsoft.com";
const APP_ID = "garda-handwriting-text-ocr";
export const GARDA_PLAN_CODES = {
  pages20: "standard",
  pages160: "pro",
  pages640: "ultimate",
} as const;

// Compatibility-only fallback for older hosted checkout links. The primary
// authenticated route resolves the current Paddle price from plan_code.
const LEGACY_PRICE_IDS = {
  pages20: "pri_01m0avr6r394qb1x3xpzy5wmys",
  pages160: "pri_01m0avr7b0btzhkf1976x1ycwr",
  pages640: "pri_01m0avr7x81s0tvb8203q0cqzx",
} as const;

function eventId(): string {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `evt_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function retryPendingSpendEvents(plugin: GardaPlugin): Promise<void> {
  for (const pending of [...(plugin.settings.pendingSpendEvents ?? [])]) {
    const result = await spendPage(plugin, pending.amount, pending.eventId);
    if (!result) break;
  }
}

export async function syncBalance(plugin: GardaPlugin, manual = false): Promise<void> {
  resumeAccountCheckout({ state: plugin.settings, appId: APP_ID, installationId: plugin.settings.constanceDeviceId,
    persist: () => plugin.saveSettings(), syncBalance: () => syncBalance(plugin), refreshSession: () => refreshBillingSession(plugin.settings, () => plugin.saveSettings()) });

  if (!plugin.settings.constanceDeviceId) return;
  if (!plugin.settings.billingAccountLinked) { if (manual) throw new Error("Connect your billing account before refreshing credits."); return; }
  try {
    let response = await requestUrl({
      url: `${BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: APP_ID, installation_id: plugin.settings.constanceDeviceId }).toString()}`, method: "GET", throw: false,
      headers: { Authorization: `Bearer ${plugin.settings.billingAccessToken}` },
    });
    if (response.status === 401 && await refreshBillingSession(plugin.settings, () => plugin.saveSettings())) {
      response = await requestUrl({
        url: `${BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: APP_ID, installation_id: plugin.settings.constanceDeviceId }).toString()}`, method: "GET", throw: false,
        headers: { Authorization: `Bearer ${plugin.settings.billingAccessToken}` },
      });
    }
    if (response.status >= 200 && response.status < 300) {
      plugin.settings.cachedBalance = Math.max(0, Number(response.json?.data?.credits?.balance) || 0);
      await plugin.saveSettings();
    } else if (manual) throw new Error("Could not refresh OCR credits. Check your connection and account, then try again.");
  } catch (error) {
    if (manual) throw error;
    console.warn("Garda: Constance balance sync failed", error);
  }
}

export async function spendPage(plugin: GardaPlugin, amount = 1, stableEventId = eventId()): Promise<boolean> {
  if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) { new Notice("Garda: sign in or create a billing account in plugin settings before starting OCR."); return false; }
  if (!Number.isInteger(amount) || amount <= 0) return false;
  plugin.settings.pendingSpendEvents = [...(plugin.settings.pendingSpendEvents ?? []), { eventId: stableEventId, amount }]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.eventId === item.eventId) === index);
  await plugin.saveSettings();
  try {
    const result = await spendAccountCredits(plugin.settings, APP_ID, plugin.settings.constanceDeviceId, stableEventId, amount, () => plugin.saveSettings());
    if (result.kind === "insufficient") {
      new Notice("Garda: no OCR credits remain. Buy credits in plugin settings.");
      plugin.settings.cachedBalance = 0;
      plugin.settings.pendingSpendEvents = plugin.settings.pendingSpendEvents.filter((item) => item.eventId !== stableEventId);
      await plugin.saveSettings();
      return false;
    }
    if (result.kind === "auth-required") { plugin.settings.billingAccessToken = ""; plugin.settings.billingRefreshToken = ""; plugin.settings.billingAccountLinked = false; await plugin.saveSettings(); new Notice("Garda: your billing session expired. Sign in again."); return false; }
    if (result.kind !== "ok") throw new Error("Authenticated credit spend could not be verified");
    plugin.settings.cachedBalance = result.balance;
    plugin.settings.pendingSpendEvents = plugin.settings.pendingSpendEvents.filter((item) => item.eventId !== stableEventId);
    await plugin.saveSettings();
    return true;
  } catch (error) {
    console.error("Garda: credit spend failed", error);
    new Notice("Garda could not verify credits. No OCR was started.");
    return false;
  }
}

export async function openCheckout(plugin: GardaPlugin, pack: keyof typeof GARDA_PLAN_CODES): Promise<void> {
  await openAccountCheckout({
    state: plugin.settings, appId: APP_ID, installationId: plugin.settings.constanceDeviceId,
    persist: () => plugin.saveSettings(), syncBalance: () => syncBalance(plugin), refreshSession: () => refreshBillingSession(plugin.settings, () => plugin.saveSettings()),
  }, GARDA_PLAN_CODES[pack]);
}
