import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Download, FileImage, Sparkles } from 'lucide-react';

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  successful: number;
  needsDownload?: boolean;
  onDownload?: () => void;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  isOpen,
  onClose,
  total,
  successful,
  needsDownload = false,
  onDownload
}) => {
  if (!isOpen) return null;

  const failed = total - successful;
  const isPerfect = failed === 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-[#120B2E] border border-purple-500/30 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl shadow-purple-900/50 relative"
        >
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="p-6 flex flex-col items-center text-center relative z-10">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              {isPerfect ? (
                <Sparkles className="w-8 h-8 text-green-400" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              )}
            </div>

            <h2 className="text-2xl font-black text-white mb-2 tracking-wide">
              {isPerfect ? 'Perfect Batch!' : 'Conversion Complete'}
            </h2>
            <p className="text-sm text-purple-200/70 font-medium mb-6">
              {needsDownload 
                ? 'Your images are ready. Click below to download them.'
                : 'Your images have been successfully processed and exported.'}
            </p>

            <div className="w-full grid grid-cols-2 gap-3 mb-6">
              <div className="bg-[#1A103C] rounded-2xl p-3 border border-purple-500/20 flex flex-col items-center">
                <span className="text-xs font-bold text-purple-400/80 uppercase tracking-widest mb-1">Success</span>
                <span className="text-2xl font-black text-green-400">{successful}</span>
              </div>
              <div className="bg-[#1A103C] rounded-2xl p-3 border border-purple-500/20 flex flex-col items-center">
                <span className="text-xs font-bold text-purple-400/80 uppercase tracking-widest mb-1">Failed</span>
                <span className={`text-2xl font-black ${failed > 0 ? 'text-red-400' : 'text-purple-300/50'}`}>
                  {failed}
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2">
              {needsDownload && (
                <button
                  onClick={() => {
                    if (onDownload) onDownload();
                    onClose();
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-900/40 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download All (ZIP)
                </button>
              )}
              <button
                onClick={onClose}
                className={`w-full py-3.5 font-bold rounded-xl transition-all active:scale-[0.98] ${
                  needsDownload
                    ? 'bg-[#1A103C] hover:bg-purple-900/30 text-purple-300 border border-purple-500/30'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/40'
                }`}
              >
                {needsDownload ? 'Close' : 'Continue'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
