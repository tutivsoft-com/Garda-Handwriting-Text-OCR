import { requestUrl } from "obsidian";
import type GardaPlugin from "./main";
import type { GardaJobResult, GardaPageResult } from "./types";

export const SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "heic", "webp", "pdf"]);

export function contentType(extension: string): string {
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", bmp: "image/bmp", tiff: "image/tiff", tif: "image/tiff", heic: "image/heic", webp: "image/webp", pdf: "application/pdf" } as Record<string, string>)[extension.toLowerCase()] || "application/octet-stream";
}

export async function submit(plugin: GardaPlugin, sourceId: string, hash: string, name: string, bytes: ArrayBuffer): Promise<GardaJobResult> {
  const response = await requestUrl({ url: `${plugin.settings.backendUrl}/v1/ocr/jobs`, method: "POST", throw: false, headers: { "Content-Type": "application/json", Authorization: `Bearer ${plugin.settings.apiKey}` }, body: JSON.stringify({ source_id: sourceId, content_hash: hash, filename: name, mime_type: contentType(name.split(".").pop() || ""), data: arrayBufferToBase64(bytes) }) });
  if (response.status < 200 || response.status >= 300) throw new Error(response.json?.detail || `Garda backend returned HTTP ${response.status}`);
  return response.json as GardaJobResult;
}

export async function poll(plugin: GardaPlugin, jobId: string, onProgress: (result: GardaJobResult) => void, signal: AbortSignal): Promise<GardaJobResult> {
  while (true) {
    if (signal.aborted) { await requestUrl({ url: `${plugin.settings.backendUrl}/v1/ocr/jobs/${jobId}/cancel`, method: "POST", throw: false, headers: { Authorization: `Bearer ${plugin.settings.apiKey}` } }); throw new Error("Operation cancelled."); }
    const response = await requestUrl({ url: `${plugin.settings.backendUrl}/v1/ocr/jobs/${jobId}`, method: "GET", throw: false, headers: { Authorization: `Bearer ${plugin.settings.apiKey}` } });
    if (response.status < 200 || response.status >= 300) throw new Error(`Polling failed: HTTP ${response.status}`);
    const result = response.json as GardaJobResult;
    onProgress(result);
    if (["completed", "failed", "cancelled"].includes(result.status)) return result;
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
  }
}

export function stableHash(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes); let hash = 2166136261;
  for (const byte of view) { hash ^= byte; hash = Math.imul(hash, 16777619); }
  return `${(hash >>> 0).toString(16)}-${view.byteLength}`;
}

export function arrayBufferToBase64(bytes: ArrayBuffer): string { let binary = ""; const view = new Uint8Array(bytes); for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000)); return btoa(binary); }
export function combinePages(pages: GardaPageResult[]): string { return pages.map((page) => `<!-- Garda page ${page.page} | quality: ${page.quality}${page.needsReview ? " | manual review required" : ""} -->\n${page.text}`).join("\n\n"); }
