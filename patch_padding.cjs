const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'className="shrink-0 w-full h-24 sm:h-28 border-2 border-dashed border-purple-500/30 rounded-2xl bg-purple-500/5 flex flex-col items-center justify-center gap-2 relative group cursor-pointer hover:bg-purple-500/10 transition-colors"',
  'className="shrink-0 w-full h-auto py-4 sm:py-6 border-2 border-dashed border-purple-500/30 rounded-2xl bg-purple-500/5 flex flex-col items-center justify-center gap-2 relative group cursor-pointer hover:bg-purple-500/10 transition-colors"'
);

fs.writeFileSync('src/App.tsx', code);
