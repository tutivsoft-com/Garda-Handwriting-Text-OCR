var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// ../../../../Desktop/ghrepos/Garda-Handwriting-Text-OCR-public/src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GardaPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian6 = require("obsidian");

// ../../../../Desktop/ghrepos/Garda-Handwriting-Text-OCR-public/src/billing.ts
var import_obsidian2 = require("obsidian");

// ../../../../Desktop/ghrepos/Garda-Handwriting-Text-OCR-public/src/constance-account.ts
var import_obsidian = require("obsidian");
var CONSTANCE_ACCOUNT_BASE_URL = "https://app.tutivsoft.com";
function errorDetail(response, fallback) {
  var _a, _b;
  return String(((_a = response.json) == null ? void 0 : _a.detail) || ((_b = response.json) == null ? void 0 : _b.message) || response.text || fallback);
}
async function authenticate(mode, email, password, installationId) {
  var _a, _b, _c;
  const body = mode === "register" ? { email, password, external_customer_id: installationId } : { email, password };
  const response = await (0, import_obsidian.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/${mode}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorDetail(response, `Billing ${mode} failed (HTTP ${response.status})`));
  }
  const accessToken = String(((_a = response.json) == null ? void 0 : _a.access_token) || "");
  if (!accessToken) {
    if ((_b = response.json) == null ? void 0 : _b.verification_required) throw new Error("Account created. Verify the billing email, then sign in.");
    throw new Error("Constance did not return an account token.");
  }
  return { accessToken, refreshToken: String(((_c = response.json) == null ? void 0 : _c.refresh_token) || "") };
}
async function refreshBillingSession(state, persist) {
  var _a, _b;
  if (!state.billingRefreshToken) return false;
  try {
    const response = await (0, import_obsidian.requestUrl)({
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/refresh`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: state.billingRefreshToken }),
      throw: false
    });
    if (response.status < 200 || response.status >= 300) return false;
    const accessToken = String(((_a = response.json) == null ? void 0 : _a.access_token) || "");
    const refreshToken = String(((_b = response.json) == null ? void 0 : _b.refresh_token) || "");
    if (!accessToken) return false;
    state.billingAccessToken = accessToken;
    if (refreshToken) state.billingRefreshToken = refreshToken;
    if (persist) await persist();
    return true;
  } catch (error) {
    console.warn("Constance billing session refresh failed", error);
    return false;
  }
}
async function linkInstallation(adapter, token) {
  const response = await (0, import_obsidian.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/installations/link`,
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      app_id: adapter.appId,
      installation_id: adapter.installationId,
      legacy_external_customer_id: adapter.installationId,
      platform: "obsidian",
      app_version: adapter.appVersion || void 0
    }),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorDetail(response, `Installation link failed (HTTP ${response.status})`));
  }
}
async function signInBillingAccount(adapter, password, mode) {
  const email = adapter.state.billingEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid billing email.");
  if (password.length < 8) throw new Error("Password must contain at least 8 characters.");
  if (!adapter.installationId) throw new Error("The plugin installation ID is not ready.");
  let tokens;
  try {
    tokens = await authenticate(mode, email, password, adapter.installationId);
  } catch (error) {
    if (mode === "register" && error instanceof Error && error.message.startsWith("Account created. Verify")) {
      adapter.state.billingEmail = email;
      adapter.state.billingAccessToken = "";
      adapter.state.billingRefreshToken = "";
      adapter.state.billingAccountLinked = false;
      adapter.state.billingRegistrationPending = true;
      await adapter.persist();
    }
    throw error;
  }
  await linkInstallation(adapter, tokens.accessToken);
  adapter.state.billingEmail = email;
  adapter.state.billingAccessToken = tokens.accessToken;
  adapter.state.billingRefreshToken = tokens.refreshToken;
  adapter.state.billingAccountLinked = true;
  await adapter.persist();
  await adapter.syncBalance();
}
async function signOutBillingAccount(adapter) {
  const refreshToken = adapter.state.billingRefreshToken;
  const accessToken = adapter.state.billingAccessToken;
  try {
    if (refreshToken || accessToken) {
      await (0, import_obsidian.requestUrl)({
        url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/logout`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
        },
        body: JSON.stringify({ refresh_token: refreshToken || void 0 }),
        throw: false
      });
    }
  } catch (error) {
    console.warn("Constance account logout could not reach the server", error);
  } finally {
    adapter.state.billingAccessToken = "";
    adapter.state.billingRefreshToken = "";
    adapter.state.billingAccountLinked = false;
    adapter.state.billingRegistrationPending = false;
    await adapter.persist();
  }
}
async function spendAccountCredits(state, appId, installationId, eventId2, amount, persist) {
  var _a, _b, _c;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    let response = await (0, import_obsidian.requestUrl)({
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/credits/spend`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.billingAccessToken}` },
      body: JSON.stringify({ app_id: appId, installation_id: installationId, event_id: eventId2, amount }),
      throw: false
    });
    if (response.status === 401 && await refreshBillingSession(state, persist)) {
      response = await (0, import_obsidian.requestUrl)({
        url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/credits/spend`,
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.billingAccessToken}` },
        body: JSON.stringify({ app_id: appId, installation_id: installationId, event_id: eventId2, amount }),
        throw: false
      });
    }
    if (response.status === 402) return { kind: "insufficient" };
    if (response.status === 401 || response.status === 403 || response.status === 404) return { kind: "auth-required" };
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    const balance = Number((_c = (_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.credits) == null ? void 0 : _c.balance);
    return Number.isFinite(balance) ? { kind: "ok", balance: Math.max(0, balance) } : { kind: "error" };
  } catch (error) {
    console.error("Constance authenticated credit spend failed", error);
    return { kind: "error" };
  }
}
function addBillingAccountSettings(containerEl, adapter) {
  let password = "";
  new import_obsidian.Setting(containerEl).setName("Billing account email").setDesc("Used for sign-in, purchase restore, and checkout. Reinstalling no longer creates a new free allowance.").addText((text) => text.setPlaceholder("you@example.com").setValue(adapter.state.billingEmail).onChange(async (value) => {
    adapter.state.billingEmail = value.trim();
    await adapter.persist();
  }));
  new import_obsidian.Setting(containerEl).setName("Billing account password").setDesc("Used only for this sign-in request. The password is never saved by the plugin.").addText((text) => {
    text.inputEl.type = "password";
    text.setPlaceholder("At least 8 characters").onChange((value) => {
      password = value;
    });
  });
  new import_obsidian.Setting(containerEl).setName("Forgot password?").setDesc("Reset your Constance billing password in the browser.").addButton((button) => button.setButtonText("Open reset page").onClick(() => {
    window.open(`${CONSTANCE_ACCOUNT_BASE_URL}/password-reset`, "_blank", "noopener");
  }));
  const status = adapter.state.billingAccountLinked ? "Signed in and linked" : adapter.state.billingRegistrationPending ? "Check your email, click the verification link, then sign in" : "Not signed in";
  new import_obsidian.Setting(containerEl).setName("Billing account").setDesc(`${status}. The saved bearer session can restore purchases; your password is not stored.`).addButton((button) => button.setButtonText("Sign in").onClick(async () => {
    var _a;
    button.setDisabled(true);
    try {
      await signInBillingAccount(adapter, password, "login");
      new import_obsidian.Notice("Billing account signed in and this installation was linked.");
      (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
    } catch (error) {
      new import_obsidian.Notice(error instanceof Error ? error.message : "Billing sign-in failed.");
    } finally {
      button.setDisabled(false);
    }
  })).addButton((button) => button.setButtonText("Create account").onClick(async () => {
    var _a;
    button.setDisabled(true);
    try {
      await signInBillingAccount(adapter, password, "register");
      new import_obsidian.Notice("Billing account created and this installation was linked.");
      (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
    } catch (error) {
      new import_obsidian.Notice(error instanceof Error ? error.message : "Billing account creation failed.");
    } finally {
      button.setDisabled(false);
    }
  })).addButton((button) => button.setButtonText("Sign out").setDisabled(!adapter.state.billingAccessToken && !adapter.state.billingRefreshToken).onClick(async () => {
    var _a;
    await signOutBillingAccount(adapter);
    new import_obsidian.Notice("Billing account signed out on this installation.");
    (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
  }));
}

// ../../../../Desktop/ghrepos/Garda-Handwriting-Text-OCR-public/src/billing.ts
var BASE_URL = "https://app.tutivsoft.com";
var APP_ID = "garda-handwriting-text-ocr";
var GARDA_PLAN_CODES = {
  pages20: "standard",
  pages160: "pro",
  pages640: "ultimate"
};
var LEGACY_PRICE_IDS = {
  pages20: "pri_01m0avr6r394qb1x3xpzy5wmys",
  pages160: "pri_01m0avr7b0btzhkf1976x1ycwr",
  pages640: "pri_01m0avr7x81s0tvb8203q0cqzx"
};
function eventId() {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `evt_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
async function retryPendingSpendEvents(plugin) {
  var _a;
  for (const pending of [...(_a = plugin.settings.pendingSpendEvents) != null ? _a : []]) {
    const result = await spendPage(plugin, pending.amount, pending.eventId);
    if (!result) break;
  }
}
async function syncBalance(plugin) {
  var _a, _b, _c;
  if (!plugin.settings.constanceDeviceId) return;
  try {
    let response = await (0, import_obsidian2.requestUrl)({
      url: `${BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: APP_ID, installation_id: plugin.settings.constanceDeviceId }).toString()}`,
      method: "GET",
      throw: false,
      headers: { Authorization: `Bearer ${plugin.settings.billingAccessToken}` }
    });
    if (response.status === 401 && await refreshBillingSession(plugin.settings, () => plugin.saveSettings())) {
      response = await (0, import_obsidian2.requestUrl)({
        url: `${BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: APP_ID, installation_id: plugin.settings.constanceDeviceId }).toString()}`,
        method: "GET",
        throw: false,
        headers: { Authorization: `Bearer ${plugin.settings.billingAccessToken}` }
      });
    }
    if (response.status >= 200 && response.status < 300) {
      plugin.settings.cachedBalance = Math.max(0, Number((_c = (_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.credits) == null ? void 0 : _c.balance) || 0);
      await plugin.saveSettings();
    }
  } catch (error) {
    console.warn("Garda: Constance balance sync failed", error);
  }
}
async function spendPage(plugin, amount = 1, stableEventId = eventId()) {
  var _a;
  if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) {
    new import_obsidian2.Notice("Garda: sign in or create a billing account in plugin settings before starting OCR.");
    return false;
  }
  if (!Number.isInteger(amount) || amount <= 0) return false;
  plugin.settings.pendingSpendEvents = [...(_a = plugin.settings.pendingSpendEvents) != null ? _a : [], { eventId: stableEventId, amount }].filter((item, index, items) => items.findIndex((candidate) => candidate.eventId === item.eventId) === index);
  await plugin.saveSettings();
  try {
    const result = await spendAccountCredits(plugin.settings, APP_ID, plugin.settings.constanceDeviceId, stableEventId, amount, () => plugin.saveSettings());
    if (result.kind === "insufficient") {
      new import_obsidian2.Notice("Garda: no OCR credits remain. Buy credits in plugin settings.");
      plugin.settings.cachedBalance = 0;
      plugin.settings.pendingSpendEvents = plugin.settings.pendingSpendEvents.filter((item) => item.eventId !== stableEventId);
      await plugin.saveSettings();
      return false;
    }
    if (result.kind === "auth-required") {
      plugin.settings.billingAccessToken = "";
      plugin.settings.billingRefreshToken = "";
      plugin.settings.billingAccountLinked = false;
      await plugin.saveSettings();
      new import_obsidian2.Notice("Garda: your billing session expired. Sign in again.");
      return false;
    }
    if (result.kind !== "ok") throw new Error("Authenticated credit spend could not be verified");
    plugin.settings.cachedBalance = result.balance;
    plugin.settings.pendingSpendEvents = plugin.settings.pendingSpendEvents.filter((item) => item.eventId !== stableEventId);
    await plugin.saveSettings();
    return true;
  } catch (error) {
    console.error("Garda: credit spend failed", error);
    new import_obsidian2.Notice("Garda could not verify credits. No OCR was started.");
    return false;
  }
}
async function openCheckout(plugin, pack) {
  var _a, _b;
  if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) {
    new import_obsidian2.Notice("Sign in or create a billing account in Garda settings before buying credits.");
    return;
  }
  if (!plugin.settings.constanceDeviceId) {
    new import_obsidian2.Notice("Garda: the billing installation ID is not ready yet.");
    return;
  }
  const idempotencyKey = eventId();
  try {
    let response = await (0, import_obsidian2.requestUrl)({
      url: `${BASE_URL}/api/v1/billing/checkout`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${plugin.settings.billingAccessToken}`, "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ app_id: APP_ID, plan_code: GARDA_PLAN_CODES[pack], installation_id: plugin.settings.constanceDeviceId, quantity: 1, coupon_code: null }),
      throw: false
    });
    if (response.status === 401 && await refreshBillingSession(plugin.settings, () => plugin.saveSettings())) {
      response = await (0, import_obsidian2.requestUrl)({
        url: `${BASE_URL}/api/v1/billing/checkout`,
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${plugin.settings.billingAccessToken}`, "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ app_id: APP_ID, plan_code: GARDA_PLAN_CODES[pack], installation_id: plugin.settings.constanceDeviceId, quantity: 1, coupon_code: null }),
        throw: false
      });
    }
    const checkoutUrl = String(((_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.checkout_url) || "");
    if (response.status >= 200 && response.status < 300 && checkoutUrl) {
      window.open(checkoutUrl, "_blank");
      new import_obsidian2.Notice("Complete payment in the browser, then refresh Garda credits.");
      return;
    }
    if (response.status >= 200 && response.status < 300) {
      const params = new URLSearchParams({ app_id: APP_ID, price_id: LEGACY_PRICE_IDS[pack], email: plugin.settings.billingEmail.trim(), external_customer_id: plugin.settings.constanceDeviceId });
      window.open(`${BASE_URL}/buy?${params.toString()}`, "_blank");
      new import_obsidian2.Notice("Garda opened the compatibility checkout. Refresh credits after payment.");
      return;
    }
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      if (response.status === 401) {
        plugin.settings.billingAccessToken = "";
        plugin.settings.billingRefreshToken = "";
        plugin.settings.billingAccountLinked = false;
        await plugin.saveSettings();
      }
      new import_obsidian2.Notice("Garda: the billing session or installation is no longer valid. Sign in again.");
      return;
    }
    new import_obsidian2.Notice(`Garda checkout could not be started (HTTP ${response.status}). Try again later.`);
  } catch (error) {
    console.warn("Garda authenticated checkout status is unknown", error);
    new import_obsidian2.Notice("Garda could not confirm the checkout request. Check the browser/account before trying again.");
  }
}

// ../../../../Desktop/ghrepos/Garda-Handwriting-Text-OCR-public/src/ocr.ts
var import_obsidian3 = require("obsidian");
var SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set(["jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "heic", "webp", "pdf"]);
function getConfigurationError(plugin) {
  const backendUrl = plugin.settings.backendUrl.trim();
  if (!backendUrl) return "Enter the Garda backend URL in plugin settings.";
  if (!plugin.settings.apiKey.trim()) return "Enter your Garda API key in plugin settings.";
  try {
    const url = new URL(backendUrl);
    const localHttp = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && localHttp)) {
      return "The Garda backend URL must use HTTPS.";
    }
  } catch (e) {
    return "Enter a valid Garda backend URL in plugin settings.";
  }
  return null;
}
async function validateConnection(plugin) {
  const configurationError = getConfigurationError(plugin);
  if (configurationError) throw new Error(configurationError);
  const baseUrl = plugin.settings.backendUrl.trim().replace(/\/$/, "");
  const health = await (0, import_obsidian3.requestUrl)({ url: `${baseUrl}/health`, method: "GET", throw: false });
  if (health.status < 200 || health.status >= 300) throw new Error(`Garda health check failed (HTTP ${health.status}).`);
  const authProbe = await (0, import_obsidian3.requestUrl)({
    url: `${baseUrl}/v1/ocr/jobs/garda-setup-check`,
    method: "GET",
    throw: false,
    headers: { Authorization: `Bearer ${plugin.settings.apiKey.trim()}` }
  });
  if (authProbe.status === 401 || authProbe.status === 403) throw new Error("The Garda API key was rejected.");
  if (authProbe.status !== 404 && (authProbe.status < 200 || authProbe.status >= 300)) {
    throw new Error(`Garda API check failed (HTTP ${authProbe.status}).`);
  }
}
function contentType(extension) {
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", bmp: "image/bmp", tiff: "image/tiff", tif: "image/tiff", heic: "image/heic", webp: "image/webp", pdf: "application/pdf" }[extension.toLowerCase()] || "application/octet-stream";
}
async function submit(plugin, sourceId, hash, name, bytes) {
  var _a;
  const configurationError = getConfigurationError(plugin);
  if (configurationError) throw new Error(configurationError);
  const response = await (0, import_obsidian3.requestUrl)({ url: `${plugin.settings.backendUrl}/v1/ocr/jobs`, method: "POST", throw: false, headers: { "Content-Type": "application/json", Authorization: `Bearer ${plugin.settings.apiKey}` }, body: JSON.stringify({ source_id: sourceId, content_hash: hash, filename: name, mime_type: contentType(name.split(".").pop() || ""), data: arrayBufferToBase64(bytes) }) });
  if (response.status < 200 || response.status >= 300) throw new Error(((_a = response.json) == null ? void 0 : _a.detail) || `Garda backend returned HTTP ${response.status}`);
  return response.json;
}
async function poll(plugin, jobId, onProgress, signal) {
  while (true) {
    if (signal.aborted) {
      await (0, import_obsidian3.requestUrl)({ url: `${plugin.settings.backendUrl}/v1/ocr/jobs/${jobId}/cancel`, method: "POST", throw: false, headers: { Authorization: `Bearer ${plugin.settings.apiKey}` } });
      throw new Error("Operation cancelled.");
    }
    const response = await (0, import_obsidian3.requestUrl)({ url: `${plugin.settings.backendUrl}/v1/ocr/jobs/${jobId}`, method: "GET", throw: false, headers: { Authorization: `Bearer ${plugin.settings.apiKey}` } });
    if (response.status < 200 || response.status >= 300) throw new Error(`Polling failed: HTTP ${response.status}`);
    const result = response.json;
    onProgress(result);
    if (["completed", "failed", "cancelled"].includes(result.status)) return result;
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
  }
}
function stableHash(bytes) {
  const view = new Uint8Array(bytes);
  let hash = 2166136261;
  for (const byte of view) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16)}-${view.byteLength}`;
}
function arrayBufferToBase64(bytes) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 32768) binary += String.fromCharCode(...view.subarray(i, i + 32768));
  return btoa(binary);
}
function combinePages(pages) {
  return pages.map((page) => `<!-- Garda page ${page.page} | quality: ${page.quality}${page.needsReview ? " | manual review required" : ""} -->
