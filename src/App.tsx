import React, { useCallback, useState, useEffect } from 'react';
import JSZip from 'jszip';
import { Upload, Download, Trash2, DownloadCloud, CheckCircle, FileImage, XCircle, Info, PlayCircle, Hourglass } from 'lucide-react';
import { ConvertedImage, Toast } from './types';
import { convertPngToJpeg, downloadBlob, formatBytes, playSuccessSound, showOSNotification } from './utils';

export default function App() {
  const [images, setImages] = useState<ConvertedImage[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [avgTimePerImage, setAvgTimePerImage] = useState<number>(500);
  const [isConverting, setIsConverting] = useState(false);
  const [autoExport, setAutoExport] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoExport');
    return saved === 'true';
  });
  const [isExportingBatch, setIsExportingBatch] = useState(false);

  useEffect(() => {
    localStorage.setItem('autoExport', autoExport.toString());
  }, [autoExport]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const handleAutoExportToggle = (checked: boolean) => {
    setAutoExport(checked);
    if (checked && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files).filter(file => file.type === 'image/png');
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
  }, []);

  const handleExportBatch = async (overrideImages?: ConvertedImage[]) => {
    const doneImages = overrideImages || images.filter(img => img.status === 'done');
    if (doneImages.length === 0) return;

    setIsExportingBatch(true);
    addToast('Starting batch export...', 'info');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      doneImages.forEach(img => {
        if (img.blob) {
          const newName = img.originalName.replace(/\.[^/.]+$/, "") + ".jpg";
          zip.file(newName, img.blob);
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, 'converted_images.zip');
      
      addToast(`Successfully exported ${doneImages.length} images!`, 'success');
      playSuccessSound();
      showOSNotification('Batch Export Complete', {
        body: `Successfully exported ${doneImages.length} images.`,
      });
    } catch (error) {
      console.error("Batch export failed:", error);
      addToast('Failed to create batch export zip.', 'error');
    } finally {
      setIsExportingBatch(false);
    }
  };

  const startConversion = async () => {
    const pendingImages = images.filter(img => img.status === 'pending');
    if (pendingImages.length === 0) return;
    
    let allDone: ConvertedImage[] = [];
    setIsConverting(true);
    
    for (const imgObj of pendingImages) {
      setImages(prev => prev.map(img => 
        img.id === imgObj.id ? { ...img, status: 'converting' } : img
      ));
      
      const startTime = performance.now();
      try {
        const jpegBlob = await convertPngToJpeg(imgObj.file);
        const endTime = performance.now();
        const timeTaken = Math.max(10, endTime - startTime);
        setAvgTimePerImage(prev => (prev + timeTaken) / 2);
        
        setImages(prev => prev.map(img => {
          if (img.id === imgObj.id) {
            const updated = { 
              ...img, 
              status: 'done' as const, 
              blob: jpegBlob, 
              jpegSize: jpegBlob.size 
            };
            allDone.push(updated);
            return updated;
          }
          if (img.status === 'done') {
            allDone.push(img);
          }
          return img;
        }));
      } catch (error) {
        console.error("Failed to convert image:", error);
        setImages(prev => prev.map(img => 
          img.id === imgObj.id ? { ...img, status: 'error' } : img
        ));
      }
    }
    
    setIsConverting(false);
    
    // We wait slightly to make sure the state is updated
    setTimeout(() => {
      setImages(prev => {
        const currentDone = prev.filter(img => img.status === 'done');
        if (autoExport && currentDone.length > 0) {
          handleExportBatch(currentDone);
        }
        return prev;
      });
    }, 100);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const toRemove = prev.find(img => img.id === id);
      if (toRemove && toRemove.previewUrl) {
        URL.revokeObjectURL(toRemove.previewUrl);
      }
      return filtered;
    });
  };

  const clearAll = () => {
    images.forEach(img => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setImages([]);
  };

  const totalCount = images.length;
  const pendingCount = images.filter(img => img.status === 'pending').length;
  const doneCount = images.filter(img => img.status === 'done').length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const estimatedMs = pendingCount * avgTimePerImage;
  const estimatedSeconds = Math.ceil(estimatedMs / 1000);

  return (
    <div className="h-full w-full bg-[#0A0518] text-[#E0D7FF] font-sans flex flex-col">
      <header className="p-6 border-b border-purple-500/20 flex justify-between items-center bg-[#0F0A24] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.5)]">
            <FileImage className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">STOCK<span className="text-purple-400">CONV</span></h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-purple-300/60">Pro Lossless PNG to JPEG</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="px-3 py-1 rounded bg-purple-900/40 border border-purple-500/30 text-[11px] font-mono">
            CLIENT-SIDE CONVERSION
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-0">
        
        {/* Left Sidebar: Config */}
        <aside className="col-span-1 lg:col-span-3 border-r border-purple-500/20 p-6 bg-[#0F0A24]/50 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4">Configuration</h2>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 rounded-xl bg-purple-900/20 border border-purple-500/10 cursor-pointer hover:border-purple-500/30 transition-colors">
                <span className="text-sm font-medium">Auto-Export (Batch Only)</span>
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={autoExport}
                    onChange={(e) => handleAutoExportToggle(e.target.checked)}
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors ${autoExport ? 'bg-purple-600' : 'bg-purple-900/50'}`}></div>
                  <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${autoExport ? 'translate-x-5' : ''}`}></div>
                </div>
              </label>

              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <h3 className="text-xs font-semibold text-purple-200 mb-2">Quality & Compression</h3>
                <p className="text-[11px] leading-relaxed text-purple-300/60">No additional compression applied. Images converted at 100% highest quality natively.</p>
              </div>
            </div>

            <div className="mt-6 p-6 rounded-2xl bg-[#140D2B] border border-purple-500/20 shadow-lg shadow-purple-900/20 flex flex-col items-center">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4">Estimated Time</h3>
              <div className="relative w-24 h-24 flex items-center justify-center mb-2">
                <div className={`absolute inset-0 bg-purple-500/10 rounded-full blur-xl ${isConverting ? 'animate-pulse' : ''}`}></div>
                <Hourglass className={`w-12 h-12 text-purple-400 ${isConverting ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              </div>
              <div className="text-2xl font-mono font-bold text-white tracking-wider">
                {pendingCount === 0 ? '00:00' : `${Math.floor(estimatedSeconds / 60).toString().padStart(2, '0')}:${(estimatedSeconds % 60).toString().padStart(2, '0')}`}
              </div>
              <div className="text-xs text-purple-300/50 mt-2">
                 {isConverting ? 'Processing...' : (pendingCount > 0 ? 'Ready to process' : 'All done')}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6 lg:pt-0">
            <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4">Export Mode</h2>
            <div className="grid gap-2">
              <button 
                onClick={startConversion}
                disabled={pendingCount === 0}
                className="w-full flex items-center justify-center space-x-2 py-3 rounded-lg bg-green-600 text-white font-bold text-sm shadow-lg shadow-green-900/50 hover:bg-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayCircle className="w-4 h-4" />
                <span>START CONVERSION</span>
              </button>

              <button 
                onClick={handleExportBatch}
                disabled={isExportingBatch || doneCount === 0}
                className="w-full flex items-center justify-center space-x-2 py-3 rounded-lg bg-purple-600 text-white font-bold text-sm shadow-lg shadow-purple-900/50 hover:bg-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>{isExportingBatch ? 'ZIPPING...' : 'BATCH (.ZIP)'}</span>
              </button>
              
              <button 
                onClick={clearAll}
                disabled={images.length === 0}
                className="w-full py-3 rounded-lg bg-transparent border border-purple-500/40 text-purple-300 font-bold text-sm hover:bg-purple-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CLEAR ALL
              </button>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <section className="col-span-1 lg:col-span-9 p-8 flex flex-col gap-6 h-full overflow-hidden">
          
          {/* Drop Zone */}
          <div 
            className="shrink-0 h-48 sm:h-64 border-2 border-dashed border-purple-500/30 rounded-3xl bg-purple-500/5 flex flex-col items-center justify-center gap-4 relative group cursor-pointer hover:bg-purple-500/10 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input 
              id="file-upload" 
              type="file" 
              multiple 
              accept="image/png" 
              className="hidden" 
              onChange={handleFileInput}
            />
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-purple-400" />
            </div>
            <div className="text-center px-4">
              <p className="text-lg font-semibold text-white">Drop your Adobe Stock PNGs here</p>
              <p className="text-sm text-purple-300/50 mt-1">PNG files only. Highest quality JPEG output.</p>
            </div>
            <button className="mt-2 px-6 py-2 bg-purple-600 rounded-full text-xs font-bold uppercase tracking-wider shadow-md hover:bg-purple-500 transition-colors">Browse Files</button>
          </div>

          {/* Processing Queue */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex flex-col mb-4 shrink-0 gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">File Queue <span className="text-purple-500 font-mono text-xs ml-2">({totalCount})</span></h2>
                {totalCount > 0 && (
                   <span className="text-xs font-mono text-purple-400">{progressPercent}% Completed</span>
                )}
              </div>
              {totalCount > 0 && (
                <div className="w-full h-1.5 bg-purple-900/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
              {images.map(img => (
                <div key={img.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-[#140D2B] rounded-2xl border border-purple-500/10 transition-colors hover:border-purple-500/30">
                  <div className="w-16 h-16 shrink-0 rounded-lg bg-[#0F0A24] overflow-hidden flex items-center justify-center border border-purple-500/20">
                    <img src={img.previewUrl} alt={img.originalName} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-purple-100 truncate" title={img.originalName}>{img.originalName}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span className="text-[10px] text-purple-400/60 font-mono">{formatBytes(img.originalSize)} &rarr; {img.jpegSize ? formatBytes(img.jpegSize) : '...'}</span>
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
                         onClick={(e) => { e.stopPropagation(); downloadBlob(img.blob, img.originalName.replace(/\.[^/.]+$/, "") + ".jpg"); }}
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
              ))}
              {images.length === 0 && (
                <div className="h-full flex items-center justify-center text-purple-300/40 text-sm">
                  No files in queue
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="p-4 px-6 sm:px-8 bg-[#0F0A24] border-t border-purple-500/20 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-6">
          <span className="text-[10px] text-purple-300/40 font-medium uppercase tracking-widest italic">Optimized for Adobe Stock Contributors</span>
        </div>
        <div className="text-center sm:text-right">
          <p className="text-[11px] text-purple-300/50 font-medium">© {new Date().getFullYear()} StockConv — Developed by <span className="text-purple-400 font-semibold">Shahin Alam Emon</span></p>
        </div>
      </footer>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
              toast.type === 'success' ? 'bg-green-900/90 border-green-500/50 text-green-100' :
              toast.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-100' :
              'bg-[#140D2B]/90 border-purple-500/50 text-purple-100'
            } backdrop-blur-sm animate-in slide-in-from-right-8 fade-in duration-300`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-purple-400" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
