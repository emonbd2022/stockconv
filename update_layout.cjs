const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove Auto-Export (Batch Only) from sidebar
code = code.replace(/<label className="flex items-center justify-between p-3 rounded-xl bg-purple-900\/20 border border-purple-500\/10 cursor-pointer hover:border-purple-500\/30 transition-colors">\s*<span className="text-sm font-medium">Auto-Export \(Batch Only\)<\/span>\s*<div className="relative">\s*<input \s*type="checkbox" \s*className="sr-only" \s*checked=\{autoExport\}\s*onChange=\{\(e\) => handleAutoExportToggle\(e.target.checked\)\}\s*\/>\s*<div className=\{`w-10 h-5 rounded-full transition-colors \$\{autoExport \? 'bg-purple-600' : 'bg-purple-900\/50'\}`\}><\/div>\s*<div className=\{`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform \$\{autoExport \? 'translate-x-5' : ''\}`\}><\/div>\s*<\/div>\s*<\/label>/, '');

// 2. Remove Export Actions block from sidebar
code = code.replace(/<div className="mt-auto pt-6">\s*<h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4">Export Actions<\/h2>\s*<div className="grid gap-2">[\s\S]*?<\/div>\s*<\/div>/, '');

// 3. Update Header
const newHeaderRight = `
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 justify-end">
          <div className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-4 sm:border-r border-purple-500/20">
             <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-purple-300 uppercase cursor-pointer" title="Automatically create ZIP when finished">
                <span className="hidden md:inline">Auto Batch</span>
                <span className="md:hidden">Batch</span>
                <div className="relative flex items-center">
                  <input type="checkbox" className="sr-only" checked={autoExport} onChange={(e) => handleAutoExportToggle(e.target.checked)} />
                  <div className={\`w-6 sm:w-8 h-3 sm:h-4 rounded-full transition-colors \${autoExport ? 'bg-purple-600' : 'bg-purple-900/50'}\`}></div>
                  <div className={\`absolute left-0.5 top-0.5 w-2 sm:w-3 h-2 sm:h-3 bg-white rounded-full transition-transform \${autoExport ? 'translate-x-3 sm:translate-x-4' : ''}\`}></div>
                </div>
             </label>
             <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-purple-300 uppercase cursor-pointer" title="Automatically download each image instantly">
                <span className="hidden md:inline">Auto One-by-One</span>
                <span className="md:hidden">1-by-1</span>
                <div className="relative flex items-center">
                  <input type="checkbox" className="sr-only" checked={autoExportOneByOne} onChange={(e) => handleAutoExportOneByOneToggle(e.target.checked)} />
                  <div className={\`w-6 sm:w-8 h-3 sm:h-4 rounded-full transition-colors \${autoExportOneByOne ? 'bg-purple-600' : 'bg-purple-900/50'}\`}></div>
                  <div className={\`absolute left-0.5 top-0.5 w-2 sm:w-3 h-2 sm:h-3 bg-white rounded-full transition-transform \${autoExportOneByOne ? 'translate-x-3 sm:translate-x-4' : ''}\`}></div>
                </div>
             </label>
          </div>
          
          <button 
            onClick={toggleConversion}
            disabled={images.filter(img => img.status === 'pending').length === 0 && !isConverting}
            className={\`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-white font-bold text-[10px] sm:text-xs flex items-center gap-1.5 sm:gap-2 transition-colors disabled:opacity-50 shadow-lg \${isConverting ? 'bg-red-600 shadow-red-900/50 hover:bg-red-500' : 'bg-green-600 shadow-green-900/50 hover:bg-green-500'}\`}
          >
            {isConverting ? <StopCircle className="w-3 h-3 sm:w-4 sm:h-4" /> : <PlayCircle className="w-3 h-3 sm:w-4 sm:h-4" />}
            <span className="hidden sm:inline">{isConverting ? 'STOP' : 'START'}</span>
          </button>
          
          <button 
            onClick={() => handleExportBatch()}
            disabled={isExportingBatch || images.filter(img => img.status === 'done').length === 0}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-purple-600 text-white font-bold text-[10px] sm:text-xs flex items-center gap-1.5 sm:gap-2 hover:bg-purple-500 transition-colors disabled:opacity-50 shadow-lg shadow-purple-900/50"
          >
            <DownloadCloud className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{isExportingBatch ? 'ZIPPING...' : 'ZIP EXPORT'}</span>
          </button>
        </div>
`;

code = code.replace(/<div className="flex gap-2">\s*\{isOfflineReady && \([\s\S]*?<\/div>\s*<\/div>/, newHeaderRight);

fs.writeFileSync('src/App.tsx', code);