${page.text}`).join("\n\n");
}

// ../../../../Desktop/ghrepos/Garda-Handwriting-Text-OCR-public/src/settings.ts
var DEFAULT_SETTINGS = {
  backendUrl: "https://garda-handwriting-text-ocr.wexely.com",
  apiKey: "",
  constanceDeviceId: "",
  billingEmail: "",
  billingAccessToken: "",
  billingRefreshToken: "",
  billingAccountLinked: false,
  cachedBalance: 0,
  pendingSpendEvents: [],
  cache: {}
};

// ../../../../Desktop/ghrepos/Garda-Handwriting-Text-OCR-public/src/settings-tab.ts
var import_obsidian4 = require("obsidian");
var GardaSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin", plugin);
  }
  /** Render setup guidance first, with advanced controls below the safe path. */
  display() {
    const { containerEl } = this;
    containerEl.empty();
    this.plugin.support.addDiagnosticsSetting(containerEl);
    containerEl.createEl("h2", { text: "Garda Handwriting Text OCR" });
    new import_obsidian4.Setting(containerEl).setName("Setup").setHeading();
    const setupStatus = containerEl.createEl("p", { cls: "garda-setup-status" });
    const updateSetupStatus = (message) => {
      setupStatus.textContent = message != null ? message : getConfigurationError(this.plugin) || "Configuration looks complete. Test the connection before your first scan.";
    };
    updateSetupStatus();
    new import_obsidian4.Setting(containerEl).setName("Connection").setDesc("Check the backend and API key without uploading a file.").addButton((button) => button.setButtonText("Test connection").setCta().onClick(async () => {
      button.setDisabled(true);
      updateSetupStatus("Checking Garda connection\u2026");
      try {
        await validateConnection(this.plugin);
        updateSetupStatus("Connected. Garda is ready for OCR.");
      } catch (error) {
        updateSetupStatus(error instanceof Error ? error.message : "Connection check failed.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian4.Setting(containerEl).setName("Garda backend URL").setDesc("HTTPS endpoint used for remote OCR.").addText((text) => text.setPlaceholder("https://\u2026").setValue(this.plugin.settings.backendUrl).onChange(async (value) => {
      this.plugin.settings.backendUrl = value.trim().replace(/\/$/, "");
      await this.plugin.saveSettings();
      updateSetupStatus();
    }));
    new import_obsidian4.Setting(containerEl).setName("Garda API key").setDesc("Stored in Obsidian plugin data and sent only to the configured Garda backend.").addText((text) => {
      text.inputEl.type = "password";
      text.setPlaceholder("garda-...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        await this.plugin.saveSettings();
        updateSetupStatus();
      });
    });
    addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "garda-handwriting-text-ocr", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
    new import_obsidian4.Setting(containerEl).setName("OCR credits").setDesc(`Available credits: ${this.plugin.settings.cachedBalance}`).addButton((button) => button.setButtonText("Refresh").onClick(() => {
      void syncBalance(this.plugin).then(() => this.display());
    }));
    new import_obsidian4.Setting(containerEl).setName("20-page pack").setDesc("$1 one-time purchase").addButton((button) => button.setButtonText("Buy").setCta().onClick(() => {
      void openCheckout(this.plugin, "pages20");
    }));
    new import_obsidian4.Setting(containerEl).setName("160-page pack").setDesc("$5 one-time purchase").addButton((button) => button.setButtonText("Buy").setCta().onClick(() => {
      void openCheckout(this.plugin, "pages160");
    }));
    new import_obsidian4.Setting(containerEl).setName("640-page pack").setDesc("$15 one-time purchase").addButton((button) => button.setButtonText("Buy").setCta().onClick(() => {
      void openCheckout(this.plugin, "pages640");
    }));
    new import_obsidian4.Setting(containerEl).setName("Privacy").setHeading();
    containerEl.createEl("p", { text: "OCR uploads the selected vault file to the configured Garda backend, which sends the page to its configured OCR model. Garda does not train models on images, text, or metadata, does not collect unrelated telemetry, and deletes uploaded data and derived page images after the configured retention window. The original vault file is never modified unless you explicitly choose Replace embed." });
    containerEl.createEl("p", { text: "The OCR model is selected by the Garda backend. Each processed page consumes one Constance OCR credit." });
  }
};

// ../../../../Desktop/ghrepos/Garda-Handwriting-Text-OCR-public/src/plugin-support.ts
var import_obsidian5 = require("obsidian");
var SAFE_DETAIL_KEYS = /* @__PURE__ */ new Set([
  "version",
  "operation",
  "scope",
  "selectedCount",
  "total",
  "changed",
  "skipped",
  "failed",
  "unchanged",
  "reviewEnabled",
  "fieldCount",
  "noteChars",
  "httpStatus",
  "errorType",
  "outcome",
  "restored",
  "authorizationSource",
  "cancelled",
  "line",
  "column",
  "settingCount",
  "attempt",
  "attempts",
  "queueCount",
  "itemCount",
  "fileCount",
  "imageCount",
  "stage",
  "category",
  "status",
  "durationMs",
  "elapsedMs"
]);
function safeString(value) {
  if (value.length <= 120 && /^[A-Za-z0-9 _=.,:-]*$/.test(value) && !/(?:sk-[A-Za-z0-9]|bearer|api.?key|token|secret)/i.test(value)) {
    return value;
  }
  return "[omitted]";
}
function safeDetail(value) {
  if (value instanceof Error) return JSON.stringify({ errorType: safeString(value.name || "Error") });
  if (!value || typeof value !== "object" || Array.isArray(value)) return "[detail omitted]";
  const safe = {};
  for (const [key, item] of Object.entries(value)) {
    if (!SAFE_DETAIL_KEYS.has(key)) continue;
    if (typeof item === "string") safe[key] = safeString(item);
    else if (typeof item === "number" && Number.isFinite(item)) safe[key] = item;
    else if (typeof item === "boolean" || item === null) safe[key] = item;
  }
  return JSON.stringify(safe);
}
function safeErrorType(error) {
  if (error instanceof Error) return safeString(error.name || "Error");
  return safeString(typeof error);
}
var DocumentationModal = class extends import_obsidian5.Modal {
  constructor(app, docs) {
    super(app);
    __publicField(this, "docs", docs);
  }
  onOpen() {
    this.titleEl.setText(this.docs.name + " documentation");
    this.contentEl.createEl("p", { text: this.docs.summary });
    const addSection = (title, items) => {
      this.contentEl.createEl("h3", { text: title });
      const list = this.contentEl.createEl("ol");
      for (const item of items) list.createEl("li", { text: item });
    };
    addSection("Quick start", this.docs.quickStart);
    addSection("Useful commands", Array.from(/* @__PURE__ */ new Set([...this.docs.commands, "Copy full debug log"])));
    addSection("Troubleshooting", this.docs.troubleshooting);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var PluginSupport = class {
  constructor(plugin, docs) {
    __publicField(this, "plugin", plugin);
    __publicField(this, "docs", docs);
    __publicField(this, "entries", []);
    __publicField(this, "maxEntries", 1e3);
    __publicField(this, "droppedEntries", 0);
    __publicField(this, "started", false);
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.info("plugin.loaded", { version: this.plugin.manifest.version });
    this.plugin.registerDomEvent(window, "error", (event) => {
      const error = event.error;
      this.error("runtime.error", {
        errorType: error instanceof Error ? error.name : "ErrorEvent",
        line: event.lineno,
        column: event.colno
      });
    });
    this.plugin.registerDomEvent(window, "unhandledrejection", (event) => {
      this.error("runtime.unhandled_rejection", { errorType: safeErrorType(event.reason) });
    });
    const addCommand = this.plugin.addCommand.bind(this.plugin);
    const registerCommand = (command) => addCommand(this.instrumentCommand(command));
    registerCommand({
      id: "open-documentation",
      name: "Open documentation",
      callback: () => new DocumentationModal(this.plugin.app, this.docs).open()
    });
    registerCommand({
      id: "copy-debug-log",
      name: "Copy full debug log",
      callback: () => this.copyDiagnostics()
    });
    registerCommand({
      id: "open-plugin-settings",
      name: "Open plugin settings",
      callback: () => {
        const setting = this.plugin.app.setting;
        setting == null ? void 0 : setting.open();
        setting == null ? void 0 : setting.openTabById(this.plugin.manifest.id);
      }
    });
    this.instrumentFutureCommands(addCommand);
  }
  info(event, detail) {
    this.record("info", event, detail);
  }
  warn(event, detail) {
    this.record("warn", event, detail);
  }
  error(event, detail) {
    this.record("error", event, detail);
  }
  addDiagnosticsSetting(containerEl) {
    new import_obsidian5.Setting(containerEl).setName("Diagnostics").setDesc("Copy up to the latest 1,000 events recorded by this plugin. Logs reset when the plugin reloads. Note contents, paths, credentials, and raw error messages are excluded.").addButton((button) => button.setButtonText("Copy full log").onClick(() => {
      void this.copyDiagnostics();
    }));
  }
  instrumentFutureCommands(addCommand) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(this.plugin, "addCommand");
    Object.defineProperty(this.plugin, "addCommand", {
      configurable: true,
      writable: true,
      value: (command) => addCommand(this.instrumentCommand(command))
    });
    this.plugin.register(() => {
      if (originalDescriptor) Object.defineProperty(this.plugin, "addCommand", originalDescriptor);
      else Reflect.deleteProperty(this.plugin, "addCommand");
    });
  }
  instrumentCommand(command) {
    const instrument = (callback) => (...args) => this.trackCommand(command.id, () => callback.apply(command, args));
    return {
      ...command,
      callback: command.callback ? instrument(command.callback) : void 0,
      editorCallback: command.editorCallback ? instrument(command.editorCallback) : void 0,
      checkCallback: command.checkCallback ? (checking) => checking ? command.checkCallback(checking) : this.trackCommand(command.id, () => command.checkCallback(checking)) : void 0,
      editorCheckCallback: command.editorCheckCallback ? (checking, editor, context) => checking ? command.editorCheckCallback(checking, editor, context) : this.trackCommand(command.id, () => command.editorCheckCallback(checking, editor, context)) : void 0
    };
  }
  trackCommand(commandId, action) {
    const startedAt = Date.now();
    this.info("command.started", { operation: commandId });
    try {
      const result = action();
      if (result && typeof result.then === "function") {
        return Promise.resolve(result).then(
          (value) => {
            this.info("command.completed", { operation: commandId, durationMs: Date.now() - startedAt });
            return value;
          },
          (error) => {
            this.error("command.failed", { operation: commandId, errorType: safeErrorType(error), durationMs: Date.now() - startedAt });
            throw error;
          }
        );
      }
      this.info("command.completed", { operation: commandId, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      this.error("command.failed", { operation: commandId, errorType: safeErrorType(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }
  record(level, event, detail) {
    var _a;
    const safeEvent = /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(event) ? event : "invalid_event";
    const entry = { at: (/* @__PURE__ */ new Date()).toISOString(), level, event: safeEvent };
    if (detail !== void 0) entry.detail = safeDetail(detail);
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      const removed = this.entries.length - this.maxEntries;
      this.entries.splice(0, removed);
      this.droppedEntries += removed;
    }
    const method = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    method.call(console, "[" + this.docs.name + "] " + entry.event, (_a = entry.detail) != null ? _a : "");
  }
  async copyDiagnostics() {
    this.info("diagnostics.copy_requested", { total: this.entries.length + 1 });
    const captured = (/* @__PURE__ */ new Date()).toISOString();
    const snapshot = this.entries.slice();
    const header = [
      "Plugin debug log",
      "Log scope: this plugin, since its most recent load",
      "Plugin: " + this.docs.name,
      "Plugin ID: " + this.plugin.manifest.id,
      "Version: " + this.plugin.manifest.version,
      "Captured: " + captured,
      "User agent: " + navigator.userAgent,
      "Events included: " + snapshot.length,
      "Older events omitted: " + this.droppedEntries,
      ""
    ];
    const text = header.concat(snapshot.map(
      (entry) => entry.at + " [" + entry.level.toUpperCase() + "] " + entry.event + (entry.detail ? " \u2014 " + entry.detail : "")
    )).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      this.info("diagnostics.copy_succeeded", { total: snapshot.length });
      const omitted = this.droppedEntries ? "; " + this.droppedEntries + " older events omitted" : "";
      new import_obsidian5.Notice(this.docs.name + ": copied " + snapshot.length + " log events" + omitted + ".");
    } catch (error) {
      this.error("diagnostics.copy_failed", { errorType: safeErrorType(error) });
      new import_obsidian5.Notice(this.docs.name + ": could not copy the debug log.");
    }
  }
};

// ../../../../Desktop/ghrepos/Garda-Handwriting-Text-OCR-public/src/main.ts
var GardaPlugin = class extends import_obsidian6.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "support");
    __publicField(this, "abortController", null);
    __publicField(this, "activeOperation", null);
    __publicField(this, "batchCancelRequested", false);
    __publicField(this, "progressNotice", null);
  }
  /** Register commands and menus, then load settings without starting a scan. */
  async onload() {
    var _a;
    this.support = new PluginSupport(this, { name: "Garda Handwriting Text OCR", summary: "Extract text from supported images and PDFs into your notes.", quickStart: ["Sign in to billing in Settings.", "Open or select a supported attachment.", "Choose an OCR destination command."], commands: ["Extract to clipboard", "Append to current note", "Batch extract folder"], troubleshooting: ["Use Copy debug log before reporting a problem.", "Check the attachment type and active billing balance."] });
    this.support.start();
    const stored = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored, { cache: { ...DEFAULT_SETTINGS.cache, ...(_a = stored == null ? void 0 : stored.cache) != null ? _a : {} } });
    if (!this.settings.constanceDeviceId) {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      this.settings.constanceDeviceId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      await this.saveSettings();
    }
    this.settings.billingAccessToken = typeof this.settings.billingAccessToken === "string" ? this.settings.billingAccessToken : "";
    this.settings.billingRefreshToken = typeof this.settings.billingRefreshToken === "string" ? this.settings.billingRefreshToken : "";
    this.settings.billingAccountLinked = this.settings.billingAccountLinked === true && Boolean(this.settings.billingAccessToken);
    this.settings.pendingSpendEvents = Array.isArray(this.settings.pendingSpendEvents) ? this.settings.pendingSpendEvents.filter((item) => item && typeof item.eventId === "string" && Number.isInteger(item.amount) && item.amount > 0) : [];
    await this.saveSettings();
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof import_obsidian6.TFile && this.isSupported(file)) this.addFileActions(menu, file);
      if (file instanceof import_obsidian6.TFolder) this.addFolderAction(menu, file);
    }));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => {
      const target = this.embedAtCursor(editor);
      if (target) this.addEditorActions(menu, target);
    }));
    this.addCommand({ id: "extract-to-clipboard", name: "Extract handwriting to clipboard", callback: () => this.runActive("clipboard") });
    this.addCommand({ id: "append-to-current-note", name: "Append handwriting to current note", callback: () => this.runActive("append") });
    this.addCommand({ id: "replace-embed-with-text", name: "Replace handwriting embed with text", callback: () => this.runActive("replace") });
    this.addCommand({ id: "extract-to-new-note", name: "Extract handwriting to new note", callback: () => this.runActive("new-note") });
    this.addCommand({ id: "batch-extract-folder", name: "Batch extract folder", callback: () => {
      var _a2;
      const folder = (_a2 = this.app.workspace.getActiveFile()) == null ? void 0 : _a2.parent;
      if (folder) return this.runFolder(folder);
    } });
    this.addCommand({ id: "cancel-active-operation", name: "Cancel active OCR or batch", callback: () => this.cancelActiveOperation() });
    this.addSettingTab(new GardaSettingTab(this.app, this));
    void syncBalance(this).then(() => retryPendingSpendEvents(this));
  }
  onunload() {
    var _a, _b;
    (_a = this.abortController) == null ? void 0 : _a.abort();
    (_b = this.progressNotice) == null ? void 0 : _b.hide();
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  isSupported(file) {
    return SUPPORTED_EXTENSIONS.has(file.extension.toLowerCase());
  }
  embedAtCursor(editor) {
    var _a, _b;
    if (!editor) return null;
    const source = this.app.workspace.getActiveFile();
    if (!source) return null;
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const embeds = /!\[[^\]]*\]\(([^)]+)\)|!\[\[([^\]]+)\]\]/g;
    let match;
    while (match = embeds.exec(line)) {
      const start = match.index;
      const end = start + match[0].length;
      if (cursor.ch < start || cursor.ch > end) continue;
      const linkpath = ((_b = (_a = match[1]) != null ? _a : match[2]) != null ? _b : "").trim().replace(/^<|>$/g, "").split("|")[0].split("#")[0].split("?")[0].trim();
      if (!linkpath) return null;
      let decodedLinkpath;
      try {
        decodedLinkpath = decodeURIComponent(linkpath);
      } catch (e) {
        return null;
      }
      const file = this.app.metadataCache.getFirstLinkpathDest(decodedLinkpath, source.path);
      if (!(file instanceof import_obsidian6.TFile) || !this.isSupported(file)) return null;
      return { file, editor, from: { line: cursor.line, ch: start }, to: { line: cursor.line, ch: end }, text: match[0] };
    }
    return null;
  }
  addFileActions(menu, file) {
    var _a;
    const replacement = this.embedAtCursor((_a = this.app.workspace.activeEditor) == null ? void 0 : _a.editor);
    const actions = [["Transcribe to clipboard", "clipboard"], ["Append transcription to current note", "append"], ["Create transcription note", "new-note"]];
    if ((replacement == null ? void 0 : replacement.file.path) === file.path) actions.splice(2, 0, ["Replace embed at cursor", "replace"]);
    actions.forEach(([title, action]) => menu.addItem((item) => item.setTitle(`Garda: ${title}`).onClick(() => {
      void this.run(file, action, action === "replace" ? replacement != null ? replacement : void 0 : void 0);
    })));
  }
  addEditorActions(menu, target) {
    const actions = [["Transcribe to clipboard", "clipboard"], ["Append transcription to current note", "append"], ["Replace embed at cursor", "replace"], ["Create transcription note", "new-note"]];
    actions.forEach(([title, action]) => menu.addItem((item) => item.setTitle(`Garda: ${title}`).onClick(() => {
      void this.run(target.file, action, action === "replace" ? target : void 0);
    })));
  }
  addFolderAction(menu, folder) {
    menu.addItem((item) => item.setTitle("Garda: Batch extract folder").onClick(() => {
      void this.runFolder(folder);
    }));
  }
  async runActive(action) {
    var _a;
    if (action === "replace") {
      const target = this.embedAtCursor((_a = this.app.workspace.activeEditor) == null ? void 0 : _a.editor);
      if (!target) {
        new import_obsidian6.Notice("Garda: place the cursor inside a supported image or PDF embed first.");
        return;
      }
      await this.run(target.file, action, target);
      return;
    }
    const file = this.app.workspace.getActiveFile();
    if (!file || !this.isSupported(file)) {
      new import_obsidian6.Notice("Garda: select a supported image or PDF file.");
      return;
    }
    await this.run(file, action);
  }
  /** Run one OCR action and either create a transcript or replace its embed target. */
  async run(file, action, replacement) {
    var _a;
    if (this.activeOperation) {
      new import_obsidian6.Notice("Garda: another OCR operation is already running.");
      return;
    }
    const destination = action === "append" ? (_a = this.app.workspace.getActiveViewOfType(import_obsidian6.MarkdownView)) == null ? void 0 : _a.file : null;
    if (action === "append" && (!destination || destination.extension.toLowerCase() !== "md")) {
      new import_obsidian6.Notice("Garda: open a Markdown note before appending a transcription.");
      return;
    }
    this.activeOperation = "single";
    try {
      if (action === "replace" && (!replacement || replacement.file.path !== file.path)) throw new Error("Place the cursor inside the embed you want to replace.");
      const result = await this.transcribe(file, (state) => this.updateProgress(`Garda: ${file.name} \u2014 ${state.currentPage ? `processing page ${state.currentPage}` : state.status}...`));
      const text = combinePages(result.pages);
      if (result.pages.some((page) => page.needsReview)) new import_obsidian6.Notice("Garda: low-confidence pages require manual review before destructive actions.");
      if (action === "replace" && result.pages.some((page) => page.needsReview)) return;
      if (action === "clipboard") await navigator.clipboard.writeText(text);
      else if (action === "append") {
        if (!destination) throw new Error("No Markdown note is open.");
        await this.app.vault.append(destination, `

