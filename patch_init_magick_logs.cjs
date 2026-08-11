const fs = require('fs');
let code = fs.readFileSync('src/utils.ts', 'utf8');

const oldBlock = `export const initMagick = async () => {
  if (initialized) return;
  if (initializing) return initializing;
  
  initializing = (async () => {
    try {
      const wasmUrl = new URL(magickWasmUrl, import.meta.url).href;
      let wasmData = null;
      
      if ('caches' in window) {
        try {
          const cache = await caches.open('magick-wasm-cache-v1');
          let response = await cache.match(wasmUrl);
          
          if (!response) {
            console.log("Downloading ImageMagick WASM to cache...");
            response = await fetch(wasmUrl);
            if (response.ok) {
              await cache.put(wasmUrl, response.clone());
            }
          } else {
            console.log("Loaded ImageMagick WASM from cache!");
          }
          
          if (response && response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            wasmData = new Uint8Array(arrayBuffer);
          }
        } catch (cacheErr) {
          console.warn("Cache API failed, falling back to standard initialization", cacheErr);
        }
      }
      
      if (wasmData) {
        await initializeImageMagick(wasmData);
      } else {
        await initializeImageMagick(new URL(magickWasmUrl, import.meta.url));
      }
      
      initialized = true;
    } catch (err) {
      console.error("Failed to initialize ImageMagick:", err);
      throw err;
    }
  })();
  
  return initializing;
};`;

const newBlock = `export const initMagick = async () => {
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
};`;

code = code.replace(oldBlock, newBlock);
fs.writeFileSync('src/utils.ts', code);
