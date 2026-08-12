
const fs = require('fs');
console.log(fs.readFileSync('src/utils.ts', 'utf8').includes("if (!creatorName && (attributes['Author'] || attributes['Creator']))"));
