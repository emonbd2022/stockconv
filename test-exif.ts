import { ImageMagick, MagickFormat, initializeImageMagick, MagickColor } from '@imagemagick/magick-wasm';
import * as fs from 'fs';

async function main() {
  const wasm = fs.readFileSync('node_modules/@imagemagick/magick-wasm/dist/magick.wasm');
  await initializeImageMagick(wasm);
  
  // Create a PNG with a profile or comment
  ImageMagick.read(new MagickColor('#ff0000'), 100, 100, (img) => {
    img.format = MagickFormat.Png;
    img.setAttribute("Author", "himel2026");
    img.setAttribute("Description", "A suggestion box...");
    
    img.write((data) => {
      fs.writeFileSync("test.png", data);
    });
  });

  const pngData = fs.readFileSync("test.png");
  ImageMagick.read(pngData, (img) => {
    img.format = MagickFormat.Jpeg;
    console.log("Author:", img.getAttribute("Author"));
    img.write((data) => {
      fs.writeFileSync("test.jpg", data);
    });
  });

  const jpgData = fs.readFileSync("test.jpg");
  ImageMagick.read(jpgData, (img) => {
    console.log("Author from JPG:", img.getAttribute("Author"));
  });
}
main().catch(console.error);
