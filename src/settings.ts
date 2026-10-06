import type { GardaSettings } from "./types";

export const DEFAULT_SETTINGS: GardaSettings = {
  settingsMode: "simple",
  debugLogging: false,
  constanceDeviceId: "",
  billingEmail: "",
  billingAccessToken: "",
  billingRefreshToken: "",
  billingAccountLinked: false,
  cachedBalance: 0,
  pendingSpendEvents: [],
  cache: {},
};
