const fs = require('fs');
let code = fs.readFileSync('src/utils.ts', 'utf8');

// We need to fix the migration part if they don't have creatorName enabled but DO have an old Author/Creator in the PNG
// Previously it was: if (!creatorName && (attributes['Author'] || attributes['Creator']))
// Wait, actually, let's look at the current migration logic exactly as it is right now in utils.ts

// First let's check what's there
fs.writeFileSync('check_utils.cjs', `
const fs = require('fs');
console.log(fs.readFileSync('src/utils.ts', 'utf8').includes("if (!creatorName && (attributes['Author'] || attributes['Creator']))"));
`);

