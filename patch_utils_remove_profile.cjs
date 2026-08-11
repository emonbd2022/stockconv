const fs = require('fs');
let code = fs.readFileSync('src/utils.ts', 'utf8');

code = code.replace(
  "img.setProfile('xmp', newXmpData);",
  "img.removeProfile('xmp');\n                img.setProfile('xmp', newXmpData);"
);

fs.writeFileSync('src/utils.ts', code);
