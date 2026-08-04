import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, CreditCard, Infinity as InfinityIcon, User, Shield } from 'lucide-react';

export function UserDashboard() {
  const { profile, user, logout } = useAuth();

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="p-5 rounded-2xl bg-[#140D2B]/50 border border-purple-500/10 backdrop-blur-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            {profile.role === 'admin' ? <Shield className="w-6 h-6 text-white" /> : <User className="w-6 h-6 text-white" />}
          </div>
          <div className="flex-1 overflow-hidden">
            <h3 className="text-sm font-bold text-white truncate">{user?.displayName || 'User'}</h3>
            <p className="text-[11px] text-purple-400/60 truncate">{profile.email}</p>
          </div>
          <button 
            onClick={logout}
            className="p-2.5 rounded-xl bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors border border-red-500/10"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="p-4 rounded-xl bg-[#0F0821] border border-purple-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-900/30 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">Credits</span>
            </div>
            <div className="flex items-center gap-2">
              {profile.isUnlimited ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 rounded-full border border-purple-400/30">
                  <InfinityIcon className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-black text-purple-200">UNLIMITED</span>
                </div>
              ) : (
                <span className="text-2xl font-mono font-black text-white">{profile.credits}</span>
              )}
            </div>
          </div>
          
          <div className="px-4 py-2 rounded-lg bg-yellow-900/10 border border-yellow-500/10">
            <p className="text-[10px] text-yellow-500/80 leading-relaxed">
              1 credit is deducted per image conversion. {profile.isUnlimited ? "Your account is set to unlimited." : "Please contact admin for more credits."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
