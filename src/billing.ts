import {syncEntitlements} from "./constance-v2";
import { diagnostics } from "./diagnostics";
import { consumeAccountUnits } from "./account-credit-client";
import { resumeAccountCheckout } from "./billing-checkout";
import { openAccountCheckout } from "./billing-checkout";
import { Notice, requestUrl } from "obsidian";
import type GardaPlugin from "./main";
import { refreshBillingSession, spendAccountCredits, claimAccountFreeUsage } from "./constance-account";

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
  return `v2consume_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function retryPendingSpendEvents(plugin: GardaPlugin): Promise<void> {
return;
}

export async function syncBalance(plugin: GardaPlugin, manual = false): Promise<void> {
await syncEntitlements(plugin.settings,()=>plugin.saveSettings());
(plugin as any).refreshBillingSummary?.();
}

export async function spendPage(plugin: GardaPlugin, amount = 1, stableEventId = `v2consume_${eventId()}`): Promise<boolean> {
const diagnosticEnd3 = diagnostics?.start?.("billing.spendPage") ?? (() => {});
try {

  if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) { new Notice("Garda: sign in or create an account in plugin settings before starting OCR."); return false; }
  if (!Number.isInteger(amount) || amount <= 0) return false;
  plugin.settings.pendingSpendEvents = [...(plugin.settings.pendingSpendEvents ?? []), { eventId: stableEventId, amount }]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.eventId === item.eventId) === index);
  await plugin.saveSettings();
  if (stableEventId.startsWith("v2consume_")) {
    const result = await consumeAccountUnits({state: plugin.settings, appId: APP_ID, installationId: plugin.settings.constanceDeviceId, refreshSession: () => refreshBillingSession(plugin.settings, () => plugin.saveSettings())}, stableEventId, amount);
    if (result.kind === "ok" || result.kind === "insufficient") {
      plugin.settings.pendingSpendEvents = plugin.settings.pendingSpendEvents.filter(item => item.eventId !== stableEventId);
      if (result.kind === "ok") {
        plugin.settings.cachedBalance = result.balance ?? plugin.settings.cachedBalance;
        (plugin.settings as typeof plugin.settings & {cachedFreePages?: number}).cachedFreePages = result.freeRemaining;
      }
      await plugin.saveSettings();
      return await (result.kind === "ok");
    }
    new Notice("Garda: account credits could not be verified. Reconnect or retry when the connection is restored.");
    return false;
  }
  try {
    const free = await claimAccountFreeUsage(plugin.settings, APP_ID, plugin.settings.constanceDeviceId, stableEventId, amount, () => plugin.saveSettings());
    if (free.kind === "ok") {
      (plugin.settings as typeof plugin.settings & { cachedFreePages?: number }).cachedFreePages = free.remaining;
      plugin.settings.pendingSpendEvents = plugin.settings.pendingSpendEvents.filter((item) => item.eventId !== stableEventId);
      await plugin.saveSettings();
      return true;
    }
    if (free.kind !== "insufficient") {
      new Notice(free.kind === "auth-required" ? "Garda: connect your account in settings to use your free pages." : "Garda: the free allowance could not be verified. Please try again.");
      return false;
    }
    const result = await spendAccountCredits(plugin.settings, APP_ID, plugin.settings.constanceDeviceId, stableEventId, amount, () => plugin.saveSettings());
    if (result.kind === "insufficient") {
      new Notice("Garda: no OCR credits remain. Buy credits in plugin settings.");
      plugin.settings.cachedBalance = 0;
      plugin.settings.pendingSpendEvents = plugin.settings.pendingSpendEvents.filter((item) => item.eventId !== stableEventId);
      await plugin.saveSettings();
      return false;
    }
    if (result.kind === "auth-required") { plugin.settings.billingAccessToken = ""; plugin.settings.billingRefreshToken = ""; plugin.settings.billingAccountLinked = false; await plugin.saveSettings(); new Notice("Garda: your session expired. Sign in again."); return false; }
    if (result.kind !== "ok") throw new Error("Authenticated credit spend could not be verified");
    plugin.settings.cachedBalance = result.balance;
    plugin.settings.pendingSpendEvents = plugin.settings.pendingSpendEvents.filter((item) => item.eventId !== stableEventId);
    await plugin.saveSettings();
    return true;
  } catch (error) {
diagnostics.failure("billing.caught_extra_1", error);
    diagnostics?.legacy?.("error", "billing.garda_credit_spend_failed");
    new Notice("Garda could not verify credits. No OCR was started.");
    return false;
  }

} catch (diagnosticError3) { diagnostics?.failure?.("billing.spendPage", diagnosticError3); throw diagnosticError3; } finally { diagnosticEnd3(); }
}

export async function openCheckout(plugin: GardaPlugin, pack: keyof typeof GARDA_PLAN_CODES): Promise<void> {
await openAccountCheckout({state:plugin.settings,appId:"garda-handwriting-text-ocr",installationId:plugin.settings.constanceDeviceId,persist:()=>plugin.saveSettings(),syncBalance:async()=>{await syncEntitlements(plugin.settings,()=>plugin.saveSettings());(plugin as any).refreshBillingSummary?.();},refreshSession:()=>refreshBillingSession(plugin.settings,()=>plugin.saveSettings())}, typeof pack === "string" && pack.includes("010") ? "onetime-standard" : "onetime");
}
