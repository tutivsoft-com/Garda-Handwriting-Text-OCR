import { requestUrl } from "obsidian";
import type GardaPlugin from "./main";
import type { GardaJobResult, GardaPageResult } from "./types";
import { refreshBillingSession } from "./constance-account";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
// @ts-ignore PDF.js worker has no published declaration; bundle it for local rendering.
import * as pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
(globalThis as any).pdfjsWorker = pdfWorker;
export const MODEL = "~openai/gpt-luna-latest";
const PROMPT = "Transcribe exactly as visible. Preserve line breaks, headings, lists, dates and punctuation. Do not summarize, correct or invent text. Use [illegible] for unreadable text. Return plain text only.";
export const SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "heic", "webp", "pdf"]);
export function getConfigurationError(plugin: GardaPlugin): string | null {
 return plugin.settings.billingAccountLinked && (plugin.settings.billingAccessToken || plugin.settings.billingRefreshToken) ? null : "Connect your billing account in settings to use OCR.";
}
async function verifyAccount(plugin: GardaPlugin): Promise<void> {
 const error=getConfigurationError(plugin); if(error) throw new Error(error);
 const send=()=>requestUrl({url:`https://app.tutivsoft.com/api/v1/billing/entitlements/me?app_id=garda-handwriting-text-ocr&installation_id=${encodeURIComponent(plugin.settings.constanceDeviceId)}`,headers:{Authorization:`Bearer ${plugin.settings.billingAccessToken}`},throw:false});
 if(!plugin.settings.billingAccessToken && !await refreshBillingSession(plugin.settings,()=>plugin.saveSettings())) throw new Error("Connect your billing account again.");
 let response=await send();
 if(response.status===401 && await refreshBillingSession(plugin.settings,()=>plugin.saveSettings())) response=await send();
 if(response.status!==200) throw new Error(`Account verification failed (HTTP ${response.status}). Try again.`);
}
export async function validateConnection(plugin: GardaPlugin): Promise<void> {
 await verifyAccount(plugin); const key=await fetchRemoteApiKey();
 const response=await requestUrl({url:"https://openrouter.ai/api/v1/key",headers:{Authorization:`Bearer ${key}`},throw:false});
 if(response.status!==200) throw new Error(`OCR provider connection failed (HTTP ${response.status}).`);
}
function checkAbort(signal: AbortSignal): void {if(signal.aborted) throw new Error("Operation cancelled.");}
async function abortable<T>(promise: Promise<T>,signal:AbortSignal):Promise<T>{
 checkAbort(signal);
 return new Promise((resolve,reject)=>{const cancel=()=>reject(new Error("Operation cancelled."));signal.addEventListener("abort",cancel,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener("abort",cancel));});
}
async function imageData(bytes:ArrayBuffer):Promise<string>{
 const url=URL.createObjectURL(new Blob([bytes]));
 try{const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,2400/Math.max(image.width,image.height));
 const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image processing unavailable.");ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL("image/jpeg",0.82);
 }catch{throw new Error("Cannot decode this image. Convert unsupported HEIC/TIFF files to PNG or JPEG first.");}finally{URL.revokeObjectURL(url);}
}
export async function transcribeDirect(plugin:GardaPlugin,name:string,bytes:ArrayBuffer,onProgress:(state:GardaJobResult)=>void,signal:AbortSignal):Promise<GardaJobResult>{
 if(bytes.byteLength>20*1024*1024)throw new Error("This file exceeds the 20 MB OCR limit.");
 await abortable(verifyAccount(plugin),signal);const key=await abortable(fetchRemoteApiKey(),signal);
 let pdf:pdfjs.PDFDocumentProxy|undefined; let loading:pdfjs.PDFDocumentLoadingTask|undefined;const job:GardaJobResult={jobId:`local-${Date.now()}`,status:"processing",pages:[]};
 try{
 if(name.toLowerCase().endsWith(".pdf")){loading=pdfjs.getDocument({data:new Uint8Array(bytes.slice(0)),useSystemFonts:true}); pdf=await abortable(loading.promise,signal);}
 const total=pdf?.numPages??1;if(!total)throw new Error("PDF contains no pages.");
 for(let index=1;index<=total;index++){
 checkAbort(signal);job.currentPage=index;onProgress({...job,pages:[...job.pages]});
 try{let data:string;
 if(pdf){const page=await pdf.getPage(index);const size=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2,2400/Math.max(size.width,size.height))});
 const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const render=page.render({canvas,viewport});const cancel=()=>render.cancel();signal.addEventListener("abort",cancel,{once:true});try{await render.promise;}finally{signal.removeEventListener("abort",cancel);page.cleanup();}data=canvas.toDataURL("image/jpeg",0.82);canvas.width=canvas.height=0;
 }else data=await abortable(imageData(bytes),signal);
 checkAbort(signal);
 const response=await abortable(requestUrl({url:"https://openrouter.ai/api/v1/chat/completions",method:"POST",throw:false,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:MODEL,temperature:0,messages:[{role:"user",content:[{type:"text",text:PROMPT},{type:"image_url",image_url:{url:data}}]}]})}),signal);
 if(response.status<200||response.status>=300)throw new Error(`OCR provider returned HTTP ${response.status}.`);
 const content=response.json?.choices?.[0]?.message?.content;const text=(typeof content==="string"?content:Array.isArray(content)?content.map((p:any)=>p.text||"").join(""):"").trim();if(!text)throw new Error("OCR provider returned no text.");
 const quality=text.toLowerCase().includes("[illegible]")||text.length<3?"low":text.length<20?"medium":"high";job.pages.push({page:index,totalPages:total,text,quality,needsReview:quality!=="high"});
 }catch(error){checkAbort(signal);job.pages.push({page:index,totalPages:total,text:"",quality:"low",needsReview:true,failed:true,error:error instanceof Error?error.message:"OCR failed."});}
 onProgress({...job,pages:[...job.pages]});
 }job.status=job.pages.some(page=>!page.failed)?"completed":"failed";return job;
 }finally{await loading?.destroy();}
}
const REMOTE_MANIFEST_PASSPHRASE = "Kivu.RemoteKeyManifest.v1.2026D";
const REMOTE_MANIFEST_URL =
  "https://raw.githubusercontent.com/tutivsoft-com/Resources/main/Garda-Handwriting-Text-OCR.txt";

