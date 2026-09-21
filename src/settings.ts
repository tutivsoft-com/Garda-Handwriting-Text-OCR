import type { GardaSettings } from "./types";

export const DEFAULT_SETTINGS: GardaSettings = {
  backendUrl: "https://garda-handwriting-text-ocr.wexely.com",
  apiKey: "",
  constanceDeviceId: "",
  billingEmail: "",
  billingAccessToken: "",
  billingRefreshToken: "",
  billingAccountLinked: false,
  cachedBalance: 0,
  pendingSpendEvents: [],
  cache: {},
};
