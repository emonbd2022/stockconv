const fs = require('fs');
let code = fs.readFileSync('src/utils.ts', 'utf8');

code = code.replace(
  "img.setAttribute('exif:Artist', creatorName);",
  "img.setAttribute('exif:Artist', creatorName);\n            img.setAttribute('exif:XPAuthor', creatorName);"
);

// We should also remove the dc:creator completely when converting if it's there, we already strip it from xmpStr.
// However, did we prevent migrating PNG Author text chunks?
// Let's check utils.ts around `if (!creatorName && (attributes['Author'] || attributes['Creator']))`

fs.writeFileSync('src/utils.ts', code);
