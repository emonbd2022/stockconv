const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  '<section className="col-span-1 lg:col-span-9 p-8 flex flex-col gap-6 h-full overflow-hidden relative">',
  '<section className="flex-1 p-4 lg:p-6 lg:p-8 bg-[#0A0518] flex flex-col gap-6 h-full overflow-hidden relative min-w-0">'
);

fs.writeFileSync('src/App.tsx', code);
