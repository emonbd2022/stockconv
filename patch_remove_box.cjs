const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  `              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <h3 className="text-xs font-semibold text-purple-200 mb-2">Quality & Compression</h3>
                <p className="text-[11px] leading-relaxed text-purple-300/60">No additional compression applied. Images converted at 100% highest quality natively.</p>
              </div>`,
  ''
);

fs.writeFileSync('src/App.tsx', code);
