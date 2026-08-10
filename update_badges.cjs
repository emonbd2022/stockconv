const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/<h1 className="text-xl font-bold tracking-tight text-white">STOCK<span className="text-purple-400">CONV<\/span><\/h1>\s*<p className="text-\[10px\] uppercase tracking-\[0.2em\] text-purple-300\/60">Pro Lossless PNG to JPEG<\/p>/,
`<h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              STOCK<span className="text-purple-400">CONV</span>
              {isOfflineReady && (
                <span className="px-1.5 py-0.5 rounded bg-green-900/40 border border-green-500/30 text-[9px] font-mono text-green-400 flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                  OFFLINE
                </span>
              )}
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-purple-300/60">Pro Lossless PNG to JPEG</p>`);

fs.writeFileSync('src/App.tsx', code);
