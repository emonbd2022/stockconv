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

function sanitizeExifProfile(data: Uint8Array, removeCreator: boolean): Uint8Array {
  try {
    if (data.length < 14) return data;
    
    // Check if starts with "Exif\0\0"
    let tiffStart = 0;
    if (data[0] === 0x45 && data[1] === 0x78 && data[2] === 0x69 && data[3] === 0x66 && data[4] === 0x00 && data[5] === 0x00) {
      tiffStart = 6;
    } else if ((data[0] === 0x49 && data[1] === 0x49) || (data[0] === 0x4d && data[1] === 0x4d)) {
      tiffStart = 0;
    } else {
      for (let k = 0; k < Math.min(32, data.length - 4); k++) {
        if ((data[k] === 0x49 && data[k+1] === 0x49 && data[k+2] === 0x2A && data[k+3] === 0x00) ||
            (data[k] === 0x4d && data[k+1] === 0x4d && data[k+2] === 0x00 && data[k+3] === 0x2A)) {
          tiffStart = k;
          break;
        }
      }
    }

    const isLE = data[tiffStart] === 0x49; // 'II' little-endian
    const read16 = (off: number) => isLE ? data[off] | (data[off + 1] << 8) : (data[off] << 8) | data[off + 1];
    const read32 = (off: number) => isLE 
      ? (data[off] | (data[off + 1] << 8) | (data[off + 2] << 16) | (data[off + 3] << 24)) >>> 0
      : ((data[off] << 24) | (data[off + 1] << 16) | (data[off + 2] << 8) | data[off + 3]) >>> 0;
    
    const write16 = (off: number, val: number) => {
      if (isLE) {
        data[off] = val & 0xff;
        data[off + 1] = (val >> 8) & 0xff;
      } else {
        data[off] = (val >> 8) & 0xff;
        data[off + 1] = val & 0xff;
      }
    };

    if (read16(tiffStart + 2) !== 42) return data;

    const processIFD = (ifdRelOffset: number) => {
      if (ifdRelOffset <= 0 || tiffStart + ifdRelOffset + 2 > data.length) return;
      const ifdStart = tiffStart + ifdRelOffset;
      const count = read16(ifdStart);
      if (ifdStart + 2 + count * 12 > data.length) return;

      const subIfdsToProcess: number[] = [];
      const keptEntries: number[] = [];

      for (let i = 0; i < count; i++) {
        const entryStart = ifdStart + 2 + i * 12;
        const tag = read16(entryStart);

        if (tag === 0x8769) { // ExifIFD pointer
          const subOffset = read32(entryStart + 8);
          subIfdsToProcess.push(subOffset);
        }

        let shouldRemove = false;
        // Always remove Description / comments:
        // 0x010E: ImageDescription
        // 0x9286: UserComment
        // 0x9C9C: XPComment
        if (tag === 0x010E || tag === 0x9286 || tag === 0x9C9C) {
          shouldRemove = true;
        }

        // Creator tags to remove if removeCreator is true:
        // 0x013B: Artist
        // 0x9C9D: XPAuthor
        // 0xA430: CameraOwnerName
        if (removeCreator && (tag === 0x013B || tag === 0x9C9D || tag === 0xA430)) {
          shouldRemove = true;
        }

        if (!shouldRemove) {
          keptEntries.push(entryStart);
        }
      }

      if (keptEntries.length < count) {
        write16(ifdStart, keptEntries.length);
        for (let idx = 0; idx < keptEntries.length; idx++) {
          const srcStart = keptEntries[idx];
          const destStart = ifdStart + 2 + idx * 12;
          if (srcStart !== destStart) {
            for (let b = 0; b < 12; b++) {
              data[destStart + b] = data[srcStart + b];
            }
          }
        }
        const unusedStart = ifdStart + 2 + keptEntries.length * 12;
        const unusedEnd = ifdStart + 2 + count * 12;
        for (let u = unusedStart; u < unusedEnd; u++) {
          data[u] = 0;
        }
      }

      for (const subIfdOffset of subIfdsToProcess) {
        processIFD(subIfdOffset);
      }
    };

    const firstIfdOffset = read32(tiffStart + 4);
    processIFD(firstIfdOffset);

    return data;
  } catch (e) {
    console.warn("Could not sanitize EXIF profile bytes:", e);
    return data;
  }
}

