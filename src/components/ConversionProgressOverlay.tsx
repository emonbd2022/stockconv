import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, StopCircle, Minimize2, Maximize2, FileImage, Sparkles, Cpu, Clock } from 'lucide-react';
import { formatBytes } from '../utils';

export interface ActiveConversionItem {
  id: string;
  originalName: string;
  originalSize: number;
  previewUrl: string;
  progress: number;
  stage: string;
  currentIndex: number;
  totalInBatch: number;
}

interface ConversionProgressOverlayProps {
  activeConversion: ActiveConversionItem | null;
  isConverting: boolean;
  batchDoneCount: number;
  batchTotalCount: number;
  batchProgressPercent: number;
  avgTimePerImage: number;
  estimatedSeconds: number;
  onStop: () => void;
}

export const ConversionProgressOverlay: React.FC<ConversionProgressOverlayProps> = ({
  activeConversion,
  isConverting,
  batchDoneCount,
  batchTotalCount,
  batchProgressPercent,
  avgTimePerImage,
  estimatedSeconds,
  onStop,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isConverting || !activeConversion) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        id="conversion-progress-overlay"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-md"
      >
        {isMinimized ? (
          /* Minimized Compact Bar */
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 bg-[#120B2E]/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/90 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-purple-900/60 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-purple-300 animate-spin" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate max-w-[120px]">{activeConversion.originalName}</span>
                  <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-950/80 px-1.5 py-0.2 rounded border border-purple-500/30 shrink-0">
                    {activeConversion.progress}%
                  </span>
                </div>
                <div className="text-[10px] text-purple-300/60 truncate font-medium">
                  Batch: {batchDoneCount}/{batchTotalCount} ({batchProgressPercent}%)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsMinimized(false)}
                className="p-1.5 text-purple-300 hover:text-white bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 rounded-lg transition-colors"
                title="Expand overlay"
                aria-label="Expand overlay"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onStop}
                className="p-1.5 text-red-300 hover:text-white bg-red-950/60 hover:bg-red-800/70 border border-red-500/40 rounded-lg transition-colors"
                title="Stop conversion"
                aria-label="Stop conversion"
              >
                <StopCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ) : (
          /* Full Detailed Progress Overlay */
          <div className="p-4 sm:p-5 bg-[#120B2E]/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/90 flex flex-col gap-4 text-white overflow-hidden relative">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center shadow-inner">
                  <Loader2 className="w-4 h-4 text-purple-300 animate-spin" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Converting Queue</span>
                  </h3>
                  <div className="text-[11px] font-mono text-purple-300/70">
                    File <span className="text-white font-bold">{activeConversion.currentIndex}</span> of <span className="text-white font-bold">{activeConversion.totalInBatch}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 text-purple-300 hover:text-white bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/30 rounded-lg transition-colors"
                  title="Minimize overlay"
                  aria-label="Minimize overlay"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onStop}
                  className="px-2.5 py-1.5 text-xs font-semibold text-red-200 hover:text-white bg-red-950/60 hover:bg-red-800/70 border border-red-500/40 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Stop conversion"
                >
                  <StopCircle className="w-3.5 h-3.5 text-red-400" />
                  <span>Stop</span>
                </button>
              </div>
            </div>

            {/* 1. Total Batch Progress Bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-purple-200/90 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Total Batch Progress
                </span>
                <span className="font-mono text-[11px] text-purple-300">
                  <span className="text-white font-bold">{batchDoneCount}</span>/{batchTotalCount} ({batchProgressPercent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-[#090414] rounded-full overflow-hidden border border-purple-500/20 p-0.5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, batchProgressPercent))}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* 2. Detailed Individual Image Processing Box */}
            <div className="p-3.5 bg-[#0A0518]/90 border border-purple-500/25 rounded-xl flex flex-col gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#140D2B] border border-purple-500/30 overflow-hidden shrink-0 relative flex items-center justify-center">
                  {activeConversion.previewUrl ? (
                    <img 
                      src={activeConversion.previewUrl} 
                      alt={activeConversion.originalName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileImage className="w-5 h-5 text-purple-400" />
                  )}
                  <div className="absolute inset-0 border border-purple-400/30 rounded-lg animate-pulse pointer-events-none" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-white truncate" title={activeConversion.originalName}>
                      {activeConversion.originalName}
                    </p>
                    <span className="text-[10px] font-mono text-purple-400/80 shrink-0">
                      {formatBytes(activeConversion.originalSize)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                    <p className="text-[11px] text-purple-300/80 truncate font-mono">
                      {activeConversion.stage || 'Processing image...'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Individual Percentage & Bar */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-cyan-400" />
                    Current File Progress
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono font-extrabold text-cyan-300">
                      {activeConversion.progress}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-[#090414] rounded-full overflow-hidden border border-purple-500/30 p-0.5 relative">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 rounded-full relative overflow-hidden"
                    initial={{ width: '5%' }}
                    animate={{ width: `${Math.min(100, Math.max(5, activeConversion.progress))}%` }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-pulse" />
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Performance Stats Row */}
            <div className="flex items-center justify-between text-[11px] text-purple-300/60 pt-1 font-mono border-t border-purple-500/10">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-purple-400" />
                <span>Est. Left: <strong className="text-purple-200">{Math.floor(estimatedSeconds / 60).toString().padStart(2, '0')}:{(estimatedSeconds % 60).toString().padStart(2, '0')}</strong></span>
              </div>
              <div>
                <span>Speed: <strong className="text-purple-200">~{avgTimePerImage.toFixed(0)}ms</strong>/img</span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
