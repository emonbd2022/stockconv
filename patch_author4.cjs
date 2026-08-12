const fs = require('fs');
let code = fs.readFileSync('src/utils.ts', 'utf8');

const oldMigration = `                if (!creatorName && (attributes['Author'] || attributes['Creator'])) {
                    // Only migrate if we aren't injecting a new one, WAIT NO, user wants it DELETED if inject is disabled.
                    // So we do NOTHING here. If it's disabled, we drop it.
                }`;
const newMigration = `                // If inject is disabled (creatorName is empty), the user explicitly wants existing Author/Creator tags REMOVED.
                // So we do NOT migrate them over to the new RDF payload here.`;

code = code.replace(oldMigration, newMigration);
fs.writeFileSync('src/utils.ts', code);
