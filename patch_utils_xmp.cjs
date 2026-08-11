const fs = require('fs');
let code = fs.readFileSync('src/utils.ts', 'utf8');

const oldBlock = `        // Check if XMP profile exists
        let hasXmp = img.hasProfile('xmp');
        
        if (hasXmp && creatorName) {
            // Patch existing XMP
            const xmpProfile = img.getProfile('xmp');
            if (xmpProfile) {
                let xmpStr = new TextDecoder().decode(xmpProfile.data);
                const creatorRegex = /(<dc:creator>\\s*<rdf:Seq>\\s*<rdf:li>)(.*?)(<\\/rdf:li>\\s*<\\/rdf:Seq>\\s*<\\/dc:creator>)/s;
                const newCreator = escapeXml(creatorName);
                
                if (creatorRegex.test(xmpStr)) {
                    xmpStr = xmpStr.replace(creatorRegex, \`$1\${newCreator}$3\`);
                } else {
                    const descRegex = /(<rdf:Description[^>]*>)/s;
                    if (descRegex.test(xmpStr)) {
                        xmpStr = xmpStr.replace(descRegex, \`$1\\n      <dc:creator><rdf:Seq><rdf:li>\${newCreator}</rdf:li></rdf:Seq></dc:creator>\`);
                    }
                }
                const newXmpData = new TextEncoder().encode(xmpStr);
                img.removeProfile('xmp');
                img.setProfile('xmp', newXmpData);
            }
        }
        
        // If converting PNG -> JPEG, JPEG doesn't support raw text attributes well.
        // We inject them into an XMP packet if they exist and XMP doesn't.
        if (targetFormat === MagickFormat.Jpeg && !hasXmp) {
          let rdf = '';
          
          if (attributes['Author'] || attributes['Creator']) {
            const creator = escapeXml(attributes['Author'] || attributes['Creator'] || '');
            rdf += \`<dc:creator><rdf:Seq><rdf:li>\${creator}</rdf:li></rdf:Seq></dc:creator>\\n\`;
          }
          if (attributes['Description']) {
            rdf += \`<dc:description><rdf:Alt><rdf:li xml:lang="x-default">\${escapeXml(attributes['Description'])}</rdf:li></rdf:Alt></dc:description>\\n\`;
          }
          if (attributes['Title']) {
            rdf += \`<dc:title><rdf:Alt><rdf:li xml:lang="x-default">\${escapeXml(attributes['Title'])}</rdf:li></rdf:Alt></dc:title>\\n\`;
          }
          if (attributes['Copyright']) {
            rdf += \`<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">\${escapeXml(attributes['Copyright'])}</rdf:li></rdf:Alt></dc:rights>\\n\`;
          }
          if (attributes['Digital Image GUID']) {
            const guid = escapeXml(attributes['Digital Image GUID']);
            rdf += \`<xmpMM:DocumentID>\${guid}</xmpMM:DocumentID>\\n\`;
            rdf += \`<xmpMM:InstanceID>\${guid}</xmpMM:InstanceID>\\n\`;
          }
          if (attributes['Digital Source Type']) {
            rdf += \`<iptcExt:DigitalSourceType>\${escapeXml(attributes['Digital Source Type'])}</iptcExt:DigitalSourceType>\\n\`;
          }
          if (attributes['Comment']) {
            rdf += \`<pdf:Subject>\${escapeXml(attributes['Comment'])}</pdf:Subject>\\n\`;
          }
          if (attributes['Creation Time']) {
            rdf += \`<xmp:CreateDate>\${escapeXml(attributes['Creation Time'])}</xmp:CreateDate>\\n\`;
          }

          if (rdf.length > 0) {
            const xmp = \`<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 4.4.0-Exiv2">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" 
      xmlns:dc="http://purl.org/dc/elements/1.1/" 
      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" 
      xmlns:iptcExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      \${rdf}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>\`;
            const xmpData = new TextEncoder().encode(xmp);
            img.setProfile('xmp', xmpData);
          }
        }`;

