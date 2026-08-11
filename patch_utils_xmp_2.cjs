const fs = require('fs');
let code = fs.readFileSync('src/utils.ts', 'utf8');

code = code.replace(
  "if (attributes['Digital Image GUID']) {",
  "const rawGuid = attributes['Digital Image GUID'] || attributes['ImageUniqueID'];\n            if (rawGuid) {\n                const guid = escapeXml(rawGuid);"
);

code = code.replace(
  "if (attributes['Digital Source Type']) {",
  "const rawSource = attributes['Digital Source Type'] || attributes['DigitalSourceType'];\n            if (rawSource) {\n                const sourceType = escapeXml(rawSource);"
);

// We need to fix the first one which didn't use rawGuid
code = code.replace(
  "const guid = escapeXml(attributes['Digital Image GUID']);",
  ""
);

code = code.replace(
  "const sourceType = escapeXml(attributes['Digital Source Type']);",
  ""
);

fs.writeFileSync('src/utils.ts', code);
