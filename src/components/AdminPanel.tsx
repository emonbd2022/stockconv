import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, CreditCard, Infinity as InfinityIcon, CheckCircle2, Ban, RotateCcw, Edit2, Activity, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfile {
  uid: string;
  email: string;
  credits: number;
  isUnlimited: boolean;
  role: 'user' | 'admin';
  isBlocked?: boolean;
  nickname?: string;
  processedCount?: number;
  createdAt?: any;
}

export function AdminPanel() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      // Sort by creation date or just let it be
      usersData.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.seconds - a.createdAt.seconds;
      });
      setUsers(usersData);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching users:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const updateCredits = async (userId: string, amount: number, absolute: boolean = false) => {
    const userRef = doc(db, 'users', userId);
    if (absolute) {
      await updateDoc(userRef, { credits: amount });
    } else {
      await updateDoc(userRef, { credits: increment(amount) });
    }
  };

  const toggleUnlimited = async (userId: string, status: boolean) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { isUnlimited: status });
  };

  const toggleBlock = async (userId: string, status: boolean) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { isBlocked: status });
  };

  const saveNickname = async (userId: string) => {
    if (!nicknameInput.trim()) {
      setEditingNickname(null);
      return;
    }
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { nickname: nicknameInput.trim() });
    setEditingNickname(null);
  };

  const startEditingNickname = (user: UserProfile) => {
    setNicknameInput(user.nickname || '');
    setEditingNickname(user.uid);
  };

  if (profile?.role !== 'admin') {
    return <div className="p-8 text-center text-red-400">Access Denied</div>;
  }

  const totalWebsiteProcessed = users.reduce((acc, user) => acc + (user.processedCount || 0), 0);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    try {
      const d = new Date(timestamp.seconds * 1000);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-[#140D2B]/50 rounded-2xl border border-purple-500/20 backdrop-blur-xl"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
            <Shield className="w-5 h-5 text-purple-400" />
          </div>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Admin Dashboard</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-900/30 border border-purple-500/10">
            <Activity className="w-4 h-4 text-purple-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-purple-400/60 uppercase font-bold tracking-wider">Total Processed</span>
              <span className="text-sm font-black text-white leading-none">{totalWebsiteProcessed.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-900/30 border border-indigo-500/10">
            <User className="w-4 h-4 text-indigo-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-indigo-400/60 uppercase font-bold tracking-wider">Total Users</span>
              <span className="text-sm font-black text-white leading-none">{users.length}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-200 text-sm">
          Error loading users: {error}
        </div>
      )}

      {users.length === 0 && !loading && !error && (
        <div className="p-4 mb-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-200 text-sm">
          No users found in database.
        </div>
      )}

      <div className="space-y-4">
        <AnimatePresence>
          {users.map((user, i) => (
            <motion.div 
              key={user.uid}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex flex-col xl:flex-row xl:items-center justify-between p-4 rounded-xl border gap-4 transition-colors ${
                user.isBlocked 
                  ? 'bg-red-950/10 border-red-900/30' 
                  : 'bg-[#0F0821] border-purple-500/10 hover:border-purple-500/20'
              }`}
            >
              
              <div className="flex items-center gap-4 min-w-[250px]">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  user.isBlocked ? 'bg-red-900/20 text-red-400' : 'bg-purple-900/30 text-purple-400'
                }`}>
                  {user.isBlocked ? <Ban className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className="flex flex-col overflow-hidden">
                  {editingNickname === user.uid ? (
                    <div className="flex items-center gap-2 mb-1">
                      <input 
                        type="text" 
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        placeholder="Enter nickname"
                        className="bg-[#140D2B] border border-purple-500/30 rounded text-xs px-2 py-1 text-white outline-none focus:border-purple-500 w-32"
                        onKeyDown={(e) => e.key === 'Enter' && saveNickname(user.uid)}
                        autoFocus
                      />
                      <button onClick={() => saveNickname(user.uid)} className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Save</button>
                      <button onClick={() => setEditingNickname(null)} className="text-xs text-purple-400/60 px-1">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold truncate ${user.isBlocked ? 'text-red-200' : 'text-white'}`}>
                        {user.nickname || user.email || 'Anonymous User'}
                      </span>
                      <button 
                        onClick={() => startEditingNickname(user)}
                        className="text-purple-400/40 hover:text-purple-400 transition-colors"
                        title="Edit Nickname"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {user.nickname && (
                    <span className="text-[10px] text-purple-400/50 truncate">{user.email}</span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      user.role === 'admin' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/10 text-purple-400/60'
                    }`}>
                      {user.role}
                    </span>
                    <span className="text-[10px] text-purple-400/40 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> {formatDate(user.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col items-center justify-center px-4 py-2 bg-purple-900/10 rounded-lg border border-purple-500/5 min-w-[80px]">
                  <span className="text-[9px] uppercase font-bold text-purple-400/50 mb-0.5">Processed</span>
                  <span className="text-sm font-black text-purple-200">{user.processedCount || 0}</span>
                </div>

                <div className="flex items-center gap-2 p-2 bg-purple-900/20 rounded-lg border border-purple-500/10">
                  <div className="flex items-center gap-1.5 px-2">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-mono font-bold text-purple-200">{user.credits ?? 0}</span>
                  </div>
                  <div className="w-px h-6 bg-purple-500/20 mx-1"></div>
                  <div className="flex gap-1">
                    <button onClick={() => updateCredits(user.uid, 2000)} className="px-2 py-1 text-[10px] font-bold bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors" title="Add 2000">+2K</button>
                    <button onClick={() => updateCredits(user.uid, 5000)} className="px-2 py-1 text-[10px] font-bold bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors" title="Add 5000">+5K</button>
                    <button onClick={() => updateCredits(user.uid, 0, true)} className="px-2 py-1 text-[10px] font-bold bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors flex items-center gap-1" title="Reset to Zero">
                      <RotateCcw className="w-3 h-3" /> 0
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleUnlimited(user.uid, !user.isUnlimited)}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-all ${
                      user.isUnlimited 
                        ? 'bg-purple-600/20 border-purple-400 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                        : 'bg-transparent border-purple-500/10 text-purple-400/40 hover:border-purple-500/30 hover:text-purple-300'
                    }`}
                    title={user.isUnlimited ? "Revoke Unlimited" : "Grant Unlimited"}
                  >
                    {user.isUnlimited ? <CheckCircle2 className="w-5 h-5" /> : <InfinityIcon className="w-5 h-5" />}
                  </button>

                  <button 
                    onClick={() => toggleBlock(user.uid, !user.isBlocked)}
                    disabled={user.uid === profile?.uid}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-all ${
                      user.uid === profile?.uid 
                        ? 'opacity-50 cursor-not-allowed bg-transparent border-red-500/5 text-red-400/20' 
                        : user.isBlocked 
                          ? 'bg-red-900/40 border-red-500 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                          : 'bg-transparent border-red-500/10 text-red-400/40 hover:border-red-500/30 hover:text-red-400 hover:bg-red-900/10'
                    }`}
                    title={user.uid === profile?.uid ? "Cannot block yourself" : (user.isBlocked ? "Unblock User" : "Block User")}
                  >
                    <Ban className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
