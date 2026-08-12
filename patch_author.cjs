const fs = require('fs');
let code = fs.readFileSync('src/utils.ts', 'utf8');

const oldBlock = `        // Apply Creator Patch
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
        }`;

const newBlock = `        // Handle Author/Creator modifications
        // First, strip out existing Creator tags if present in XMP
        if (hasXmp && xmpStr) {
            const creatorRegex = /<dc:creator>\\s*<rdf:Seq>\\s*<rdf:li>.*?<\\/rdf:li>\\s*<\\/rdf:Seq>\\s*<\\/dc:creator>/s;
            if (creatorRegex.test(xmpStr)) {
                xmpStr = xmpStr.replace(creatorRegex, '');
                modifiedXmp = true;
            }
            
            // Also strip pdf:Author or other forms if present
            const pdfAuthorRegex = /<pdf:Author>.*?<\\/pdf:Author>/s;
            if (pdfAuthorRegex.test(xmpStr)) {
                xmpStr = xmpStr.replace(pdfAuthorRegex, '');
                modifiedXmp = true;
            }
            
            const tiffArtistRegex = /<tiff:Artist>.*?<\\/tiff:Artist>/s;
            if (tiffArtistRegex.test(xmpStr)) {
                xmpStr = xmpStr.replace(tiffArtistRegex, '');
                modifiedXmp = true;
            }
        }
        
        // Remove EXIF artist/author tags if they existed
        img.removeAttribute('exif:Artist');
        img.removeAttribute('exif:XPAuthor');
        
        // Apply new Creator (Author) if enabled
        if (creatorName) {
            const newCreator = escapeXml(creatorName);
            // Inject as pdf:Author and tiff:Artist which usually map to Author/Artist instead of Creator
            rdfToInject += \`\\n      <pdf:Author>\${newCreator}</pdf:Author>\\n      <tiff:Artist>\${newCreator}</tiff:Artist>\`;
            
            // Set standard EXIF tags to ensure ExifTool shows "Author"
            img.setAttribute('exif:Artist', creatorName);
        }`;

code = code.replace(oldBlock, newBlock);

// Also we need to fix the migration part where it migrates existing Author/Creator to dc:creator when no XMP
const oldMigration = `                if (attributes['Author'] || attributes['Creator']) {
                    const creator = escapeXml(attributes['Author'] || attributes['Creator'] || '');
                    rdfToInject += \`\\n      <dc:creator><rdf:Seq><rdf:li>\${creator}</rdf:li></rdf:Seq></dc:creator>\`;
                }`;
const newMigration = `                if (!creatorName && (attributes['Author'] || attributes['Creator'])) {
                    // Only migrate if we aren't injecting a new one, WAIT NO, user wants it DELETED if inject is disabled.
                    // So we do NOTHING here. If it's disabled, we drop it.
                }`;

code = code.replace(oldMigration, newMigration);

fs.writeFileSync('src/utils.ts', code);
