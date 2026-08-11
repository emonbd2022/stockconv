import { ImageMagick, MagickFormat, initializeImageMagick, MagickColor } from '@imagemagick/magick-wasm';
import * as fs from 'fs';

async function main() {
  const wasm = fs.readFileSync('node_modules/@imagemagick/magick-wasm/dist/magick.wasm');
  await initializeImageMagick(wasm);
  
  ImageMagick.read(new MagickColor('#ff0000'), 100, 100, (img) => {
    const xmpData = new TextEncoder().encode("<x:xmpmeta xmlns:x='adobe:ns:meta/'><rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'><rdf:Description rdf:about='' xmlns:dc='http://purl.org/dc/elements/1.1/'><dc:creator><rdf:Seq><rdf:li>himel2026</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>");
    img.setProfile("xmp", xmpData);
    img.format = MagickFormat.Png;
    img.write(data => fs.writeFileSync("test.png", data));
  });

  const pngData = fs.readFileSync("test.png");
  ImageMagick.read(pngData, (img) => {
    let hasXmp = img.hasProfile('xmp');
    if (hasXmp) {
      const xmpProfile = img.getProfile('xmp');
      if (xmpProfile) {
        let xmpStr = new TextDecoder().decode(xmpProfile.data);
        console.log("Original XMP:", xmpStr);
        
        const creatorRegex = /(<dc:creator>\s*<rdf:Seq>\s*<rdf:li>)(.*?)(<\/rdf:li>\s*<\/rdf:Seq>\s*<\/dc:creator>)/s;
        const newCreator = "pixelzone";
        
        if (creatorRegex.test(xmpStr)) {
            xmpStr = xmpStr.replace(creatorRegex, `$1${newCreator}$3`);
        } else {
            // Inject into Description
            const descRegex = /(<rdf:Description[^>]*>)/s;
            if (descRegex.test(xmpStr)) {
                xmpStr = xmpStr.replace(descRegex, `$1\n      <dc:creator><rdf:Seq><rdf:li>${newCreator}</rdf:li></rdf:Seq></dc:creator>`);
            }
        }
        
        console.log("Patched XMP:", xmpStr);
      }
    }
  });
}
main().catch(console.error);
