const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Update state logic
const stateLogicOld = `  const [creatorName, setCreatorName] = useState(() => profile?.creatorName || user?.displayName || '');
  const [enableCreator, setEnableCreator] = useState(false);

  useEffect(() => {
    if (!creatorName && (profile?.creatorName || user?.displayName)) {
      setCreatorName(profile?.creatorName || user?.displayName || '');
    }
  }, [profile?.creatorName, user?.displayName]);

  useEffect(() => {
    if (!user || !profile) return;
    const timeoutId = setTimeout(() => {
      if (creatorName !== profile.creatorName) {
        import('firebase/firestore').then(({ doc, updateDoc }) => {
          const userDocRef = doc(db, 'users', profile.uid);
          updateDoc(userDocRef, { creatorName });
        }).catch(console.error);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [creatorName, user, profile]);`;

const stateLogicNew = `  const [creatorName, setCreatorName] = useState(() => profile?.creatorName || user?.displayName || '');
  const [enableCreator, setEnableCreator] = useState(() => profile?.enableCreator || false);

  useEffect(() => {
    if (profile) {
      if (!creatorName && (profile.creatorName || user?.displayName)) {
        setCreatorName(profile.creatorName || user?.displayName || '');
      }
      if (profile.enableCreator !== undefined && enableCreator === false && profile.enableCreator === true) {
        setEnableCreator(profile.enableCreator);
      }
    }
  }, [profile?.creatorName, profile?.enableCreator, user?.displayName]);

  useEffect(() => {
    if (!user || !profile) return;
    const timeoutId = setTimeout(() => {
      if (creatorName !== profile.creatorName || enableCreator !== profile.enableCreator) {
        import('firebase/firestore').then(({ doc, updateDoc }) => {
          const userDocRef = doc(db, 'users', profile.uid);
          updateDoc(userDocRef, { creatorName, enableCreator });
        }).catch(console.error);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [creatorName, enableCreator, user, profile]);`;

code = code.replace(stateLogicOld, stateLogicNew);

// 2. Update UI logic
const uiLogicOld = `                <div className="flex items-center justify-between">
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
                </div>`;

const uiLogicNew = `                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-purple-200 uppercase tracking-widest cursor-pointer select-none" onClick={() => setEnableCreator(!enableCreator)}>Inject Creator Name</label>
                  <button
                    onClick={() => setEnableCreator(!enableCreator)}
                    className={\`relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none \${enableCreator ? 'bg-purple-500' : 'bg-[#0F0A24] border border-purple-500/30'}\`}
                    aria-pressed={enableCreator}
                  >
                    <span
                      className={\`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out \${enableCreator ? 'translate-x-[22px]' : 'translate-x-1'}\`}
                    />
                  </button>
                </div>`;

code = code.replace(uiLogicOld, uiLogicNew);

// 3. Update grid logic
const listContainerOld = `<div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">`;
const listContainerNew = `<div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 overflow-y-auto pr-2 custom-scrollbar content-start">`;
code = code.replace(listContainerOld, listContainerNew);

const mapOldStr = `{images.map(img => (
                      <div key={img.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-[#140D2B] rounded-2xl border border-purple-500/10 transition-colors hover:border-purple-500/30">
                        <div className="w-16 h-16 shrink-0 rounded-lg bg-[#0F0A24] overflow-hidden flex items-center justify-center border border-purple-500/20">
                          <img src={img.previewUrl} alt={img.originalName} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-purple-100 truncate" title={img.originalName}>{img.originalName}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            <span className="text-[10px] text-purple-400/60 font-mono">{formatBytes(img.originalSize)} &rarr; {img.convertedSize ? formatBytes(img.convertedSize) : '...'}</span>
                            {img.status === 'done' && <span className="text-[10px] text-green-400 uppercase font-mono">Ready to download</span>}
                            {img.status === 'converting' && <span className="text-[10px] text-purple-400 uppercase font-mono">Converting...</span>}
                            {img.status === 'error' && <span className="text-[10px] text-red-400 uppercase font-mono">Failed</span>}
                          </div>
                          {img.status === 'converting' && (
                            <div className="w-full h-1 bg-purple-900/50 rounded-full mt-2 overflow-hidden">
                              <div className="w-1/2 h-full bg-purple-400 animate-pulse"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {img.status === 'done' && (
                             <button 
                               onClick={(e) => { e.stopPropagation(); downloadBlob(img.blob, img.originalName.replace(/\\.[^/.]+$/, "") + ".jpg"); }}
                               className="p-2 text-purple-400 hover:text-white bg-purple-900/30 hover:bg-purple-600 rounded-lg transition-colors"
                               title="Download"
                             >
                               <Download className="w-5 h-5" />
                             </button>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                            className="p-2 text-purple-400 hover:text-red-400 bg-purple-900/30 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}`;

const mapNewStr = `{images.map(img => (
                      <div key={img.id} className="flex flex-col gap-3 p-3 bg-[#140D2B] rounded-2xl border border-purple-500/10 transition-colors hover:border-purple-500/30">
                        <div className="w-full aspect-square shrink-0 rounded-xl bg-[#0F0A24] overflow-hidden flex items-center justify-center border border-purple-500/20 relative group">
                          <img src={img.previewUrl} alt={img.originalName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0F0A24]/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col px-1">
                          <p className="text-sm font-medium text-purple-100 truncate" title={img.originalName}>{img.originalName}</p>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <span className="text-[10px] text-purple-400/60 font-mono truncate">{formatBytes(img.originalSize)} &rarr; {img.convertedSize ? formatBytes(img.convertedSize) : '...'}</span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="h-5 flex items-center">
                              {img.status === 'done' && <span className="text-[10px] text-green-400 uppercase font-mono">Ready</span>}
                              {img.status === 'converting' && <span className="text-[10px] text-purple-400 uppercase font-mono animate-pulse">Converting...</span>}
                              {img.status === 'error' && <span className="text-[10px] text-red-400 uppercase font-mono">Failed</span>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 z-10">
                              {img.status === 'done' && (
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); downloadBlob(img.blob, img.originalName.replace(/\\.[^/.]+$/, "") + ".jpg"); }}
                                   className="p-1.5 text-purple-400 hover:text-white bg-purple-900/30 hover:bg-purple-600 rounded-lg transition-colors"
                                   title="Download"
                                 >
                                   <Download className="w-4 h-4" />
                                 </button>
                              )}
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                                className="p-1.5 text-purple-400 hover:text-red-400 bg-purple-900/30 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {img.status === 'converting' && (
                            <div className="w-full h-1 bg-purple-900/50 rounded-full mt-2 overflow-hidden">
                              <div className="w-1/2 h-full bg-purple-400 animate-pulse"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}`;

code = code.replace(mapOldStr, mapNewStr);
fs.writeFileSync('src/App.tsx', code);