${text}
`);
      } else if (action === "new-note") await this.createTranscriptNote(file, text);
      else {
        if (!replacement) throw new Error("Place the cursor inside the embed you want to replace.");
        const currentLine = replacement.editor.getLine(replacement.from.line);
        if (currentLine.slice(replacement.from.ch, replacement.to.ch) !== replacement.text) throw new Error("The embed changed while OCR was running. Nothing was replaced.");
        replacement.editor.replaceRange(text, replacement.from, replacement.to);
      }
      new import_obsidian6.Notice(`Garda extracted ${result.pages.length} page(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "OCR failed.";
      new import_obsidian6.Notice(`Garda: ${message}`);
    } finally {
      this.activeOperation = null;
      this.batchCancelRequested = false;
      this.clearProgress();
    }
  }
  /** Submit a file, poll until completion, and surface progress to the notice UI. */
  async transcribe(file, onProgress) {
    const bytes = await this.app.vault.readBinary(file);
    if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("This file exceeds the 20 MB OCR limit.");
    const hash = stableHash(bytes);
    const key = `${file.path}:${hash}`;
    const cached = this.settings.cache[key];
    if (cached) return { jobId: "cache", status: "completed", pages: cached.map((page) => ({ ...page, totalPages: cached.length })) };
    if (!this.settings.billingAccountLinked || !this.settings.billingAccessToken) {
      throw new Error("Sign in to your billing account in Garda settings before starting OCR.");
    }
    const controller = new AbortController();
    this.abortController = controller;
    try {
      const job = await submit(this, file.path, hash, file.name, bytes);
      const result = await poll(this, job.jobId, (state) => onProgress == null ? void 0 : onProgress(state), controller.signal);
      if (result.status !== "completed") throw new Error(result.error || "OCR job failed.");
      const successfulPages = result.pages.filter((page) => !page.failed);
      if (successfulPages.length === 0) throw new Error("OCR returned no usable pages.");
      if (!await spendPage(this, successfulPages.length)) throw new Error("OCR credits are unavailable for this document.");
      this.settings.cache[key] = result.pages;
      await this.saveSettings();
      return result;
    } finally {
      if (this.abortController === controller) this.abortController = null;
    }
  }
  /** OCR each supported file in a folder and create one transcript note per source. */
  async runFolder(folder) {
    const files = folder.children.filter((child) => child instanceof import_obsidian6.TFile && this.isSupported(child));
    if (!files.length) {
      new import_obsidian6.Notice("Garda: no supported files in this folder.");
      return;
    }
    if (this.activeOperation) {
      new import_obsidian6.Notice("Garda: another OCR operation is already running.");
      return;
    }
    this.activeOperation = "batch";
    this.batchCancelRequested = false;
    let completed = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        if (this.batchCancelRequested) break;
        const file = files[i];
        this.updateProgress(`Garda batch ${i + 1}/${files.length}: ${file.name}`);
        try {
          const result = await this.transcribe(file, (state) => this.updateProgress(`Garda batch ${i + 1}/${files.length}: ${file.name} \u2014 ${state.currentPage ? `processing page ${state.currentPage}` : state.status}...`));
          await this.createTranscriptNote(file, combinePages(result.pages));
          completed++;
        } catch (error) {
          if (this.batchCancelRequested || error instanceof Error && error.message === "Operation cancelled.") break;
          console.error(`Garda batch failed for ${file.path}`, error);
        }
      }
      new import_obsidian6.Notice(this.batchCancelRequested ? `Garda batch cancelled after ${completed}/${files.length} file(s).` : `Garda batch complete: ${completed}/${files.length} file(s).`);
    } finally {
      this.activeOperation = null;
      this.batchCancelRequested = false;
      this.clearProgress();
    }
  }
  async createTranscriptNote(file, text) {
    const base = `${file.path.replace(/\.[^.]+$/, "")}.transcription`;
    let path = `${base}.md`;
    for (let suffix = 2; this.app.vault.getAbstractFileByPath(path); suffix++) path = `${base}-${suffix}.md`;
    return this.app.vault.create(path, `# Transcription: ${file.basename}

${text}
`);
  }
  cancelActiveOperation() {
    var _a;
    if (!this.activeOperation) {
      new import_obsidian6.Notice("Garda: no active OCR operation.");
      return;
    }
    this.batchCancelRequested = true;
    (_a = this.abortController) == null ? void 0 : _a.abort();
    new import_obsidian6.Notice(this.activeOperation === "batch" ? "Garda: batch cancellation requested." : "Garda: cancellation requested.");
  }
  updateProgress(message) {
    if (!this.progressNotice) this.progressNotice = new import_obsidian6.Notice(message, 0);
    else this.progressNotice.setMessage(message);
  }
  clearProgress() {
    var _a;
    (_a = this.progressNotice) == null ? void 0 : _a.hide();
    this.progressNotice = null;
  }
};
