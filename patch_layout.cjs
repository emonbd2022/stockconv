const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Fix duplicate images in handleFiles
const oldHandleFiles = `  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files).filter(file => file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg');
    if (fileArray.length === 0) return;

    const newImages: ConvertedImage[] = fileArray.map(file => ({
      id: crypto.randomUUID(),
      originalName: file.name,
      originalSize: file.size,
      previewUrl: URL.createObjectURL(file),
      file: file,
      status: 'pending'
    }));

    setImages(prev => [...prev, ...newImages]);
  }, []);`;

const newHandleFiles = `  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files).filter(file => file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg');
    if (fileArray.length === 0) return;

    setImages(prev => {
      // Prevent duplicates by checking name and size
      const existingSignatures = new Set(prev.map(img => \`\${img.originalName}-\${img.originalSize}\`));
      const uniqueNewFiles = fileArray.filter(file => !existingSignatures.has(\`\${file.name}-\${file.size}\`));
      
      if (uniqueNewFiles.length === 0) {
        return prev; // All selected files are duplicates
      }

      const newImages: ConvertedImage[] = uniqueNewFiles.map(file => ({
        id: crypto.randomUUID(),
        originalName: file.name,
        originalSize: file.size,
        previewUrl: URL.createObjectURL(file),
        file: file,
        status: 'pending'
      }));

      return [...prev, ...newImages];
    });
  }, []);`;

code = code.replace(oldHandleFiles, newHandleFiles);

// 2. Adjust Sidebar and Main Layout
// Replace grid with flex, make sidebar smaller (w-64)
code = code.replace(
  '<main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-0">',
  '<main className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden min-h-0">'
);

code = code.replace(
  '<aside className="col-span-1 lg:col-span-3 border-r border-purple-500/20 p-6 bg-[#0F0A24]/50 flex flex-col gap-6 overflow-y-auto">',
  '<aside className="w-full lg:w-64 xl:w-72 border-b lg:border-b-0 lg:border-r border-purple-500/20 p-4 lg:p-5 bg-[#0F0A24]/50 flex flex-col gap-4 overflow-y-auto shrink-0">'
);

code = code.replace(
  '<section className="col-span-1 lg:col-span-9 p-6 bg-[#0A0518] relative overflow-hidden flex flex-col">',
  '<section className="flex-1 p-4 lg:p-6 bg-[#0A0518] relative overflow-hidden flex flex-col min-w-0">'
);

// 3. Make Drop Zone smaller
code = code.replace(
  'className="shrink-0 h-48 sm:h-64 border-2 border-dashed border-purple-500/30 rounded-3xl bg-purple-500/5 flex flex-col items-center justify-center gap-4 relative group cursor-pointer hover:bg-purple-500/10 transition-colors"',
  'className="shrink-0 h-32 sm:h-40 border-2 border-dashed border-purple-500/30 rounded-2xl bg-purple-500/5 flex flex-col items-center justify-center gap-3 relative group cursor-pointer hover:bg-purple-500/10 transition-colors"'
);

// Also replace the Upload icon background to be smaller in the dropzone
code = code.replace(
  '<div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">',
  '<div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">'
);
code = code.replace(
  '<Upload className="w-8 h-8 text-purple-400" />',
  '<Upload className="w-6 h-6 text-purple-400" />'
);

// Adjust dropzone text sizes
code = code.replace(
  '<p className="text-lg font-semibold text-white">Drop your Adobe Stock PNGs here</p>',
  '<p className="text-base font-semibold text-white">Drop your Adobe Stock PNGs here</p>'
);
code = code.replace(
  '<p className="text-sm text-purple-300/50 mt-1">PNG files only. Highest quality JPEG output.</p>',
  '<p className="text-xs text-purple-300/50 mt-1">PNG files only. Highest quality JPEG output.</p>'
);
code = code.replace(
  '<button className="mt-2 px-6 py-2 bg-purple-600 rounded-full text-xs font-bold uppercase tracking-wider shadow-md hover:bg-purple-500 transition-colors">Browse Files</button>',
  '<button className="mt-1 px-5 py-1.5 bg-purple-600 rounded-full text-xs font-bold uppercase tracking-wider shadow-md hover:bg-purple-500 transition-colors">Browse Files</button>'
);

fs.writeFileSync('src/App.tsx', code);
