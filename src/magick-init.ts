import { initializeImageMagick } from '@imagemagick/magick-wasm';
import magickWasmUrl from '@imagemagick/magick-wasm/dist/magick.wasm?url';

let initialized = false;
let initializing: Promise<void> | null = null;

export const initMagick = async () => {
  if (initialized) return;
  if (initializing) return initializing;
  
  initializing = initializeImageMagick(new URL(magickWasmUrl, import.meta.url).href).then(() => {
    initialized = true;
  });
  
  return initializing;
};
