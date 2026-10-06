import { diagnostics } from "./diagnostics";
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
 return plugin.settings.billingAccountLinked && (plugin.settings.billingAccessToken || plugin.settings.billingRefreshToken) ? null : "Connect your account in Settings to use OCR.";
}
async function verifyAccount(plugin: GardaPlugin): Promise<void> {
const diagnosticEnd1 = diagnostics?.start?.("ocr.verifyAccount") ?? (() => {});
try {

 const error=getConfigurationError(plugin); if(error) throw new Error(error);
 const send=()=>(diagnostics?.request?.("network.ocr.verifyAccount", requestUrl, {url:`https://app.tutivsoft.com/api/v1/billing/entitlements/me?app_id=garda-handwriting-text-ocr&installation_id=${encodeURIComponent(plugin.settings.constanceDeviceId)}`,headers:{Authorization:`Bearer ${plugin.settings.billingAccessToken}`},throw:false}) ?? requestUrl({url:`https://app.tutivsoft.com/api/v1/billing/entitlements/me?app_id=garda-handwriting-text-ocr&installation_id=${encodeURIComponent(plugin.settings.constanceDeviceId)}`,headers:{Authorization:`Bearer ${plugin.settings.billingAccessToken}`},throw:false}));
 if(!plugin.settings.billingAccessToken && !await refreshBillingSession(plugin.settings,()=>plugin.saveSettings())) throw new Error("Connect your account again.");
 let response=await send();
 if(response.status===401 && await refreshBillingSession(plugin.settings,()=>plugin.saveSettings())) response=await send();
 if(response.status!==200) throw new Error(`Your account could not be verified. Connect again and retry.`);

} catch (diagnosticError1) { diagnostics?.failure?.("ocr.verifyAccount", diagnosticError1); throw diagnosticError1; } finally { diagnosticEnd1(); }
}
export async function validateConnection(plugin: GardaPlugin): Promise<void> {
const diagnosticEnd2 = diagnostics?.start?.("ocr.validateConnection") ?? (() => {});
try {

 await verifyAccount(plugin); const key=await fetchRemoteApiKey();
 const response=await (diagnostics?.request?.("network.ocr.validateConnection", requestUrl, {url:"https://openrouter.ai/api/v1/key",headers:{Authorization:`Bearer ${key}`},throw:false}) ?? requestUrl({url:"https://openrouter.ai/api/v1/key",headers:{Authorization:`Bearer ${key}`},throw:false}));
 if(response.status!==200) throw new Error(`The AI connection could not be verified. Check your connection and try again.`);

} catch (diagnosticError2) { diagnostics?.failure?.("ocr.validateConnection", diagnosticError2); throw diagnosticError2; } finally { diagnosticEnd2(); }
}
function checkAbort(signal: AbortSignal): void {if(signal.aborted) throw new Error("Operation cancelled.");}
async function abortable<T>(promise: Promise<T>,signal:AbortSignal):Promise<T>{
const diagnosticEnd3 = diagnostics?.start?.("ocr.abortable") ?? (() => {});
try {

 checkAbort(signal);
 return await (new Promise((resolve,reject)=>{const cancel=()=>{ const diagnosticAction4 = () => (reject(new Error("Operation cancelled."))); return diagnostics?.run ? diagnostics.run("ocr.cancel", diagnosticAction4) : diagnosticAction4(); };signal.addEventListener("abort",diagnostics.wrap("ocr.event_1", cancel),{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener("abort",cancel));}));

} catch (diagnosticError3) { diagnostics?.failure?.("ocr.abortable", diagnosticError3); throw diagnosticError3; } finally { diagnosticEnd3(); }
}
async function imageData(bytes:ArrayBuffer):Promise<string>{
const diagnosticEnd5 = diagnostics?.start?.("ocr.imageData") ?? (() => {});
try {

 const url=URL.createObjectURL(new Blob([bytes]));
 try{const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,2400/Math.max(image.width,image.height));
 const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image processing unavailable.");ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return await (canvas.toDataURL("image/jpeg",0.82));
 }catch (caughtError2){
diagnostics.failure("ocr.caught_3", caughtError2);throw new Error("Cannot decode this image. Convert unsupported HEIC/TIFF files to PNG or JPEG first.");}finally{URL.revokeObjectURL(url);}

} catch (diagnosticError5) { diagnostics?.failure?.("ocr.imageData", diagnosticError5); throw diagnosticError5; } finally { diagnosticEnd5(); }
}
export async function transcribeDirect(plugin:GardaPlugin,name:string,bytes:ArrayBuffer,onProgress:(state:GardaJobResult)=>void,signal:AbortSignal):Promise<GardaJobResult>{
const diagnosticEnd6 = diagnostics?.start?.("ocr.transcribeDirect") ?? (() => {});
try {

 await abortable(verifyAccount(plugin),signal);const key=await abortable(fetchRemoteApiKey(),signal);
 let pdf:pdfjs.PDFDocumentProxy|undefined; let loading:pdfjs.PDFDocumentLoadingTask|undefined;const job:GardaJobResult={jobId:`local-${Date.now()}`,status:"processing",pages:[]};
 try{
 if(name.toLowerCase().endsWith(".pdf")){loading=pdfjs.getDocument({data:new Uint8Array(bytes.slice(0)),useSystemFonts:true}); pdf=await abortable(loading.promise,signal);}
 const total=pdf?.numPages??1;if(!total)throw new Error("PDF contains no pages.");
 for(let index=1;index<=total;index++){
 checkAbort(signal);job.currentPage=index;onProgress({...job,pages:[...job.pages]});
 try{let data:string;
 if(pdf){const page=await pdf.getPage(index);const size=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2,2400/Math.max(size.width,size.height))});
 const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const render=page.render({canvas,viewport});const cancel=()=>{ const diagnosticAction7 = () => (render.cancel()); return diagnostics?.run ? diagnostics.run("ocr.cancel", diagnosticAction7) : diagnosticAction7(); };signal.addEventListener("abort",diagnostics.wrap("ocr.event_4", cancel),{once:true});try{await render.promise;}finally{signal.removeEventListener("abort",cancel);page.cleanup();}data=canvas.toDataURL("image/jpeg",0.82);canvas.width=canvas.height=0;
 }else data=await abortable(imageData(bytes),signal);
 checkAbort(signal);
 const response=await abortable((diagnostics?.request?.("network.ocr.transcribeDirect", requestUrl, {url:"https://openrouter.ai/api/v1/chat/completions",method:"POST",throw:false,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:MODEL,temperature:0,messages:[{role:"user",content:[{type:"text",text:PROMPT},{type:"image_url",image_url:{url:data}}]}]})}) ?? requestUrl({url:"https://openrouter.ai/api/v1/chat/completions",method:"POST",throw:false,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:MODEL,temperature:0,messages:[{role:"user",content:[{type:"text",text:PROMPT},{type:"image_url",image_url:{url:data}}]}]})})),signal);
 if(response.status<200||response.status>=300)throw new Error(`Text extraction failed. Check your connection and try again.`);
 const content=response.json?.choices?.[0]?.message?.content;const text=(typeof content==="string"?content:Array.isArray(content)?content.map((p:any)=>p.text||"").join(""):"").trim();if(!text)throw new Error("No text was extracted. Check the document and try again.");
 const quality=text.toLowerCase().includes("[illegible]")||text.length<3?"low":text.length<20?"medium":"high";job.pages.push({page:index,totalPages:total,text,quality,needsReview:quality!=="high"});
 }catch(error){
diagnostics.failure("ocr.caught_5", error);checkAbort(signal);job.pages.push({page:index,totalPages:total,text:"",quality:"low",needsReview:true,failed:true,error:error instanceof Error?error.message:"OCR failed."});}
 onProgress({...job,pages:[...job.pages]});
 }job.status=job.pages.some(page=>!page.failed)?"completed":"failed";return await (job);
 }finally{await loading?.destroy();}

} catch (diagnosticError6) { diagnostics?.failure?.("ocr.transcribeDirect", diagnosticError6); throw diagnosticError6; } finally { diagnosticEnd6(); }
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
const diagnosticEnd8 = diagnostics?.start?.("ocr.decryptSecretEnvelope") ?? (() => {});
try {

  if (envelope.x !== "AES-256-GCM" || envelope.w !== "PBKDF2-HMAC-SHA256") {
    throw new Error(`The AI connection could not be initialized. Update the plugin or contact support.`);
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

  return await (new TextDecoder().decode(plaintext));

} catch (diagnosticError8) { diagnostics?.failure?.("ocr.decryptSecretEnvelope", diagnosticError8); throw diagnosticError8; } finally { diagnosticEnd8(); }
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
const diagnosticEnd9 = diagnostics?.start?.("ocr.fetchRemoteManifest") ?? (() => {});
try {

  const response = await (diagnostics?.request?.("network.ocr.fetchRemoteManifest", requestUrl, { url, throw: false }) ?? requestUrl({ url, throw: false }));
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`The AI connection is unavailable. Check your connection and try again.`);
  }
  return await (response.json as RemoteKeyManifest);

} catch (diagnosticError9) { diagnostics?.failure?.("ocr.fetchRemoteManifest", diagnosticError9); throw diagnosticError9; } finally { diagnosticEnd9(); }
}

