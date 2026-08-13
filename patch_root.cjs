const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  '<div className="h-full w-full bg-[#0A0518] text-[#E0D7FF] font-sans flex flex-col">',
  '<div className="h-screen w-full bg-[#0A0518] text-[#E0D7FF] font-sans flex flex-col overflow-hidden">'
);
fs.writeFileSync('src/App.tsx', code);
