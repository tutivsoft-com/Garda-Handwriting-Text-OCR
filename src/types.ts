export interface GardaSettings {
  backendUrl: string;
  apiKey: string;
  constanceDeviceId: string;
  billingEmail: string;
  billingAccessToken: string;
  billingAccountLinked: boolean;
  cachedBalance: number;
  pendingSpendEvents: Array<{ eventId: string; amount: number }>;
  cache: Record<string, CachedPage[]>;
}

export interface CachedPage {
  page: number;
  text: string;
  quality: "high" | "medium" | "low";
  needsReview: boolean;
  failed?: boolean;
  error?: string;
}

export interface GardaPageResult extends CachedPage {
  page: number;
  totalPages: number;
}

export interface GardaJobResult {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  pages: GardaPageResult[];
  currentPage?: number;
  error?: string;
}