const newBlock = `        // Check if XMP profile exists
        let hasXmp = img.hasProfile('xmp');
        let xmpStr = '';
        
        if (hasXmp) {
            const xmpProfile = img.getProfile('xmp');
            if (xmpProfile) {
                xmpStr = new TextDecoder().decode(xmpProfile.data);
            }
        }
        
        let modifiedXmp = false;
        let rdfToInject = '';
        
        if (targetFormat === MagickFormat.Jpeg) {
            if (attributes['Digital Image GUID']) {
                const guid = escapeXml(attributes['Digital Image GUID']);
                if (!xmpStr.includes(guid) && !xmpStr.includes('xmpMM:DocumentID')) {
                    rdfToInject += \`\\n      <xmpMM:DocumentID>\${guid}</xmpMM:DocumentID>\\n      <xmpMM:InstanceID>\${guid}</xmpMM:InstanceID>\`;
                }
            }
            if (attributes['Digital Source Type']) {
                const sourceType = escapeXml(attributes['Digital Source Type']);
                if (!xmpStr.includes(sourceType) && !xmpStr.includes('iptcExt:DigitalSourceType')) {
                    rdfToInject += \`\\n      <iptcExt:DigitalSourceType>\${sourceType}</iptcExt:DigitalSourceType>\`;
                }
            }
            
            if (!hasXmp) {
                // If no XMP, also migrate other text chunks over so they aren't lost
                if (attributes['Author'] || attributes['Creator']) {
                    const creator = escapeXml(attributes['Author'] || attributes['Creator'] || '');
                    rdfToInject += \`\\n      <dc:creator><rdf:Seq><rdf:li>\${creator}</rdf:li></rdf:Seq></dc:creator>\`;
                }
                if (attributes['Description']) {
                    rdfToInject += \`\\n      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">\${escapeXml(attributes['Description'])}</rdf:li></rdf:Alt></dc:description>\`;
                }
                if (attributes['Title']) {
                    rdfToInject += \`\\n      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">\${escapeXml(attributes['Title'])}</rdf:li></rdf:Alt></dc:title>\`;
                }
                if (attributes['Copyright']) {
                    rdfToInject += \`\\n      <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">\${escapeXml(attributes['Copyright'])}</rdf:li></rdf:Alt></dc:rights>\`;
                }
                if (attributes['Comment']) {
                    rdfToInject += \`\\n      <pdf:Subject>\${escapeXml(attributes['Comment'])}</pdf:Subject>\`;
                }
                if (attributes['Creation Time']) {
                    rdfToInject += \`\\n      <xmp:CreateDate>\${escapeXml(attributes['Creation Time'])}</xmp:CreateDate>\`;
                }
            }
        }
        
        // Apply Creator Patch
        if (creatorName) {
            const newCreator = escapeXml(creatorName);
            if (hasXmp && xmpStr) {
                const creatorRegex = /(<dc:creator>\\s*<rdf:Seq>\\s*<rdf:li>)(.*?)(<\\/rdf:li>\\s*<\\/rdf:Seq>\\s*<\\/dc:creator>)/s;
                if (creatorRegex.test(xmpStr)) {
                    xmpStr = xmpStr.replace(creatorRegex, \`$1\${newCreator}$3\`);
                    modifiedXmp = true;
                } else {
                    rdfToInject += \`\\n      <dc:creator><rdf:Seq><rdf:li>\${newCreator}</rdf:li></rdf:Seq></dc:creator>\`;
                }
            } else if (!hasXmp && !rdfToInject.includes('<dc:creator>')) {
                rdfToInject += \`\\n      <dc:creator><rdf:Seq><rdf:li>\${newCreator}</rdf:li></rdf:Seq></dc:creator>\`;
            }
        }
        
        // Inject RDF if needed
        if (rdfToInject.length > 0) {
            if (hasXmp && xmpStr) {
                const descRegex = /(<rdf:Description[^>]*>)/s;
                if (descRegex.test(xmpStr)) {
                    xmpStr = xmpStr.replace(descRegex, \`$1\${rdfToInject}\`);
                    modifiedXmp = true;
                }
            } else {
                xmpStr = \`<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 4.4.0-Exiv2">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" 
      xmlns:dc="http://purl.org/dc/elements/1.1/" 
      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" 
      xmlns:iptcExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">\${rdfToInject}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>\`;
                modifiedXmp = true;
            }
        }
        
        if (modifiedXmp && xmpStr) {
            const newXmpData = new TextEncoder().encode(xmpStr);
            if (hasXmp) {
                img.removeProfile('xmp');
            }
            img.setProfile('xmp', newXmpData);
        }`;

code = code.replace(oldBlock, newBlock);
fs.writeFileSync('src/utils.ts', code);