async function tryDecryptManifestKey(manifest: RemoteKeyManifest, source: string): Promise<string> {
const diagnosticEnd10 = diagnostics?.start?.("ocr.tryDecryptManifestKey") ?? (() => {});
try {

  const active = selectSlot(manifest, "active");
  if (active) {
    try {
      const key = (await decryptSecretEnvelope(active.v, REMOTE_MANIFEST_PASSPHRASE)).trim();
      if (key) return await (key);
    } catch (error) {
diagnostics.failure("ocr.caught_extra_1", error);
      diagnostics?.legacy?.("warn", "ocr.garda_active_manifest_slot_failed_to_decrypt");
    }
  }

  const next = selectSlot(manifest, "next");
  if (next) {
    try {
      const key = (await decryptSecretEnvelope(next.v, REMOTE_MANIFEST_PASSPHRASE)).trim();
      if (key) return await (key);
    } catch (error) {
diagnostics.failure("ocr.caught_extra_2", error);
      diagnostics?.legacy?.("warn", "ocr.garda_next_manifest_slot_failed_to_decrypt");
    }
  }

  throw new Error("The AI connection is unavailable. Check your connection and try again.");

} catch (diagnosticError10) { diagnostics?.failure?.("ocr.tryDecryptManifestKey", diagnosticError10); throw diagnosticError10; } finally { diagnosticEnd10(); }
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
const diagnosticEnd11 = diagnostics?.start?.("ocr.fetchRemoteApiKey") ?? (() => {});
try {

  if (remoteApiKeyCache) {
    return await (remoteApiKeyCache);
  }

  try {
    const manifest = await fetchRemoteManifest(REMOTE_MANIFEST_URL);
    const key = await tryDecryptManifestKey(manifest, REMOTE_MANIFEST_URL);
    remoteApiKeyCache = key;
    return await (key);
  } catch (primaryError) {
diagnostics.failure("ocr.caught_extra_3", primaryError);
    diagnostics?.legacy?.("warn", "ocr.garda_primary_manifest_failed_trying_next_manifest_fallback");
    const primaryManifest = await fetchRemoteManifest(REMOTE_MANIFEST_URL).catch((rejectedError1) => { diagnostics.failure("ocr.rejected_2", rejectedError1); return (null); });
    const nextUrl = primaryManifest?.n;
    if (nextUrl && nextUrl !== REMOTE_MANIFEST_URL) {
      const nextManifest = await fetchRemoteManifest(nextUrl);
      const key = await tryDecryptManifestKey(nextManifest, nextUrl);
      remoteApiKeyCache = key;
      return await (key);
    }
    throw primaryError;
  }

} catch (diagnosticError11) { diagnostics?.failure?.("ocr.fetchRemoteApiKey", diagnosticError11); throw diagnosticError11; } finally { diagnosticEnd11(); }
}


export function stableHash(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes); let hash = 2166136261;
  for (const byte of view) { hash ^= byte; hash = Math.imul(hash, 16777619); }
  return `${(hash >>> 0).toString(16)}-${view.byteLength}`;
}

export function arrayBufferToBase64(bytes: ArrayBuffer): string { let binary = ""; const view = new Uint8Array(bytes); for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000)); return btoa(binary); }
/** Combine page results while retaining page and quality markers for review. */
export function combinePages(pages: GardaPageResult[]): string { return pages.map((page) => `<!-- Garda page ${page.page} | quality: ${page.quality}${page.needsReview ? " | manual review required" : ""} -->\n${page.text}`).join("\n\n"); }
