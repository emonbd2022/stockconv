import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, CreditCard, Infinity as InfinityIcon, CheckCircle2, Ban, RotateCcw, Edit2, Activity, CalendarDays, Bell, RefreshCw, Trash2, Search } from 'lucide-react';
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
  adminNotified?: boolean;
}

export function AdminPanel() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [notifications, setNotifications] = useState<UserProfile[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const usersPerPage = 10;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      
      usersData.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.seconds - a.createdAt.seconds;
      });
      
      setUsers(usersData);
      
      if (profile) {
        const unnotified = usersData.filter(u => u.adminNotified === false && u.uid !== profile.uid);
        setNotifications(unnotified);
      }
      
      setLoading(false);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    fetchUsers();
  }, [profile]);

  useEffect(() => {
    if (!showNotifications && notifications.length > 0) {
      markNotificationsAsSeen();
    }
  }, [showNotifications]);

  const markNotificationsAsSeen = async () => {
    if (notifications.length === 0) return;
    
    // Clear locally immediately for snappy UI
    const toUpdate = [...notifications];
    setNotifications([]);
    setShowNotifications(false);
    
    // Update server in background
    for (const u of toUpdate) {
      try {
        await updateDoc(doc(db, 'users', u.uid), { adminNotified: true });
        // Update local users array
        setUsers(prev => prev.map(user => user.uid === u.uid ? { ...user, adminNotified: true } : user));
      } catch (e) {
        console.error("Failed to mark notification as seen for", u.uid, e);
      }
    }
  };

  const updateCredits = async (userId: string, amount: number, absolute: boolean = false) => {
    try {
      const userRef = doc(db, 'users', userId);
      if (absolute) {
        await updateDoc(userRef, { credits: amount });
        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, credits: amount } : u));
        showToast(`Credits set to ${amount}.`);
      } else {
        await updateDoc(userRef, { credits: increment(amount) });
        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, credits: (u.credits || 0) + amount } : u));
        showToast(`Added ${amount} credits.`);
      }
    } catch (e: any) {
      console.error("Failed to update credits:", e);
      alert("Failed to update credits: " + e.message);
    }
  };

  const toggleUnlimited = async (userId: string, status: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isUnlimited: status });
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isUnlimited: status } : u));
      showToast(status ? 'User plan upgraded to Unlimited.' : 'User plan changed to Limited.');
    } catch (e: any) {
      console.error("Failed to toggle unlimited:", e);
      alert("Failed to toggle unlimited: " + e.message);
    }
  };

  const toggleBlock = async (userId: string, status: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isBlocked: status });
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isBlocked: status } : u));
      showToast(status ? 'User has been blocked.' : 'User has been unblocked.');
    } catch (e: any) {
      console.error("Failed to toggle block:", e);
      alert("Failed to toggle block: " + e.message);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete.uid));
      setUsers(prev => prev.filter(u => u.uid !== userToDelete.uid));
      showToast('User deleted successfully.');
      setUserToDelete(null);
    } catch (e: any) {
      console.error("Failed to delete user", e);
      alert("Failed to delete user: " + e.message);
      setUserToDelete(null);
    }
  };

  const saveNickname = async (userId: string) => {
    if (!nicknameInput.trim()) {
      setEditingNickname(null);
      return;
    }
    try {
      const userRef = doc(db, 'users', userId);
      const newNickname = nicknameInput.trim();
      await updateDoc(userRef, { nickname: newNickname });
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, nickname: newNickname } : u));
      setEditingNickname(null);
      showToast('Nickname updated.');
    } catch (e: any) {
      console.error("Failed to save nickname:", e);
      alert("Failed to save nickname: " + e.message);
    }
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

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.email?.toLowerCase().includes(q) || u.nickname?.toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-[#0B061A] rounded-2xl border border-purple-500/20 backdrop-blur-xl"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
            <Shield className="w-5 h-5 text-green-400" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-wide">Admin Dashboard</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => fetchUsers()} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-transparent border border-purple-500/30 text-purple-300 hover:bg-purple-900/30 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm font-bold">Refresh Data</span>
          </button>
          
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#140D2B] border border-purple-500/20">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-bold text-white leading-none">{totalWebsiteProcessed.toLocaleString()} Processed</span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#140D2B] border border-purple-500/20">
            <User className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-bold text-white leading-none">{users.length} Users</span>
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 rounded-xl bg-purple-900/30 border border-purple-500/20 hover:bg-purple-900/50 transition-colors"
            >
              <Bell className={`w-5 h-5 ${notifications.length > 0 ? 'text-red-400 animate-pulse' : 'text-purple-400'}`} />
              {notifications.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white border-2 border-[#140D2B] shadow-lg shadow-red-900/50">
                  {notifications.length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-80 bg-[#1A103C] border border-purple-500/30 rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-purple-500/20 flex items-center justify-between bg-[#140D2B]/50">
                    <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Bell className="w-4 h-4 text-purple-400" />
                      Notifications
                    </span>
                    {notifications.length > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400/60">
                        {notifications.length} New
                      </span>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto custom-scrollbar p-2">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-purple-400/50 text-xs">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-20" />
                        No new notifications
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.uid} className="p-3 hover:bg-purple-900/30 rounded-xl mb-1 last:mb-0 transition-colors border border-transparent hover:border-purple-500/10">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm text-white font-medium truncate mb-0.5" title={n.email}>{n.email}</div>
                              <div className="text-[10px] text-purple-400/60 font-mono uppercase tracking-wider">New user signed up</div>
                            </div>
                            <span className="text-[10px] text-purple-300/40 shrink-0 mt-1 whitespace-nowrap">
                              {formatDate(n.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-[#140D2B] p-4 rounded-xl border border-purple-500/20">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-purple-400/50" />
          </div>
          <input
            type="text"
            placeholder="Exact Email Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset page on search
            }}
            className="block w-full pl-10 pr-3 py-2.5 border border-purple-500/20 rounded-xl leading-5 bg-[#0A0518] text-white placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 sm:text-sm transition-all"
          />
        </div>
      </div>

      <div className="bg-[#140D2B] border border-purple-500/20 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-purple-500/20 bg-[#0F0A24]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300/60 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300/60 uppercase tracking-wider">Nickname</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300/60 uppercase tracking-wider">Credits</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300/60 uppercase tracking-wider">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300/60 uppercase tracking-wider">Processed</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300/60 uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-purple-300/60 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-500/10">
              <AnimatePresence>
                {paginatedUsers.map((user, i) => (
                  <motion.tr 
                    key={user.uid}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`hover:bg-purple-900/10 transition-colors ${user.isBlocked ? 'bg-red-950/10' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          user.isBlocked ? 'bg-red-900/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'
                        }`}>
                          {user.isBlocked ? <Ban className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${user.isBlocked ? 'text-red-300' : 'text-white'}`}>
                            {user.email}
                          </span>
                          <span className="text-[10px] text-purple-400/60 uppercase tracking-wider">{user.role}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {editingNickname === user.uid ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={nicknameInput}
                            onChange={(e) => setNicknameInput(e.target.value)}
                            placeholder="Enter nickname"
                            className="bg-[#0F0A24] border border-purple-500/30 rounded-lg text-xs px-2 py-1.5 text-white outline-none focus:border-purple-500 w-28"
                            onKeyDown={(e) => e.key === 'Enter' && saveNickname(user.uid)}
                            autoFocus
                          />
                          <button onClick={() => saveNickname(user.uid)} className="text-xs bg-purple-600 text-white px-2 py-1.5 rounded-lg hover:bg-purple-500">Save</button>
                          <button onClick={() => setEditingNickname(null)} className="text-xs text-purple-400/60 px-1 hover:text-white">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/edit">
                          <span className="text-sm text-purple-200">
                            {user.nickname || '-'}
                          </span>
                          <button 
                            onClick={() => startEditingNickname(user)}
                            className="opacity-0 group-hover/edit:opacity-100 text-purple-400/40 hover:text-purple-400 transition-all"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 w-32">
                        <div className="flex items-center gap-2 bg-[#0F0A24] border border-purple-500/20 px-2 py-1 rounded-md">
                          <span className="text-sm font-mono font-bold text-white w-full">{user.credits ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateCredits(user.uid, 5000)} className="flex-1 text-[9px] font-bold py-1 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20">+5K</button>
                          <button onClick={() => updateCredits(user.uid, 0, true)} className="text-[9px] font-bold px-1.5 py-1 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20" title="Reset">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <button 
                        onClick={() => toggleUnlimited(user.uid, !user.isUnlimited)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                          user.isUnlimited 
                            ? 'bg-purple-600/20 border-purple-400/50 text-purple-300' 
                            : 'bg-transparent border-purple-500/20 text-purple-400/60 hover:bg-purple-900/30'
                        }`}
                      >
                        {user.isUnlimited ? <CheckCircle2 className="w-3 h-3" /> : <InfinityIcon className="w-3 h-3" />}
                        {user.isUnlimited ? 'Unlimited' : 'Limited'}
                      </button>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-black text-white">{user.processedCount || 0}</span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-purple-300/60">{formatDate(user.createdAt)}</span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => toggleBlock(user.uid, !user.isBlocked)}
                          disabled={user.uid === profile?.uid}
                          className={`p-1.5 rounded-lg border transition-all ${
                            user.uid === profile?.uid 
                              ? 'opacity-50 cursor-not-allowed border-transparent text-red-400/20' 
                              : user.isBlocked 
                                ? 'bg-red-900/40 border-red-500/50 text-red-400' 
                                : 'border-purple-500/20 text-purple-400/60 hover:bg-red-900/20 hover:text-red-400 hover:border-red-500/30'
                          }`}
                          title={user.isBlocked ? "Unblock" : "Block"}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        
                        <button 
                          onClick={() => setUserToDelete(user)}
                          disabled={user.uid === profile?.uid || user.role === 'admin'}
                          className={`p-1.5 rounded-lg border transition-all ${
                            user.uid === profile?.uid || user.role === 'admin'
                              ? 'opacity-50 cursor-not-allowed border-transparent text-red-400/20' 
                              : 'bg-transparent border-purple-500/20 text-red-400/60 hover:bg-red-900/40 hover:text-red-400 hover:border-red-500/50'
                          }`}
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="border-t border-purple-500/20 p-4 flex items-center justify-center gap-2 bg-[#0F0A24]">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-purple-500/20 text-xs font-bold text-purple-300 disabled:opacity-50 hover:bg-purple-900/30 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs font-medium text-purple-400/60">
              Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-purple-500/20 text-xs font-bold text-purple-300 disabled:opacity-50 hover:bg-purple-900/30 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#120B2E] border border-red-500/30 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl shadow-red-900/20 relative"
            >
              <div className="p-6 relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                  <Trash2 className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-xl font-black text-white mb-2">Delete User?</h2>
                <p className="text-sm text-purple-200/70 mb-6">
                  Are you sure you want to completely delete the data for <strong className="text-white">{userToDelete.email}</strong>? This action cannot be undone.
                </p>
                <div className="flex w-full gap-3">
                  <button
                    onClick={() => setUserToDelete(null)}
                    className="flex-1 py-3 px-4 bg-transparent border border-purple-500/30 hover:bg-purple-900/30 text-purple-300 font-bold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteUser}
                    className="flex-1 py-3 px-4 bg-red-600/80 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Right Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: 20 }}
            className="fixed bottom-6 right-6 z-50 bg-[#1A103C] border border-purple-500/30 text-white px-6 py-3 rounded-xl shadow-2xl shadow-purple-900/50 flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-sm font-bold tracking-wide">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
