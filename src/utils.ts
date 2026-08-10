import { ImageMagick, MagickFormat, initializeImageMagick, MagickColor, AlphaAction } from '@imagemagick/magick-wasm';
import magickWasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';

let initialized = false;
let initializing: Promise<void> | null = null;

export const initMagick = async () => {
  if (initialized) return;
  if (initializing) return initializing;
  
  initializing = (async () => {
    try {
      await initializeImageMagick(new URL(magickWasmUrl, import.meta.url));
      initialized = true;
    } catch (err) {
      console.error("Failed to initialize ImageMagick:", err);
      throw err;
    }
  })();
  
  return initializing;
};

export const convertImage = async (file: File): Promise<Blob> => {
  await initMagick();
  
  const buffer = new Uint8Array(await file.arrayBuffer());
  
  return new Promise((resolve, reject) => {
    try {
      ImageMagick.read(buffer, (img) => {
        // Handle input format -> output format
        const isPng = file.type === 'image/png' || img.format === MagickFormat.Png;
        const targetFormat = isPng ? MagickFormat.Jpeg : MagickFormat.Png;
        
        // 1. READ METADATA & STORE METADATA OBJECT
        const attributes: Record<string, string> = {};
        for (const attr of img.attributeNames) {
          const val = img.getAttribute(attr);
          if (val) attributes[attr] = val;
        }
        
        // Check if XMP profile exists
        let hasXmp = img.hasProfile('xmp');
        
        // If converting PNG -> JPEG, JPEG doesn't support raw text attributes well.
        // We inject them into an XMP packet if they exist and XMP doesn't.
        if (targetFormat === MagickFormat.Jpeg && !hasXmp) {
          let rdf = '';
          const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
          
          if (attributes['Author'] || attributes['Creator']) {
            const creator = escapeXml(attributes['Author'] || attributes['Creator'] || '');
            rdf += `<dc:creator><rdf:Seq><rdf:li>${creator}</rdf:li></rdf:Seq></dc:creator>\n`;
          }
          if (attributes['Description']) {
            rdf += `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(attributes['Description'])}</rdf:li></rdf:Alt></dc:description>\n`;
          }
          if (attributes['Title']) {
            rdf += `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(attributes['Title'])}</rdf:li></rdf:Alt></dc:title>\n`;
          }
          if (attributes['Copyright']) {
            rdf += `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(attributes['Copyright'])}</rdf:li></rdf:Alt></dc:rights>\n`;
          }
          if (attributes['Digital Image GUID']) {
            const guid = escapeXml(attributes['Digital Image GUID']);
            rdf += `<xmpMM:DocumentID>${guid}</xmpMM:DocumentID>\n`;
            rdf += `<xmpMM:InstanceID>${guid}</xmpMM:InstanceID>\n`;
          }
          if (attributes['Digital Source Type']) {
            rdf += `<iptcExt:DigitalSourceType>${escapeXml(attributes['Digital Source Type'])}</iptcExt:DigitalSourceType>\n`;
          }
          if (attributes['Comment']) {
            rdf += `<pdf:Subject>${escapeXml(attributes['Comment'])}</pdf:Subject>\n`;
          }
          if (attributes['Creation Time']) {
            rdf += `<xmp:CreateDate>${escapeXml(attributes['Creation Time'])}</xmp:CreateDate>\n`;
          }

          if (rdf.length > 0) {
            const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 4.4.0-Exiv2">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" 
      xmlns:dc="http://purl.org/dc/elements/1.1/" 
      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" 
      xmlns:iptcExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      ${rdf}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
            const xmpData = new TextEncoder().encode(xmp);
            img.setProfile('xmp', xmpData);
          }
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