interface EncryptedSecretEnvelope {
  q: number;
  x: string;
  w: string;
  n: number;
  a: string;
  b: string;
  c: string;
  d: string;
}

interface RemoteKeySlot {
  i: string;
  ii?: string;
  s: string;
  v: EncryptedSecretEnvelope;
}

interface RemoteKeyManifest {
  m: number;
  n?: string; // next manifest URL (decoy-adjacent field, same shape as the live ai1.txt)
  r: RemoteKeySlot[];
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function decryptSecretEnvelope(envelope: EncryptedSecretEnvelope, passphrase: string): Promise<string> {
  if (envelope.x !== "AES-256-GCM" || envelope.w !== "PBKDF2-HMAC-SHA256") {
    throw new Error(`Unsupported manifest envelope algorithm/kdf: ${envelope.x} / ${envelope.w}`);
  }

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(envelope.a),
      iterations: envelope.n,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const ciphertext = base64ToBytes(envelope.c);
  const tag = base64ToBytes(envelope.d);
  const ciphertextAndTag = new Uint8Array<ArrayBuffer>(new ArrayBuffer(ciphertext.length + tag.length));
  ciphertextAndTag.set(ciphertext, 0);
  ciphertextAndTag.set(tag, ciphertext.length);

  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.b) },
    key,
    ciphertextAndTag,
  );

  return new TextDecoder().decode(plaintext);
}

function selectSlot(manifest: RemoteKeyManifest, wantState: "active" | "next"): RemoteKeySlot | null {
  const byMarker = manifest.r.find((slot) => slot.ii === wantState);
  if (byMarker) {
    return byMarker;
  }
  // Fallback for manifests without the "ii" marker (matches the C# lib's
  // ActiveKeyId/State-based selection): active = state "0", next = state "1".
  const fallbackState = wantState === "active" ? "0" : "1";
  return manifest.r.find((slot) => slot.s === fallbackState) ?? null;
}

async function fetchRemoteManifest(url: string): Promise<RemoteKeyManifest> {
  const response = await requestUrl({ url, throw: false });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Manifest fetch failed: HTTP ${response.status}`);
  }
  return response.json as RemoteKeyManifest;
}

async function tryDecryptManifestKey(manifest: RemoteKeyManifest, source: string): Promise<string> {
  const active = selectSlot(manifest, "active");
  if (active) {
    try {
      const key = (await decryptSecretEnvelope(active.v, REMOTE_MANIFEST_PASSPHRASE)).trim();
      if (key) return key;
    } catch (error) {
      console.warn("Garda: active manifest slot failed to decrypt", source, error);
    }
  }

  const next = selectSlot(manifest, "next");
  if (next) {
    try {
      const key = (await decryptSecretEnvelope(next.v, REMOTE_MANIFEST_PASSPHRASE)).trim();
      if (key) return key;
    } catch (error) {
      console.warn("Garda: next manifest slot failed to decrypt", source, error);
    }
  }

  throw new Error("Remote key manifest did not decrypt to a usable key.");
}

// Cached once resolved so every AI call doesn't re-fetch the manifest; cleared implicitly
// on plugin reload (module-level state) in case the key was rotated mid-session.
let remoteApiKeyCache: string | null = null;

/**
 * Fetches and decrypts this app's own OpenRouter key from its GitHub manifest,
 * falling back to the manifest's NextManifestUrl if the primary one is
 * unreachable or fails to decrypt (key rotation / relocation support).
 */
async function fetchRemoteApiKey(): Promise<string> {
  if (remoteApiKeyCache) {
    return remoteApiKeyCache;
  }

  try {
    const manifest = await fetchRemoteManifest(REMOTE_MANIFEST_URL);
    const key = await tryDecryptManifestKey(manifest, REMOTE_MANIFEST_URL);
    remoteApiKeyCache = key;
    return key;
  } catch (primaryError) {
    console.warn("Garda: primary manifest failed, trying next-manifest fallback", primaryError);
    const primaryManifest = await fetchRemoteManifest(REMOTE_MANIFEST_URL).catch(() => null);
    const nextUrl = primaryManifest?.n;
    if (nextUrl && nextUrl !== REMOTE_MANIFEST_URL) {
      const nextManifest = await fetchRemoteManifest(nextUrl);
      const key = await tryDecryptManifestKey(nextManifest, nextUrl);
      remoteApiKeyCache = key;
      return key;
    }
    throw primaryError;
  }
}


export function stableHash(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes); let hash = 2166136261;
  for (const byte of view) { hash ^= byte; hash = Math.imul(hash, 16777619); }
  return `${(hash >>> 0).toString(16)}-${view.byteLength}`;
}

export function arrayBufferToBase64(bytes: ArrayBuffer): string { let binary = ""; const view = new Uint8Array(bytes); for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000)); return btoa(binary); }
/** Combine page results while retaining page and quality markers for review. */
export function combinePages(pages: GardaPageResult[]): string { return pages.map((page) => `<!-- Garda page ${page.page} | quality: ${page.quality}${page.needsReview ? " | manual review required" : ""} -->\n${page.text}`).join("\n\n"); }
