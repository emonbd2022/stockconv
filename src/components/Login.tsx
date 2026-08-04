import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, FileImage, ShieldCheck, Zap } from 'lucide-react';

export function Login() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen w-full bg-[#0A0518] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#140D2B]/50 rounded-[2.5rem] border border-purple-500/20 backdrop-blur-3xl p-10 shadow-2xl shadow-purple-900/40">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl flex items-center justify-center shadow-xl shadow-purple-600/30 mb-8 transform hover:scale-105 transition-transform duration-500">
            <FileImage className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">STOCK<span className="text-purple-400 font-black">CONV</span></h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-purple-300/40 font-bold mb-10">Premium Conversion Engine</p>
          
          <div className="grid grid-cols-1 gap-4 w-full mb-10">
            <div className="flex items-center gap-4 p-4 bg-purple-900/10 rounded-2xl border border-purple-500/5">
              <Zap className="w-5 h-5 text-purple-400" />
              <div className="text-left">
                <div className="text-xs font-bold text-white uppercase tracking-wider">Credit-Based System</div>
                <div className="text-[10px] text-purple-300/50">1 Credit per image conversion</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-purple-900/10 rounded-2xl border border-purple-500/5">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              <div className="text-left">
                <div className="text-xs font-bold text-white uppercase tracking-wider">Secure Processing</div>
                <div className="text-[10px] text-purple-300/50">100% Client-side conversion</div>
              </div>
            </div>
          </div>

          <button 
            onClick={signIn}
            className="w-full group relative flex items-center justify-center gap-3 px-8 py-4 bg-white text-[#0A0518] rounded-2xl font-black text-sm tracking-widest uppercase hover:bg-purple-50 transition-all active:scale-95 shadow-xl shadow-white/10"
          >
            <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <span>Sign in with Google</span>
          </button>
          
          <p className="mt-8 text-[10px] text-purple-300/20 font-medium tracking-wide">
            Access to this platform is restricted to registered contributors.
          </p>
        </div>
      </div>
    </div>
  );
}
