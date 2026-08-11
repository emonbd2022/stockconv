import { ImageMagick, MagickFormat, initializeImageMagick, MagickColor, AlphaAction } from '@imagemagick/magick-wasm';
import magickWasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';

let initialized = false;
let initializing: Promise<void> | null = null;

export const initMagick = async () => {
  if (initialized) return;
  if (initializing) return initializing;
  
  initializing = (async () => {
    try {
      console.log("[MagickInit] Starting initialization...");
      const wasmUrl = new URL(magickWasmUrl, import.meta.url).href;
      console.log("[MagickInit] Resolving WASM URL:", wasmUrl);
      
      let wasmData = null;
      
      if ('caches' in window) {
        console.log("[MagickInit] Cache API is supported.");
        try {
          console.log("[MagickInit] Opening cache 'magick-wasm-cache-v1'...");
          const cache = await caches.open('magick-wasm-cache-v1');
          
          console.log("[MagickInit] Checking cache for:", wasmUrl);
          let response = await cache.match(wasmUrl);
          
          if (!response) {
            console.log("[MagickInit] Not found in cache. Attempting to fetch...");
            response = await fetch(wasmUrl);
            console.log("[MagickInit] Fetch response status:", response.status, response.ok);
            
            if (response.ok) {
              console.log("[MagickInit] Fetch successful, putting in cache...");
              await cache.put(wasmUrl, response.clone());
              console.log("[MagickInit] Saved to cache.");
            } else {
              console.error("[MagickInit] Fetch failed with status:", response.status, response.statusText);
            }
          } else {
            console.log("[MagickInit] Loaded ImageMagick WASM from cache!");
          }
          
          if (response && response.ok) {
            console.log("[MagickInit] Converting response to ArrayBuffer...");
            const arrayBuffer = await response.arrayBuffer();
            console.log("[MagickInit] ArrayBuffer size (bytes):", arrayBuffer.byteLength);
            wasmData = new Uint8Array(arrayBuffer);
          }
        } catch (cacheErr) {
          console.error("[MagickInit] Cache API or fetch failed:", cacheErr);
        }
      } else {
        console.warn("[MagickInit] Caches API is NOT available in this environment.");
      }
      
      if (wasmData) {
        console.log("[MagickInit] Calling initializeImageMagick() with ArrayBuffer payload...");
        await initializeImageMagick(wasmData);
        console.log("[MagickInit] initializeImageMagick(wasmData) succeeded.");
      } else {
        console.log("[MagickInit] Calling initializeImageMagick() with URL fallback...");
        await initializeImageMagick(new URL(magickWasmUrl, import.meta.url));
        console.log("[MagickInit] initializeImageMagick(URL) succeeded.");
      }
      
      initialized = true;
      console.log("[MagickInit] Full initialization sequence complete.");
    } catch (err) {
      console.error("[MagickInit] FATAL ERROR during initialization:", err);
      throw err;
    }
  })();
  
  return initializing;
};

