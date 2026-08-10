import React, { useCallback, useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { Upload, Download, Trash2, DownloadCloud, CheckCircle, FileImage, XCircle, Info, PlayCircle, StopCircle, Hourglass, Activity, LayoutDashboard, ShieldCheck, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ConvertedImage, Toast } from './types';
import { convertPngToJpeg, downloadBlob, formatBytes, playSuccessSound, showOSNotification } from './utils';
import { useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { UserDashboard } from './components/UserDashboard';
import { AdminPanel } from './components/AdminPanel';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

export default function App() {
  const { user, profile, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'converter' | 'dashboard' | 'admin'>('converter');
  const [images, setImages] = useState<ConvertedImage[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sessionStats, setSessionStats] = useState(() => {
    const saved = localStorage.getItem('sessionStats');
    const defaultStats = {
      fastestTime: Infinity,
      slowestTime: 0,
      totalProcessed: 0,
    };
    if (!saved) return defaultStats;
    try {
      const parsed = JSON.parse(saved);
      return {
        fastestTime: (typeof parsed.fastestTime === 'number' && !isNaN(parsed.fastestTime)) ? parsed.fastestTime : Infinity,
        slowestTime: (typeof parsed.slowestTime === 'number' && !isNaN(parsed.slowestTime)) ? parsed.slowestTime : 0,
        totalProcessed: (typeof parsed.totalProcessed === 'number' && !isNaN(parsed.totalProcessed)) ? parsed.totalProcessed : 0,
      };
    } catch {
      return defaultStats;
    }
  });

  useEffect(() => {
    localStorage.setItem('sessionStats', JSON.stringify(sessionStats));
  }, [sessionStats]);

  const [isOfflineReady, setIsOfflineReady] = useState(false);
  
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setIsOfflineReady(true);
      });
    }
  }, []);
  const [avgTimePerImage, setAvgTimePerImage] = useState<number>(500);
  const [isConverting, setIsConverting] = useState(false);
  const stopConversionRef = useRef(false);
  const recentTimesRef = useRef<{ timestamp: number, duration: number }[]>([]);
    const [autoExportOneByOne, setAutoExportOneByOne] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoExportOneByOne');
    return saved === 'true';
  });
  useEffect(() => {
    localStorage.setItem('autoExportOneByOne', autoExportOneByOne.toString());
  }, [autoExportOneByOne]);

  const autoExportOneByOneRef = useRef(autoExportOneByOne);
  useEffect(() => {
    autoExportOneByOneRef.current = autoExportOneByOne;
  }, [autoExportOneByOne]);

  const handleAutoExportOneByOneToggle = (checked: boolean) => {
    setAutoExportOneByOne(checked);
  };

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

  const toggleConversion = () => {
    if (!user) {
      setActiveTab('dashboard');
      addToast('Please sign in to process images', 'error');
      return;
    }

    if (isConverting) {
      stopConversionRef.current = true;
    } else {
      // Check credits before starting
      if (!profile?.isUnlimited && (profile?.credits || 0) <= 0) {
        addToast('No credits remaining. Please contact admin.', 'error');
        return;
      }
      stopConversionRef.current = false;
      startConversion();
    }
  };

  const startConversion = async () => {
    const pendingImages = images.filter(img => img.status === 'pending');
    if (pendingImages.length === 0) return;
    
    let allDone: ConvertedImage[] = [];
    setIsConverting(true);
    stopConversionRef.current = false;
    
    for (const imgObj of pendingImages) {
      if (stopConversionRef.current) break;

      // Check credits for each image (in case they run out mid-batch)
      if (!profile?.isUnlimited && (profile?.credits || 0) <= 0) {
        addToast('Ran out of credits!', 'error');
        break;
      }
      
      setImages(prev => prev.map(img => 
        img.id === imgObj.id ? { ...img, status: 'converting' } : img
      ));
      
      const startTime = performance.now();
      try {
        const jpegBlob = await convertPngToJpeg(imgObj.file);
        
        // Deduct credit & track processed
        if (profile) {
          const userDocRef = doc(db, 'users', profile.uid);
          updateDoc(userDocRef, {
            credits: profile.isUnlimited ? increment(0) : increment(-1),
            processedCount: increment(1)
          }).catch(err => console.error("Error updating stats:", err));
        }

        const endTime = performance.now();
        const timeTaken = Math.max(10, endTime - startTime);
        
        const now = Date.now();
        recentTimesRef.current.push({ timestamp: now, duration: timeTaken });
        recentTimesRef.current = recentTimesRef.current.filter(entry => now - entry.timestamp <= 5000);
        
        if (recentTimesRef.current.length > 0) {
          const avg = recentTimesRef.current.reduce((a, b) => a + b.duration, 0) / recentTimesRef.current.length;
          setAvgTimePerImage(avg);
        }
        
        setSessionStats(prev => ({
          fastestTime: Math.min(prev.fastestTime, timeTaken),
          slowestTime: Math.max(prev.slowestTime, timeTaken),
          totalProcessed: prev.totalProcessed + 1,
        }));
        
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
          return img;
        }));

        if (autoExportOneByOneRef.current) {
          const newName = imgObj.originalName.replace(/\.[^/.]+$/, "") + ".jpg";
          downloadBlob(jpegBlob, newName);
        }
      } catch (error) {
        console.error("Failed to convert image:", error);
        setImages(prev => prev.map(img => 
          img.id === imgObj.id ? { ...img, status: 'error' } : img
        ));
      }
    }
    
    setIsConverting(false);
    stopConversionRef.current = false;
    
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

  const handleExportBatch = async (overrideImages?: ConvertedImage[]) => {
    const doneImages = overrideImages || images.filter(img => img.status === 'done');
    if (doneImages.length === 0) return;

    setIsExportingBatch(true);
    addToast('Starting batch export...', 'info');
    try {
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

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#0A0518] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-500/20 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-white text-sm font-bold uppercase tracking-[0.2em] animate-pulse">Initializing Engine</h2>
          <p className="text-purple-400/40 text-[10px] font-mono">Securing environment & loading profile...</p>
        </div>
      </div>
    );
  }

  if (profile?.isBlocked) {
    return (
      <div className="h-screen w-full bg-[#0A0518] flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-red-500 mb-4">
          <XCircle className="w-16 h-16 mx-auto" />
        </div>
        <h2 className="text-white text-xl font-bold uppercase tracking-wider text-center">Account Suspended</h2>
        <p className="text-purple-400 text-sm text-center max-w-md">
          Your account has been blocked by the administrator. If you think this is a mistake, please contact support.
        </p>
        <button
          onClick={logout}
          className="mt-6 px-6 py-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors border border-red-500/20"
        >
          Sign Out
        </button>
      </div>
    );
  }

  const totalCount = images.length;
  const pendingCount = images.filter(img => img.status === 'pending').length;
  const doneCount = images.filter(img => img.status === 'done').length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const completedImages = images.filter(img => img.status === 'done');
  const totalOriginalSizeCompleted = completedImages.reduce((acc, img) => acc + img.originalSize, 0);
  const totalJpegSizeCompleted = completedImages.reduce((acc, img) => acc + (img.jpegSize || 0), 0);
  const totalSavedSize = Math.max(0, totalOriginalSizeCompleted - totalJpegSizeCompleted);
  const totalSavedPercent = totalOriginalSizeCompleted > 0 
    ? Math.round((totalSavedSize / totalOriginalSizeCompleted) * 100) 
    : 0;

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
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              STOCK<span className="text-purple-400">CONV</span>
              {isOfflineReady && (
                <span className="px-1.5 py-0.5 rounded bg-green-900/40 border border-green-500/30 text-[9px] font-mono text-green-400 flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                  OFFLINE
                </span>
              )}
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-purple-300/60">Pro Lossless PNG to JPEG</p>
          </div>
        </div>
        
        
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 justify-end">
          <div className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-4 sm:border-r border-purple-500/20">
             <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-purple-300 uppercase cursor-pointer" title="Automatically create ZIP when finished">
                <span className="hidden md:inline">Auto Batch</span>
                <span className="md:hidden">Batch</span>
                <div className="relative flex items-center">
                  <input type="checkbox" className="sr-only" checked={autoExport} onChange={(e) => handleAutoExportToggle(e.target.checked)} />
                  <div className={`w-6 sm:w-8 h-3 sm:h-4 rounded-full transition-colors ${autoExport ? 'bg-purple-600' : 'bg-purple-900/50'}`}></div>
                  <div className={`absolute left-0.5 top-0.5 w-2 sm:w-3 h-2 sm:h-3 bg-white rounded-full transition-transform ${autoExport ? 'translate-x-3 sm:translate-x-4' : ''}`}></div>
                </div>
             </label>
             <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-purple-300 uppercase cursor-pointer" title="Automatically download each image instantly">
                <span className="hidden md:inline">Auto One-by-One</span>
                <span className="md:hidden">1-by-1</span>
                <div className="relative flex items-center">
                  <input type="checkbox" className="sr-only" checked={autoExportOneByOne} onChange={(e) => handleAutoExportOneByOneToggle(e.target.checked)} />
                  <div className={`w-6 sm:w-8 h-3 sm:h-4 rounded-full transition-colors ${autoExportOneByOne ? 'bg-purple-600' : 'bg-purple-900/50'}`}></div>
                  <div className={`absolute left-0.5 top-0.5 w-2 sm:w-3 h-2 sm:h-3 bg-white rounded-full transition-transform ${autoExportOneByOne ? 'translate-x-3 sm:translate-x-4' : ''}`}></div>
                </div>
             </label>
          </div>
          
          <button 
            onClick={toggleConversion}
            disabled={images.filter(img => img.status === 'pending').length === 0 && !isConverting}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-white font-bold text-[10px] sm:text-xs flex items-center gap-1.5 sm:gap-2 transition-colors disabled:opacity-50 shadow-lg ${isConverting ? 'bg-red-600 shadow-red-900/50 hover:bg-red-500' : 'bg-green-600 shadow-green-900/50 hover:bg-green-500'}`}
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

      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-0">
        
        {/* Left Sidebar: Navigation & Config */}
        <aside className="col-span-1 lg:col-span-3 border-r border-purple-500/20 p-6 bg-[#0F0A24]/50 flex flex-col gap-6 overflow-y-auto">
          
          {/* Navigation Tabs */}
          <div className="flex flex-col gap-2 p-1 bg-purple-950/20 rounded-2xl border border-purple-500/10">
            <button 
              onClick={() => setActiveTab('converter')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${activeTab === 'converter' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-purple-300/60 hover:text-purple-200 hover:bg-purple-900/30'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Converter</span>
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-purple-300/60 hover:text-purple-200 hover:bg-purple-900/30'}`}
            >
              <User className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">{user ? 'Account' : 'Login'}</span>
            </button>
            {profile?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${activeTab === 'admin' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-purple-300/60 hover:text-purple-200 hover:bg-purple-900/30'}`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Admin</span>
              </button>
            )}
          </div>

          <div className="border-t border-purple-500/10 pt-6">
            <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4">Configuration</h2>
            
            <div className="space-y-4">
              

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

            <div className="mt-4 p-5 rounded-2xl bg-[#140D2B]/50 border border-purple-500/10 flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] font-bold text-purple-400/80 uppercase tracking-widest flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  Session Stats
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="flex flex-col">
                  <span className="text-purple-300/40 font-medium">Fastest</span>
                  <span className="font-mono text-purple-200">
                    { (typeof sessionStats.fastestTime !== 'number' || sessionStats.fastestTime === Infinity) ? '--' : `${sessionStats.fastestTime.toFixed(0)}ms`}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-purple-300/40 font-medium">Slowest</span>
                  <span className="font-mono text-purple-200">
                    { (typeof sessionStats.slowestTime !== 'number' || sessionStats.slowestTime === 0) ? '--' : `${sessionStats.slowestTime.toFixed(0)}ms`}
                  </span>
                </div>
                <div className="flex flex-col col-span-2 pt-2 border-t border-purple-500/10">
                  <span className="text-purple-300/40 font-medium">Processed</span>
                  <span className="font-mono text-white text-sm">
                    {sessionStats.totalProcessed} <span className="text-purple-300/40 text-[11px]">images</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          
        </aside>

        {/* Content Area */}
        <section className="col-span-1 lg:col-span-9 p-8 flex flex-col gap-6 h-full overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'converter' && (
              <motion.div 
                key="converter"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-6 h-full overflow-hidden"
              >
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
                  
                  {doneCount > 0 && (
                    <div className="mb-4 flex flex-wrap gap-4 text-[11px] font-mono p-3 bg-purple-900/20 border border-purple-500/10 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-purple-300/40">Total Original (Completed)</span>
                        <span className="text-purple-200 text-sm">{formatBytes(totalOriginalSizeCompleted)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-purple-300/40">Total Est. JPEG</span>
                        <span className="text-purple-200 text-sm">{formatBytes(totalJpegSizeCompleted)}</span>
                      </div>
                      <div className="flex flex-col ml-auto text-right">
                        <span className="text-purple-300/40">Space Saved</span>
                        <span className="text-green-400 text-sm">-{formatBytes(totalSavedSize)} ({totalSavedPercent}%)</span>
                      </div>
                    </div>
                  )}

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
              </motion.div>
            )}

            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-y-auto custom-scrollbar"
              >
                {!user ? <Login /> : <UserDashboard />}
              </motion.div>
            )}
            
            {activeTab === 'admin' && profile?.role === 'admin' && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-y-auto custom-scrollbar"
              >
                <AdminPanel />
              </motion.div>
            )}
          </AnimatePresence>
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
