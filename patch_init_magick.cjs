const fs = require('fs');
let code = fs.readFileSync('src/utils.ts', 'utf8');

const oldBlock = `export const initMagick = async () => {
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
};`;

const newBlock = `export const initMagick = async () => {
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

code = code.replace(oldBlock, newBlock);
fs.writeFileSync('src/utils.ts', code);
