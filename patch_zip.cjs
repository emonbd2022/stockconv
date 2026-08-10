const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Patch JSZip 
code = code.replace(/const zip = new JSZip\(\);\n      doneImages\.forEach\(img => {\n        if \(img\.blob\) {\n          const newName = img\.originalName\.replace\(\/\\\\\.\[\^\/\.\]\+\$\/, ""\) \+ "\.jpg";\n          zip\.file\(newName, img\.blob\);\n        }\n      }\);\n\n      const zipBlob = await zip\.generateAsync\(\{ type: 'blob' \}\);\n      downloadBlob\(zipBlob, 'converted_images\.zip'\);/, 
`const zip = new JSZip();
      const folderName = \`\${doneImages.length}_converted_images\`;
      const folder = zip.folder(folderName);
      doneImages.forEach(img => {
        if (img.blob && folder) {
          const newName = img.originalName.replace(/\\.[^/.]+$/, "") + ".jpg";
          folder.file(newName, img.blob);
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, \`\${folderName}.zip\`);`);

// Patch one by one download in startConversion loop
code = code.replace(/allDone\.push\(updated\);\n            return updated;\n          }\n          return img;\n        \}\)\);/,
`allDone.push(updated);
            return updated;
          }
          return img;
        }));

        if (autoExportOneByOneRef.current) {
          const newName = imgObj.originalName.replace(/\\.[^/.]+$/, "") + ".jpg";
          downloadBlob(jpegBlob, newName);
        }`);

fs.writeFileSync('src/App.tsx', code);
