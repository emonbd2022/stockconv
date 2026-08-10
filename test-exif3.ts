import { ImageMagick, MagickFormat, initializeImageMagick, MagickColor, ImageProfile } from '@imagemagick/magick-wasm';
import * as fs from 'fs';

async function main() {
  const wasm = fs.readFileSync('node_modules/@imagemagick/magick-wasm/dist/magick.wasm');
  await initializeImageMagick(wasm);
  
  ImageMagick.read(new MagickColor('#ff0000'), 100, 100, (img) => {
    // Add XMP profile
    const xmpData = new TextEncoder().encode("<x:xmpmeta xmlns:x='adobe:ns:meta/'><rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'><rdf:Description rdf:about='' xmlns:dc='http://purl.org/dc/elements/1.1/'><dc:creator><rdf:Seq><rdf:li>himel2026</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>");
    
    img.setProfile("xmp", xmpData);
    
    img.format = MagickFormat.Png;
    img.write((data) => {
      fs.writeFileSync("test3.png", data);
    });
  });

  const pngData = fs.readFileSync("test3.png");
  ImageMagick.read(pngData, (img) => {
    img.format = MagickFormat.Jpeg;
    console.log("PNG Profiles:", img.profileNames);
    img.write((data) => {
      fs.writeFileSync("test3.jpg", data);
    });
  });

  const jpgData = fs.readFileSync("test3.jpg");
  ImageMagick.read(jpgData, (img) => {
    console.log("JPG Profiles:", img.profileNames);
    const xmpProfile = img.getProfile("xmp");
    if (xmpProfile) {
      console.log("XMP profile data:", new TextDecoder().decode(xmpProfile.data));
    }
  });
}
main().catch(console.error);
