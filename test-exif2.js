import { ImageMagick, MagickFormat, initializeImageMagick, MagickColor } from '@imagemagick/magick-wasm';
import * as fs from 'fs';

async function main() {
  const wasm = fs.readFileSync('node_modules/@imagemagick/magick-wasm/dist/magick.wasm');
  await initializeImageMagick(wasm);
  
  ImageMagick.read(fs.readFileSync("test-exif.jpg"), (img) => {
    console.log("Attributes in JPG:");
    for (const attr of img.attributeNames) {
      console.log(attr, "=", img.getAttribute(attr));
    }
  });
}
main().catch(console.error);
