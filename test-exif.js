import { ImageMagick, MagickFormat, initializeImageMagick, MagickColor } from '@imagemagick/magick-wasm';
import * as fs from 'fs';

async function main() {
  const wasm = fs.readFileSync('node_modules/@imagemagick/magick-wasm/dist/magick.wasm');
  await initializeImageMagick(wasm);
  
  ImageMagick.read(new MagickColor('#ff0000'), 100, 100, (img) => {
    img.setAttribute('exif:ImageUniqueID', '604ad7fa-e8f0-4beb-bec5-0dc970d8bfa2');
    img.setAttribute('exif:DigitalSourceType', 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia');
    img.format = MagickFormat.Jpeg;
    img.write(data => fs.writeFileSync("test-exif.jpg", data));
  });
}
main().catch(console.error);
