const fs = require('fs');
let code = fs.readFileSync('src/utils.ts', 'utf8');

const oldBlock = `      ImageMagick.read(buffer, (img) => {
        // Handle input format -> output format`;

const newBlock = `      ImageMagick.read(buffer, (img) => {
        try {
          // Handle input format -> output format`;
          
code = code.replace(oldBlock, newBlock);

const oldEnd = `        img.write(data => {
          resolve(new Blob([data], { type: targetFormat === MagickFormat.Jpeg ? 'image/jpeg' : 'image/png' }));
        });
      });
    } catch (e) {`;

const newEnd = `        img.write(data => {
          resolve(new Blob([data], { type: targetFormat === MagickFormat.Jpeg ? 'image/jpeg' : 'image/png' }));
        });
        } catch(innerErr) {
          reject(innerErr);
        }
      });
    } catch (e) {`;

code = code.replace(oldEnd, newEnd);
fs.writeFileSync('src/utils.ts', code);
