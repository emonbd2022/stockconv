import { ImageMagick, MagickFormat, initializeImageMagick, MagickColor } from '@imagemagick/magick-wasm';
import * as fs from 'fs';

async function main() {
  const wasm = fs.readFileSync('node_modules/@imagemagick/magick-wasm/dist/magick.wasm');
  await initializeImageMagick(wasm);
  
  ImageMagick.read(new MagickColor('#ff0000'), 100, 100, (img) => {
    img.setAttribute('exif:Artist', 'Artist Name');
    img.setAttribute('exif:XPAuthor', 'XPAuthor Name');
    img.setAttribute('exif:Author', 'Author Name'); // Just in case
    img.format = MagickFormat.Jpeg;
    img.write(data => fs.writeFileSync("test-author.jpg", data));
  });
}
main().catch(console.error);