export const convertImage = async (file: File, creatorName?: string): Promise<Blob> => {
  await initMagick();
  
  const buffer = new Uint8Array(await file.arrayBuffer());
  
  return new Promise((resolve, reject) => {
    try {
      ImageMagick.read(buffer, (img) => {
        try {
          // Handle input format -> output format
        const isPng = file.type === 'image/png' || img.format === MagickFormat.Png;
        const targetFormat = isPng ? MagickFormat.Jpeg : MagickFormat.Png;
        
        // 1. READ METADATA & STORE METADATA OBJECT
        const attributes: Record<string, string> = {};
        for (const attr of img.attributeNames) {
          const val = img.getAttribute(attr);
          if (val) attributes[attr] = val;
        }
        
        const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        
        // Update Creator if provided
        if (creatorName) {
          attributes['Author'] = creatorName;
          attributes['Creator'] = creatorName;
          img.setAttribute('Author', creatorName);
        }
        
        // Check if XMP profile exists
        let hasXmp = img.hasProfile('xmp');
        let xmpStr = '';
        
        if (hasXmp) {
            const xmpProfile = img.getProfile('xmp');
            if (xmpProfile) {
                xmpStr = new TextDecoder().decode(xmpProfile.data);
            }
        }
        
        let modifiedXmp = false;
        let rdfToInject = '';
        
        if (targetFormat === MagickFormat.Jpeg) {
            const rawGuid = attributes['Digital Image GUID'] || attributes['ImageUniqueID'];
            if (rawGuid) {
                const guid = escapeXml(rawGuid);
                
                if (!xmpStr.includes(guid) && !xmpStr.includes('xmpMM:DocumentID')) {
                    rdfToInject += `\n      <xmpMM:DocumentID>${guid}</xmpMM:DocumentID>\n      <xmpMM:InstanceID>${guid}</xmpMM:InstanceID>`;
                }
            }
            const rawSource = attributes['Digital Source Type'] || attributes['DigitalSourceType'];
            if (rawSource) {
                const sourceType = escapeXml(rawSource);
                
                if (!xmpStr.includes(sourceType) && !xmpStr.includes('iptcExt:DigitalSourceType')) {
                    rdfToInject += `\n      <iptcExt:DigitalSourceType>${sourceType}</iptcExt:DigitalSourceType>`;
                }
            }
            
            if (!hasXmp) {
                // If no XMP, also migrate other text chunks over so they aren't lost
                if (attributes['Author'] || attributes['Creator']) {
                    const creator = escapeXml(attributes['Author'] || attributes['Creator'] || '');
                    rdfToInject += `\n      <dc:creator><rdf:Seq><rdf:li>${creator}</rdf:li></rdf:Seq></dc:creator>`;
                }
                if (attributes['Description']) {
                    rdfToInject += `\n      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(attributes['Description'])}</rdf:li></rdf:Alt></dc:description>`;
                }
                if (attributes['Title']) {
                    rdfToInject += `\n      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(attributes['Title'])}</rdf:li></rdf:Alt></dc:title>`;
                }
                if (attributes['Copyright']) {
                    rdfToInject += `\n      <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(attributes['Copyright'])}</rdf:li></rdf:Alt></dc:rights>`;
                }
                if (attributes['Comment']) {
                    rdfToInject += `\n      <pdf:Subject>${escapeXml(attributes['Comment'])}</pdf:Subject>`;
                }
                if (attributes['Creation Time']) {
                    rdfToInject += `\n      <xmp:CreateDate>${escapeXml(attributes['Creation Time'])}</xmp:CreateDate>`;
                }
            }
        }
        
        // Apply Creator Patch
        if (creatorName) {
            const newCreator = escapeXml(creatorName);
            if (hasXmp && xmpStr) {
                const creatorRegex = /(<dc:creator>\s*<rdf:Seq>\s*<rdf:li>)(.*?)(<\/rdf:li>\s*<\/rdf:Seq>\s*<\/dc:creator>)/s;
                if (creatorRegex.test(xmpStr)) {
                    xmpStr = xmpStr.replace(creatorRegex, `$1${newCreator}$3`);
                    modifiedXmp = true;
                } else {
                    rdfToInject += `\n      <dc:creator><rdf:Seq><rdf:li>${newCreator}</rdf:li></rdf:Seq></dc:creator>`;
                }
            } else if (!hasXmp && !rdfToInject.includes('<dc:creator>')) {
                rdfToInject += `\n      <dc:creator><rdf:Seq><rdf:li>${newCreator}</rdf:li></rdf:Seq></dc:creator>`;
            }
        }
        
        // Inject RDF if needed
        if (rdfToInject.length > 0) {
            if (hasXmp && xmpStr) {
                const descRegex = /(<rdf:Description[^>]*>)/s;
                if (descRegex.test(xmpStr)) {
                    xmpStr = xmpStr.replace(descRegex, `$1${rdfToInject}`);
                    modifiedXmp = true;
                }
            } else {
                xmpStr = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 4.4.0-Exiv2">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" 
      xmlns:dc="http://purl.org/dc/elements/1.1/" 
      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" 
      xmlns:iptcExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">${rdfToInject}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
                modifiedXmp = true;
            }
        }
        
        if (modifiedXmp && xmpStr) {
            const newXmpData = new TextEncoder().encode(xmpStr);
            if (hasXmp) {
                img.removeProfile('xmp');
            }
            img.setProfile('xmp', newXmpData);
        }
        
        // 4. CONVERT PIXELS
        if (targetFormat === MagickFormat.Jpeg) {
          // PNG to JPEG: Fill transparent background with white
          if (img.hasAlpha) {
            img.backgroundColor = new MagickColor('#ffffff');
            img.alpha(AlphaAction.Remove);
          }
          img.quality = 100;
        } else {
          // JPEG to PNG
        }
        
        // 5. ENCODE DESTINATION IMAGE
        img.format = targetFormat;
        
        // 6. WRITE METADATA (Done automatically by img.write preserving profiles and attributes)
        img.write(data => {
          resolve(new Blob([data], { type: targetFormat === MagickFormat.Jpeg ? 'image/jpeg' : 'image/png' }));
        });
        } catch(innerErr) {
          reject(innerErr);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const playSuccessSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

export const showOSNotification = (title: string, options?: NotificationOptions) => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, options);
  }
};
