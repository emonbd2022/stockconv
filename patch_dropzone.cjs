const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'className="shrink-0 h-32 sm:h-40 border-2 border-dashed border-purple-500/30 rounded-2xl bg-purple-500/5 flex flex-col items-center justify-center gap-3 relative group cursor-pointer hover:bg-purple-500/10 transition-colors"',
  'className="shrink-0 w-full h-24 sm:h-28 border-2 border-dashed border-purple-500/30 rounded-2xl bg-purple-500/5 flex flex-col items-center justify-center gap-2 relative group cursor-pointer hover:bg-purple-500/10 transition-colors"'
);

// Make the text and icon slightly more compact
code = code.replace(
  '<div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">',
  '<div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">'
);
code = code.replace(
  '<Upload className="w-6 h-6 text-purple-400" />',
  '<Upload className="w-5 h-5 text-purple-400" />'
);

code = code.replace(
  '<p className="text-base font-semibold text-white">Drop your Adobe Stock PNGs here</p>',
  '<p className="text-sm font-semibold text-white">Drop your Adobe Stock PNGs here</p>'
);

code = code.replace(
  '<button className="mt-1 px-5 py-1.5 bg-purple-600 rounded-full text-xs font-bold uppercase tracking-wider shadow-md hover:bg-purple-500 transition-colors">Browse Files</button>',
  '<button className="mt-1 px-4 py-1 bg-purple-600 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md hover:bg-purple-500 transition-colors">Browse Files</button>'
);

fs.writeFileSync('src/App.tsx', code);