function sanitizeIptcProfile(data: Uint8Array, removeCreator: boolean): Uint8Array {
  try {
    const result: number[] = [];
    let i = 0;
    while (i < data.length) {
      if (data[i] === 0x1C) {
        if (i + 5 > data.length) break;
        const record = data[i + 1];
        const dataset = data[i + 2];
        const length = (data[i + 3] << 8) | data[i + 4];
        const entryTotalLen = 5 + length;
        if (i + entryTotalLen > data.length) break;

        let remove = false;
        // Always remove Caption / Description (Record 2, Dataset 120)
        if (record === 2 && dataset === 120) {
          remove = true;
        }
        // Remove creator / by-line / credit if removeCreator is true
        if (removeCreator && record === 2 && (dataset === 80 || dataset === 85 || dataset === 110)) {
          remove = true;
        }

        if (!remove) {
          for (let j = 0; j < entryTotalLen; j++) {
            result.push(data[i + j]);
          }
        }
        i += entryTotalLen;
      } else {
        result.push(data[i]);
        i++;
      }
    }
    return new Uint8Array(result);
  } catch (e) {
    console.warn("Could not sanitize IPTC profile bytes:", e);
    return data;
  }
}

function cleanXmpString(xmp: string, removeCreator: boolean): string {
  let cleaned = xmp;

  // 1. ALWAYS remove all Description / Comment / Caption tags from XMP
  cleaned = cleaned.replace(/<dc:description[\s\S]*?<\/dc:description>/gi, '');
  cleaned = cleaned.replace(/<dc:description[^/>]*\/>/gi, '');
  cleaned = cleaned.replace(/<tiff:ImageDescription[\s\S]*?<\/tiff:ImageDescription>/gi, '');
  cleaned = cleaned.replace(/<tiff:ImageDescription[^/>]*\/>/gi, '');
  cleaned = cleaned.replace(/<exif:UserComment[\s\S]*?<\/exif:UserComment>/gi, '');
  cleaned = cleaned.replace(/<exif:UserComment[^/>]*\/>/gi, '');
  cleaned = cleaned.replace(/<photoshop:Caption[\s\S]*?<\/photoshop:Caption>/gi, '');
  cleaned = cleaned.replace(/<photoshop:Caption[^/>]*\/>/gi, '');

  // Strip inline XML attributes
  cleaned = cleaned.replace(/\s*dc:description="[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s*tiff:ImageDescription="[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s*exif:UserComment="[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s*photoshop:Caption="[^"]*"/gi, '');

  // 2. Remove Creator tags if removeCreator is true (or preparing to inject new creator)
  if (removeCreator) {
    cleaned = cleaned.replace(/<dc:creator[\s\S]*?<\/dc:creator>/gi, '');
    cleaned = cleaned.replace(/<dc:creator[^/>]*\/>/gi, '');
    cleaned = cleaned.replace(/<pdf:Author[\s\S]*?<\/pdf:Author>/gi, '');
    cleaned = cleaned.replace(/<pdf:Author[^/>]*\/>/gi, '');
    cleaned = cleaned.replace(/<tiff:Artist[\s\S]*?<\/tiff:Artist>/gi, '');
    cleaned = cleaned.replace(/<tiff:Artist[^/>]*\/>/gi, '');
    cleaned = cleaned.replace(/<xmp:Creator[\s\S]*?<\/xmp:Creator>/gi, '');
    cleaned = cleaned.replace(/<xmp:Creator[^/>]*\/>/gi, '');
    cleaned = cleaned.replace(/<xmp:Author[\s\S]*?<\/xmp:Author>/gi, '');
    cleaned = cleaned.replace(/<xmp:Author[^/>]*\/>/gi, '');
    cleaned = cleaned.replace(/<photoshop:Credit[\s\S]*?<\/photoshop:Credit>/gi, '');
    cleaned = cleaned.replace(/<photoshop:Credit[^/>]*\/>/gi, '');
    cleaned = cleaned.replace(/<plus:CreditName[\s\S]*?<\/plus:CreditName>/gi, '');
    cleaned = cleaned.replace(/<plus:CreditName[^/>]*\/>/gi, '');
    cleaned = cleaned.replace(/<photoshop:CaptionWriter[\s\S]*?<\/photoshop:CaptionWriter>/gi, '');
    cleaned = cleaned.replace(/<photoshop:CaptionWriter[^/>]*\/>/gi, '');

    cleaned = cleaned.replace(/\s*dc:creator="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s*pdf:Author="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s*tiff:Artist="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s*photoshop:Credit="[^"]*"/gi, '');
  }

  return cleaned;
}

export const convertImage = async (
  file: File, 
  creatorName?: string, 
  quality?: number,
  onProgress?: (progress: number, stage: string) => void
): Promise<Blob> => {
  onProgress?.(10, 'Initializing ImageMagick engine...');
  await initMagick();
  
  onProgress?.(25, 'Reading image buffer...');
  const buffer = new Uint8Array(await file.arrayBuffer());
  
  return new Promise((resolve, reject) => {
    try {
      onProgress?.(40, 'Parsing image headers & profiles...');
      ImageMagick.read(buffer, (img) => {
        try {
        const isPng = file.type === 'image/png' || img.format === MagickFormat.Png;
        const targetFormat = isPng ? MagickFormat.Jpeg : MagickFormat.Png;
        
        onProgress?.(55, 'Extracting & processing metadata tags...');
        const attributes: Record<string, string> = {};
        for (const attr of img.attributeNames) {
          const val = img.getAttribute(attr);
          if (val) attributes[attr] = val;
        }
        
        const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        
        // 1. ALWAYS PURGE ALL DESCRIPTION / COMMENT / CAPTION TAGS FROM ATTRIBUTES
        const descriptionAttrs = [
          'Description', 'description', 'exif:ImageDescription', 'exif:UserComment',
          'exif:XPComment', 'comment', 'Comment', 'caption', 'Caption',
          'iptc:caption', 'iptc:Caption', 'iptc:2:120', 'tiff:ImageDescription'
        ];
        for (const a of descriptionAttrs) {
          try { img.removeAttribute(a); } catch (_) {}
          delete attributes[a];
        }

        for (const attr of [...img.attributeNames]) {
          const lower = attr.toLowerCase();
          if (
            lower === 'description' ||
            lower.includes('imagedescription') ||
            lower.includes('usercomment') ||
            lower.includes('xpcomment') ||
            lower === 'comment' ||
            lower.endsWith(':comment') ||
            lower.includes('caption')
          ) {
            try { img.removeAttribute(attr); } catch (_) {}
            delete attributes[attr];
          }
        }

        // 2. CREATOR TAGS:
        // If inject creator name is turned ON -> inject specified creatorName
        // If inject creator name is turned OFF -> delete all creator/artist/author fields
        if (creatorName) {
          // Clear any pre-existing author/artist tags first
          try { img.removeAttribute('exif:Artist'); } catch (_) {}
          try { img.removeAttribute('exif:XPAuthor'); } catch (_) {}
          try { img.removeAttribute('Author'); } catch (_) {}
          try { img.removeAttribute('Creator'); } catch (_) {}
          try { img.removeAttribute('Artist'); } catch (_) {}

          attributes['Author'] = creatorName;
          attributes['Creator'] = creatorName;
          attributes['Artist'] = creatorName;
          img.setAttribute('Author', creatorName);
          img.setAttribute('Creator', creatorName);
          img.setAttribute('Artist', creatorName);
          img.setAttribute('exif:Artist', creatorName);
          img.setAttribute('exif:XPAuthor', creatorName);
        } else {
          // Remove all author/creator/artist attributes
          const creatorAttrs = [
            'Author', 'author', 'Creator', 'creator', 'Artist', 'artist',
            'exif:Artist', 'exif:XPAuthor', 'exif:CameraOwnerName', 'exif:OwnerName',
            'tiff:Artist', 'iptc:by-line', 'iptc:credit', 'iptc:2:80', 'iptc:2:85', 'iptc:2:110'
          ];
          for (const a of creatorAttrs) {
            try { img.removeAttribute(a); } catch (_) {}
            delete attributes[a];
          }
          for (const attr of [...img.attributeNames]) {
            const lower = attr.toLowerCase();
            if (
              lower.includes('author') ||
              lower.includes('artist') ||
              lower.includes('creator') ||
              lower.includes('by-line') ||
              lower.includes('credit') ||
              lower.includes('ownername')
            ) {
              try { img.removeAttribute(attr); } catch (_) {}
              delete attributes[attr];
            }
          }
        }
        
        // 3. SANITIZE EXIF BINARY PROFILE (IF PRESENT)
        if (img.hasProfile('exif')) {
          const exifProfile = img.getProfile('exif');
          if (exifProfile && exifProfile.data) {
            const sanitizedExif = sanitizeExifProfile(new Uint8Array(exifProfile.data), !creatorName);
            img.removeProfile('exif');
            img.setProfile('exif', sanitizedExif);
          }
        }

        // 4. SANITIZE IPTC BINARY PROFILE (IF PRESENT)
        if (img.hasProfile('iptc')) {
          const iptcProfile = img.getProfile('iptc');
          if (iptcProfile && iptcProfile.data) {
            const sanitizedIptc = sanitizeIptcProfile(new Uint8Array(iptcProfile.data), !creatorName);
            img.removeProfile('iptc');
            img.setProfile('iptc', sanitizedIptc);
          }
        }

        // 5. PROCESS XMP PROFILE
        let hasXmp = img.hasProfile('xmp');
        let xmpStr = '';
        
        if (hasXmp) {
          const xmpProfile = img.getProfile('xmp');
          if (xmpProfile) {
            xmpStr = new TextDecoder().decode(xmpProfile.data);
          }
        }
        
        // Always clean description, and clean creator from existing XMP
        xmpStr = cleanXmpString(xmpStr, true);
        let modifiedXmp = hasXmp;
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
            // Note: Description and Comment are NEVER injected here
            if (attributes['Title']) {
              rdfToInject += `\n      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(attributes['Title'])}</rdf:li></rdf:Alt></dc:title>`;
            }
            if (attributes['Copyright']) {
              rdfToInject += `\n      <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(attributes['Copyright'])}</rdf:li></rdf:Alt></dc:rights>`;
            }
            if (attributes['Creation Time']) {
              rdfToInject += `\n      <xmp:CreateDate>${escapeXml(attributes['Creation Time'])}</xmp:CreateDate>`;
            }
          }
        }
        
        // Apply new Creator (Author/Artist) ONLY if enabled
        if (creatorName) {
          onProgress?.(70, `Injecting contributor tag: ${creatorName}...`);
          const newCreator = escapeXml(creatorName);
          rdfToInject += `\n      <pdf:Author>${newCreator}</pdf:Author>\n      <tiff:Artist>${newCreator}</tiff:Artist>\n      <dc:creator><rdf:Seq><rdf:li>${newCreator}</rdf:li></rdf:Seq></dc:creator>`;
        }
        
        // Inject RDF into XMP if needed
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
      xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
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
          if (img.hasProfile('xmp')) {
            img.removeProfile('xmp');
          }
          img.setProfile('xmp', newXmpData);
        }
        
        onProgress?.(80, 'Processing color alpha channel & matte...');
        // 4. CONVERT PIXELS
        if (targetFormat === MagickFormat.Jpeg) {
          // PNG to JPEG: Fill transparent background with white
          if (img.hasAlpha) {
            img.backgroundColor = new MagickColor('#ffffff');
            img.alpha(AlphaAction.Remove);
          }
          img.quality = quality !== undefined ? Math.max(1, Math.min(100, quality)) : 100;
        } else {
          // JPEG to PNG
        }
        
        onProgress?.(90, `Encoding ${targetFormat === MagickFormat.Jpeg ? 'JPEG' : 'PNG'} format...`);
        // 5. ENCODE DESTINATION IMAGE
        img.format = targetFormat;
        
        // 6. WRITE METADATA (Done automatically by img.write preserving profiles and attributes)
        img.write(data => {
          onProgress?.(100, 'Conversion complete');
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
