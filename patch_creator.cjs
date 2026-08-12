const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add state
if (!code.includes('const [enableCreator')) {
  code = code.replace(
    "const [creatorName, setCreatorName] = useState(() => profile?.creatorName || user?.displayName || '');",
    "const [creatorName, setCreatorName] = useState(() => profile?.creatorName || user?.displayName || '');\n  const [enableCreator, setEnableCreator] = useState(false);"
  );
}

// 2. Modify convertImage call
if (!code.includes('const finalCreatorName = enableCreator ?')) {
  code = code.replace(
    "const finalCreatorName = creatorName.trim() || user?.displayName || 'Unknown Creator';",
    "const finalCreatorName = enableCreator ? (creatorName.trim() || user?.displayName || 'Unknown Creator') : '';"
  );
}

// 3. Modify zip export name
if (!code.includes("enableCreator ? (creatorName.trim() || user?.displayName || 'UnknownCreator') : 'Export'")) {
  code = code.replace(
    "const finalCreatorName = creatorName.trim() || user?.displayName || 'UnknownCreator';",
    "const finalCreatorName = enableCreator ? (creatorName.trim() || user?.displayName || 'UnknownCreator') : 'Export';"
  );
}

// 4. Update UI using regex to avoid exact whitespace issues
const uiRegex = /<div className="flex flex-col gap-2">\s*<label className="text-xs font-semibold text-purple-200 uppercase tracking-widest">Creator<\/label>\s*<input\s*type="text"\s*value=\{creatorName\}\s*onChange=\{\(e\) => setCreatorName\(e.target.value\)\}\s*placeholder="Your adobe contributor display name"\s*className="w-full bg-\[#0F0A24\] border border-purple-500\/30 rounded-xl px-4 py-2\.5 text-sm text-white focus:outline-none focus:border-purple-500 placeholder-purple-300\/30 transition-colors"\s*\/>\s*<\/div>/g;

const newUI = `<div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-purple-200 uppercase tracking-widest cursor-pointer" onClick={() => setEnableCreator(!enableCreator)}>Inject Creator Name</label>
                  <button
                    onClick={() => setEnableCreator(!enableCreator)}
                    className={\`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none \${enableCreator ? 'bg-purple-500' : 'bg-purple-900/40'}\`}
                  >
                    <span
                      className={\`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform \${enableCreator ? 'translate-x-4.5' : 'translate-x-1'}\`}
                      style={{ transform: enableCreator ? 'translateX(18px)' : 'translateX(4px)' }}
                    />
                  </button>
                </div>
                <AnimatePresence>
                  {enableCreator && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <input 
                        type="text" 
                        value={creatorName}
                        onChange={(e) => setCreatorName(e.target.value)}
                        placeholder="Your adobe contributor display name"
                        className="w-full mt-2 bg-[#0F0A24] border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 placeholder-purple-300/30 transition-colors"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>`;

code = code.replace(uiRegex, newUI);
fs.writeFileSync('src/App.tsx', code);
