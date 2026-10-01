import { gatewayFor, managedText } from "./preview-gateway";
import { requestUrl } from "obsidian";
import type GardaPlugin from "./main";
import type { GardaJobResult, GardaPageResult } from "./types";
import { refreshBillingSession } from "./constance-account";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
// @ts-ignore PDF.js worker has no published declaration; bundle it for local rendering.
import * as pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
(globalThis as any).pdfjsWorker = pdfWorker;
export const MODEL = "deepseek/deepseek-v4-flash-vision-exp";
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
export async function validateConnection(plugin: GardaPlugin): Promise<void> { await verifyAccount(plugin); }
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
 const text=await abortable(managedText(gatewayFor(plugin.settings),"","ocr",{pages:1},data),signal);
 if(!text)throw new Error("OCR returned no text.");
 const quality=text.toLowerCase().includes("[illegible]")||text.length<3?"low":text.length<20?"medium":"high";job.pages.push({page:index,totalPages:total,text,quality,needsReview:quality!=="high"});
 }catch(error){checkAbort(signal);job.pages.push({page:index,totalPages:total,text:"",quality:"low",needsReview:true,failed:true,error:error instanceof Error?error.message:"OCR failed."});}
 onProgress({...job,pages:[...job.pages]});
 }job.status=job.pages.some(page=>!page.failed)?"completed":"failed";return job;
 }finally{await loading?.destroy();}
}
export function stableHash(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes); let hash = 2166136261;
  for (const byte of view) { hash ^= byte; hash = Math.imul(hash, 16777619); }
  return `${(hash >>> 0).toString(16)}-${view.byteLength}`;
}

export function arrayBufferToBase64(bytes: ArrayBuffer): string { let binary = ""; const view = new Uint8Array(bytes); for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000)); return btoa(binary); }
/** Combine page results while retaining page and quality markers for review. */
export function combinePages(pages: GardaPageResult[]): string { return pages.map((page) => `<!-- Garda page ${page.page} | quality: ${page.quality}${page.needsReview ? " | manual review required" : ""} -->\n${page.text}`).join("\n\n"); }
