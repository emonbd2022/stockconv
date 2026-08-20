import React, { useCallback, useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { Upload, Download, Trash2, DownloadCloud, CheckCircle, FileImage, XCircle, Info, PlayCircle, StopCircle, Hourglass, Activity, LayoutDashboard, ShieldCheck, User, CheckCheck, Sliders, ChevronDown, HelpCircle, Keyboard, Save } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ConvertedImage, Toast } from './types';
import { convertImage, downloadBlob, formatBytes, playSuccessSound, showOSNotification } from './utils';
import { loadQueueFromStorage, saveQueueToStorage, clearQueueStorage } from './queueStorage';
import { useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { UserDashboard } from './components/UserDashboard';
import { AdminPanel } from './components/AdminPanel';
import { ConversionProgressOverlay, ActiveConversionItem } from './components/ConversionProgressOverlay';
import { CompletionModal } from './components/CompletionModal';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

export default function App() {
  const { user, profile, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'converter' | 'dashboard' | 'admin'>('converter');
  const [images, setImages] = useState<ConvertedImage[]>([]);
  const [isQueueLoaded, setIsQueueLoaded] = useState(false);
  const [creatorName, setCreatorName] = useState(() => profile?.creatorName || user?.displayName || '');
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
  }, [creatorName, enableCreator, user, profile]);
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
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionStats, setCompletionStats] = useState({ total: 0, successful: 0, needsDownload: false });
  const [activeConversion, setActiveConversion] = useState<ActiveConversionItem | null>(null);
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
    if (checked) setAutoExport(false);
  };

  const [autoExport, setAutoExport] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoExport');
    return saved === 'true';
  });
  const [isExportingBatch, setIsExportingBatch] = useState(false);

  const [jpegQuality, setJpegQuality] = useState<number>(() => {
    const saved = localStorage.getItem('jpegQuality');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 10 && parsed <= 100) return parsed;
    }
    return 100;
  });

  useEffect(() => {
    localStorage.setItem('jpegQuality', jpegQuality.toString());
  }, [jpegQuality]);

  useEffect(() => {
    localStorage.setItem('autoExport', autoExport.toString());
  }, [autoExport]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUnfinishedImages = isConverting || images.some(img => img.status === 'pending' || img.status === 'converting');
      if (hasUnfinishedImages) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isConverting, images]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Restore saved queue state on startup/refresh
  useEffect(() => {
    loadQueueFromStorage().then(restored => {
      if (restored && restored.length > 0) {
        setImages(restored);
        const pendingCount = restored.filter(img => img.status === 'pending').length;
        const doneCount = restored.filter(img => img.status === 'done').length;
        addToast(
          `Restored queue with ${restored.length} ${restored.length === 1 ? 'file' : 'files'} (${doneCount} done, ${pendingCount} pending)`,
          'info'
        );
      }
      setIsQueueLoaded(true);
    }).catch(err => {
      console.warn("Failed to restore queue from storage:", err);
      setIsQueueLoaded(true);
    });
  }, [addToast]);

  // Persist queue state whenever images change after initial load
  useEffect(() => {
    if (!isQueueLoaded) return;
    saveQueueToStorage(images);
  }, [images, isQueueLoaded]);

  const handleAutoExportToggle = (checked: boolean) => {
    setAutoExport(checked);
    if (checked) setAutoExportOneByOne(false);
    if (checked && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files).filter(file => file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg');
    if (fileArray.length === 0) return;

    setImages(prev => {
      // Prevent duplicates by checking name and size
      const existingSignatures = new Set(prev.map(img => `${img.originalName}-${img.originalSize}`));
      const uniqueNewFiles = fileArray.filter(file => !existingSignatures.has(`${file.name}-${file.size}`));
      
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
  }, []);

  const updateServerExportStats = useCallback((count: number) => {
    if (!profile || count <= 0) return;
    const userDocRef = doc(db, 'users', profile.uid);
    updateDoc(userDocRef, {
      credits: profile.isUnlimited ? increment(0) : increment(-count),
      processedCount: increment(count)
    }).catch(err => console.error("Error updating export stats on server:", err));
  }, [profile]);

  const toggleConversion = () => {
    if (!user) {
      setActiveTab('dashboard');
      addToast('Please sign in to process images', 'error');
      return;
    }

    if (isConverting) {
      stopConversionRef.current = true;
      setIsConverting(false);
      setActiveConversion(null);
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
    
    // Temporary variables for tracking process and export in batch
    let successfulConversionsCount = 0;
    let oneByOneExportedCount = 0;
    let localCredits = profile?.credits || 0;
    let currentIndex = 0;
    const totalPendingCount = pendingImages.length;
    
    for (const imgObj of pendingImages) {
      if (stopConversionRef.current) break;
      currentIndex++;

      // Check credits for each image using local tracker
      if (!profile?.isUnlimited && localCredits <= 0) {
        addToast('Ran out of credits!', 'error');
        break;
      }

      setActiveConversion({
        id: imgObj.id,
        originalName: imgObj.originalName,
        originalSize: imgObj.originalSize,
        previewUrl: imgObj.previewUrl,
        progress: 10,
        stage: 'Initializing engine & reading file...',
        currentIndex,
        totalInBatch: totalPendingCount
      });
      
      setImages(prev => prev.map(img => 
        img.id === imgObj.id ? { ...img, status: 'converting', progress: 10, stage: 'Starting conversion...' } : img
      ));
      
      const startTime = performance.now();
      try {
        const finalCreatorName = enableCreator ? (creatorName.trim() || user?.displayName || 'Unknown Creator') : '';
        const convertedBlob = await convertImage(
          imgObj.file, 
          finalCreatorName, 
          jpegQuality,
          (progress, stage) => {
            setActiveConversion(prev => prev && prev.id === imgObj.id ? { ...prev, progress, stage } : prev);
            setImages(prev => prev.map(img => 
              img.id === imgObj.id ? { ...img, progress, stage } : img
            ));
          }
        );
        
        // Track success locally in temporary variable
        successfulConversionsCount++;
        if (!profile?.isUnlimited) {
          localCredits--;
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
        
        const isOneByOne = autoExportOneByOneRef.current;
        if (isOneByOne) {
          const newName = imgObj.originalName.replace(/\.[^/.]+$/, "") + ".jpg";
          downloadBlob(convertedBlob, newName);
          oneByOneExportedCount++;
        }

        setImages(prev => prev.map(img => {
          if (img.id === imgObj.id) {
            const updated = { 
              ...img, 
              status: 'done' as const, 
              progress: 100,
              stage: 'Completed',
              blob: convertedBlob, 
              convertedSize: convertedBlob.size,
              isExported: isOneByOne ? true : img.isExported
            };
            allDone.push(updated);
            return updated;
          }
          return img;
        }));
      } catch (error) {
        console.error("Failed to convert image:", error);
        setImages(prev => prev.map(img => 
          img.id === imgObj.id ? { ...img, status: 'error', progress: 0, stage: 'Failed' } : img
        ));
      }
    }
    
    // If one by one export: update total count in server after the last file export
    if (oneByOneExportedCount > 0) {
      updateServerExportStats(oneByOneExportedCount);
    }
    
    setIsConverting(false);
    setActiveConversion(null);
    stopConversionRef.current = false;
    
    setTimeout(() => {
      setImages(prev => {
        const currentDone = prev.filter(img => img.status === 'done');
        if (autoExport && currentDone.length > 0) {
          handleExportBatch(currentDone).then(() => {
            if (totalPendingCount > 0) {
              setCompletionStats({ total: totalPendingCount, successful: successfulConversionsCount, needsDownload: false });
              setShowCompletionModal(true);
            }
            if (totalPendingCount > 0) {
              setImages([]);
            }
          });
          return prev;
        } else {
          if (totalPendingCount > 0) {
            setCompletionStats({ total: totalPendingCount, successful: successfulConversionsCount, needsDownload: !autoExportOneByOneRef.current });
            setShowCompletionModal(true);
          }
          if (autoExportOneByOneRef.current && totalPendingCount > 0) {
            return [];
          }
          return prev;
        }
      });
    }, 100);
  };

  const handleExportBatch = async (overrideImages?: ConvertedImage[]) => {
    const doneImages = (overrideImages || images).filter(img => img.status === 'done' && img.blob);
    if (doneImages.length === 0) return;

    setIsExportingBatch(true);
    addToast('Starting batch export...', 'info');
    try {
      const zip = new JSZip();
      doneImages.forEach(img => {
        if (img.blob) {
          const newName = img.originalName.replace(/\.[^/.]+$/, "") + (img.file.type === "image/png" ? ".jpg" : ".png");
          zip.file(newName, img.blob);
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const finalCreatorName = enableCreator ? (creatorName.trim() || user?.displayName || 'UnknownCreator') : 'Export';
      const safeCreatorName = finalCreatorName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const zipFileName = `${doneImages.length}_converted_images_for_${safeCreatorName}.zip`;
      downloadBlob(zipBlob, zipFileName);
      
      // Update server count after successful zip export
      const unexportedCount = doneImages.filter(img => !img.isExported).length;
      const exportCount = unexportedCount > 0 ? unexportedCount : doneImages.length;
      updateServerExportStats(exportCount);

      // Mark all exported images as exported
      setImages(prev => prev.map(img => 
        doneImages.some(d => d.id === img.id) ? { ...img, isExported: true } : img
      ));

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

  const handleDownloadSingle = (img: ConvertedImage) => {
    if (!img.blob) return;
    const newName = img.originalName.replace(/\.[^/.]+$/, "") + ".jpg";
    downloadBlob(img.blob, newName);

    if (!img.isExported) {
      setImages(prev => prev.map(item => item.id === img.id ? { ...item, isExported: true } : item));
      updateServerExportStats(1);
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

  const clearFinished = () => {
    setImages(prev => {
      const remaining: ConvertedImage[] = [];
      let clearedCount = 0;
      prev.forEach(img => {
        if (img.status === 'done') {
          clearedCount++;
          if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
        } else {
          remaining.push(img);
        }
      });
      if (clearedCount > 0) {
        addToast(`Cleared ${clearedCount} finished ${clearedCount === 1 ? 'image' : 'images'} from queue`, 'info');
      }
      return remaining;
    });
  };

  const clearAll = useCallback(() => {
    setImages(prev => {
      prev.forEach(img => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
      return [];
    });
    clearQueueStorage();
    addToast('Queue cleared', 'info');
  }, [addToast]);

  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable);

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl + O: Upload files
      if (isCtrlOrCmd && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        const fileInput = document.getElementById('file-upload') as HTMLInputElement | null;
        if (fileInput) {
          fileInput.click();
        }
        return;
      }

      // Ctrl + S: Save project / Save state
      if (isCtrlOrCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (images.length > 0) {
          saveQueueToStorage(images);
          addToast(`Project state saved (${images.length} images in queue)`, 'success');
        } else {
          addToast('Project state is already empty and synchronized', 'info');
        }
        return;
      }

      // Ctrl + Enter: Start / Pause (Toggle conversion)
      if (isCtrlOrCmd && e.key === 'Enter') {
        e.preventDefault();
        toggleConversion();
        return;
      }

      // Ctrl + Backspace: Clear the queue
      if (isCtrlOrCmd && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        clearAll();
        return;
      }

      // Space: Toggle conversion (when not typing inside an input)
      if (e.code === 'Space' || e.key === ' ') {
        if (!isInput) {
          e.preventDefault();
          toggleConversion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [images, isConverting, user, profile, toggleConversion, clearAll, addToast]);

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
  const totalConvertedSizeCompleted = completedImages.reduce((acc, img) => acc + (img.convertedSize || 0), 0);
  const totalSavedSize = Math.max(0, totalOriginalSizeCompleted - totalConvertedSizeCompleted);
  const totalSavedPercent = totalOriginalSizeCompleted > 0 
    ? Math.round((totalSavedSize / totalOriginalSizeCompleted) * 100) 
    : 0;

  const estimatedMs = pendingCount * avgTimePerImage;
  const estimatedSeconds = Math.ceil(estimatedMs / 1000);

  return (
    <div className="h-screen w-full bg-[#0A0518] text-[#E0D7FF] font-sans flex flex-col overflow-hidden">
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
            <p className="text-[10px] uppercase tracking-[0.2em] text-purple-300/60">Pro Lossless Image Converter</p>
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
          
          <div className="relative group">
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="p-1.5 sm:p-2 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:text-white hover:bg-purple-900/50 hover:border-purple-400 transition-all flex items-center justify-center shadow-md cursor-pointer"
              title="Keyboard Shortcuts"
              aria-label="Keyboard Shortcuts"
            >
              <HelpCircle className="w-4 h-4 sm:w-4 sm:h-4 text-purple-400" />
            </button>

            {/* Hover Tooltip Menu */}
            <div className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-[#120B2E] border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-950/80 backdrop-blur-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
              <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-purple-500/20">
                <Keyboard className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">Keyboard Shortcuts</span>
              </div>
              <div className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-purple-200/80">Upload Images</span>
                  <kbd className="px-1.5 py-0.5 bg-purple-950/80 border border-purple-500/40 rounded text-[10px] font-mono text-purple-300 font-bold">Ctrl + O</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-200/80">Save Project</span>
                  <kbd className="px-1.5 py-0.5 bg-purple-950/80 border border-purple-500/40 rounded text-[10px] font-mono text-purple-300 font-bold">Ctrl + S</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-200/80">Start / Pause</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-purple-950/80 border border-purple-500/40 rounded text-[10px] font-mono text-purple-300 font-bold">Ctrl + ↵</kbd>
                    <span className="text-[9px] text-purple-400/60">or</span>
                    <kbd className="px-1.5 py-0.5 bg-purple-950/80 border border-purple-500/40 rounded text-[10px] font-mono text-purple-300 font-bold">Space</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-200/80">Clear Queue</span>
                  <kbd className="px-1.5 py-0.5 bg-purple-950/80 border border-purple-500/40 rounded text-[10px] font-mono text-purple-300 font-bold">Ctrl + ⌫</kbd>
                </div>
              </div>
            </div>
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

      <main className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden min-h-0">
        
        {/* Left Sidebar: Navigation & Config */}
        <aside className="w-full lg:w-64 xl:w-72 border-b lg:border-b-0 lg:border-r border-purple-500/20 p-4 lg:p-5 bg-[#0F0A24]/50 flex flex-col gap-4 overflow-y-auto shrink-0">
          
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
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-purple-200 uppercase tracking-widest cursor-pointer select-none" onClick={() => setEnableCreator(!enableCreator)}>Inject Creator Name</label>
                  <button
                    onClick={() => setEnableCreator(!enableCreator)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none ${enableCreator ? 'bg-purple-500' : 'bg-[#0F0A24] border border-purple-500/30'}`}
                    aria-pressed={enableCreator}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${enableCreator ? 'translate-x-[22px]' : 'translate-x-1'}`}
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
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="jpeg-quality-select" className="text-xs font-semibold text-purple-200 uppercase tracking-widest flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-400" />
                    <span>JPEG Quality</span>
                  </label>
                  <span className="text-[11px] font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-500/20">
                    {jpegQuality}%
                  </span>
                </div>
                <div className="relative">
                  <select
                    id="jpeg-quality-select"
                    value={jpegQuality}
                    onChange={(e) => setJpegQuality(Number(e.target.value))}
                    disabled={isConverting}
                    className="w-full bg-[#0F0A24] border border-purple-500/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors appearance-none cursor-pointer pr-9 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value={100} className="bg-[#0F0A24] text-white">100% (Maximum / Lossless)</option>
                    <option value={95} className="bg-[#0F0A24] text-white">95% (High Quality)</option>
                    <option value={90} className="bg-[#0F0A24] text-white">90% (Recommended / Balanced)</option>
                    <option value={85} className="bg-[#0F0A24] text-white">85% (High Compression)</option>
                    <option value={80} className="bg-[#0F0A24] text-white">80% (Optimized Size)</option>
                    <option value={75} className="bg-[#0F0A24] text-white">75% (Small Size)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
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
            <div className="mt-4 p-4 rounded-2xl bg-[#140D2B]/50 border border-purple-500/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-purple-400/80 uppercase tracking-widest flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-purple-400" />
                  Shortcuts
                </h3>
                <button
                  onClick={() => setShowShortcutsModal(true)}
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-medium underline"
                >
                  View all
                </button>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-purple-300/70">
                  <span>Upload</span>
                  <kbd className="px-1.5 py-0.5 bg-purple-950/60 border border-purple-500/30 rounded text-[10px] font-mono text-purple-300">Ctrl+O</kbd>
                </div>
                <div className="flex items-center justify-between text-purple-300/70">
                  <span>Save State</span>
                  <kbd className="px-1.5 py-0.5 bg-purple-950/60 border border-purple-500/30 rounded text-[10px] font-mono text-purple-300">Ctrl+S</kbd>
                </div>
                <div className="flex items-center justify-between text-purple-300/70">
                  <span>Start / Pause</span>
                  <kbd className="px-1.5 py-0.5 bg-purple-950/60 border border-purple-500/30 rounded text-[10px] font-mono text-purple-300">Ctrl+↵ / Space</kbd>
                </div>
                <div className="flex items-center justify-between text-purple-300/70">
                  <span>Clear Queue</span>
                  <kbd className="px-1.5 py-0.5 bg-purple-950/60 border border-purple-500/30 rounded text-[10px] font-mono text-purple-300">Ctrl+⌫</kbd>
                </div>
              </div>
            </div>
          </div>

          
        </aside>

        {/* Content Area */}
        <section className="flex-1 p-4 lg:p-6 lg:p-8 bg-[#0A0518] flex flex-col gap-6 h-full overflow-hidden relative min-w-0">
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
                  className="shrink-0 w-full h-auto py-4 sm:py-6 border-2 border-dashed border-purple-500/30 rounded-2xl bg-purple-500/5 flex flex-col items-center justify-center gap-2 relative group cursor-pointer hover:bg-purple-500/10 transition-colors"
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
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-sm font-semibold text-white">Drop your Adobe Stock PNGs here</p>
                    <p className="text-xs text-purple-300/50 mt-1">PNG files only. Highest quality JPEG output.</p>
                  </div>
                  <button className="mt-1 px-4 py-1 bg-purple-600 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md hover:bg-purple-500 transition-colors">Browse Files</button>
                </div>

                {/* Processing Queue */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  <div className="flex flex-col mb-4 shrink-0 gap-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">File Queue <span className="text-purple-500 font-mono text-xs ml-2">({totalCount})</span></h2>
                        {totalCount > 0 && (
                          <span className="text-xs font-mono text-purple-400">({progressPercent}% Completed)</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {doneCount > 0 && (
                          <button
                            id="clear-finished-btn"
                            onClick={clearFinished}
                            disabled={isConverting}
                            className="px-3 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 hover:text-white border border-purple-500/30 hover:border-purple-400/50 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Remove only successfully converted images from the queue"
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-purple-400" />
                            <span>Clear Finished</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                              {doneCount}
                            </span>
                          </button>
                        )}
                        {totalCount > 0 && (
                          <button
                            id="clear-all-btn"
                            onClick={clearAll}
                            disabled={isConverting}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-950/30 hover:bg-red-950/40 text-purple-400/70 hover:text-red-300 border border-purple-500/10 hover:border-red-500/30 text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Clear entire queue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Clear All</span>
                          </button>
                        )}
                      </div>
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
                        <span className="text-purple-300/40">Total Converted Size</span>
                        <span className="text-purple-200 text-sm">{formatBytes(totalConvertedSizeCompleted)}</span>
                      </div>
                      <div className="flex flex-col ml-auto text-right">
                        <span className="text-purple-300/40">Space Saved</span>
                        <span className="text-green-400 text-sm">-{formatBytes(totalSavedSize)} ({totalSavedPercent}%)</span>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 overflow-y-auto pr-2 custom-scrollbar content-start">
                    {images.map(img => (
                      <div key={img.id} className="flex flex-col gap-3 p-3 bg-[#140D2B] rounded-2xl border border-purple-500/10 transition-colors hover:border-purple-500/30">
                        <div className={`w-full aspect-square shrink-0 rounded-xl bg-[#0F0A24] overflow-hidden flex items-center justify-center relative group transition-all duration-300 ${img.status === 'converting' ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#140D2B] shadow-[0_0_15px_rgba(34,211,238,0.5)]' : 'border border-purple-500/20'}`}>
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
                              {img.status === 'converting' && <span className="text-[10px] text-cyan-400 uppercase font-mono animate-pulse">Converting...</span>}
                              {img.status === 'error' && <span className="text-[10px] text-red-400 uppercase font-mono">Failed</span>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 z-10">
                              {img.status === 'done' && (
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); handleDownloadSingle(img); }}
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

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showShortcutsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#120B2E] border border-purple-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-purple-950/80 overflow-hidden relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-purple-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-purple-300">
                    <Keyboard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide">Keyboard Shortcuts</h3>
                    <p className="text-[11px] text-purple-300/60 font-medium">Power up your batch conversion workflow</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShortcutsModal(false)}
                  className="p-1.5 rounded-lg text-purple-400 hover:text-white hover:bg-purple-900/40 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="divide-y divide-purple-500/10 my-4 text-xs">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Toggle Start / Stop Conversion</div>
                    <div className="text-[11px] text-purple-300/50">Start batch or pause ongoing process</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <kbd className="px-2 py-1 bg-purple-950/90 border border-purple-500/40 rounded-md font-mono text-[11px] text-purple-300 font-bold">Ctrl + Enter</kbd>
                    <span className="text-[10px] text-purple-400/50">or</span>
                    <kbd className="px-2 py-1 bg-purple-950/90 border border-purple-500/40 rounded-md font-mono text-[11px] text-purple-300 font-bold">Space</kbd>
                  </div>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Upload Image Files</div>
                    <div className="text-[11px] text-purple-300/50">Open file explorer to select images</div>
                  </div>
                  <kbd className="px-2 py-1 bg-purple-950/90 border border-purple-500/40 rounded-md font-mono text-[11px] text-purple-300 font-bold shrink-0">Ctrl + O</kbd>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Save Project State</div>
                    <div className="text-[11px] text-purple-300/50">Synchronize queue state immediately</div>
                  </div>
                  <kbd className="px-2 py-1 bg-purple-950/90 border border-purple-500/40 rounded-md font-mono text-[11px] text-purple-300 font-bold shrink-0">Ctrl + S</kbd>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Clear Queue</div>
                    <div className="text-[11px] text-purple-300/50">Remove all images from current queue</div>
                  </div>
                  <kbd className="px-2 py-1 bg-purple-950/90 border border-purple-500/40 rounded-md font-mono text-[11px] text-purple-300 font-bold shrink-0">Ctrl + Backspace</kbd>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowShortcutsModal(false)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl transition-colors shadow-md shadow-purple-900/50"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CompletionModal 
        isOpen={showCompletionModal} 
        onClose={() => setShowCompletionModal(false)}
        total={completionStats.total}
        successful={completionStats.successful}
        needsDownload={completionStats.needsDownload}
        onDownload={() => {
          handleExportBatch().then(() => {
            setImages([]);
          });
        }}
      />

      {/* Conversion Progress Overlay */}
      <ConversionProgressOverlay
        activeConversion={activeConversion}
        isConverting={isConverting}
        batchDoneCount={doneCount}
        batchTotalCount={totalCount}
        batchProgressPercent={progressPercent}
        avgTimePerImage={avgTimePerImage}
        estimatedSeconds={estimatedSeconds}
        onStop={() => {
          stopConversionRef.current = true;
          setIsConverting(false);
          setActiveConversion(null);
          addToast('Conversion paused/stopped', 'info');
        }}
      />

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
