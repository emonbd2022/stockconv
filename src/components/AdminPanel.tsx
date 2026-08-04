import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, CreditCard, Infinity as InfinityIcon, CheckCircle2 } from 'lucide-react';

interface UserProfile {
  uid: string;
  email: string;
  credits: number;
  isUnlimited: boolean;
  role: 'user' | 'admin';
}

export function AdminPanel() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
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

  const updateCredits = async (userId: string, amount: number) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      credits: increment(amount)
    });
  };

  const toggleUnlimited = async (userId: string, status: boolean) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isUnlimited: status
    });
  };

  if (profile?.role !== 'admin') {
    return <div className="p-8 text-center text-red-400">Access Denied</div>;
  }

  return (
    <div className="p-6 bg-[#140D2B]/50 rounded-2xl border border-purple-500/20 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Admin Dashboard</h2>
        </div>
        <div className="text-sm font-mono text-purple-400/60 bg-purple-900/20 px-3 py-1 rounded-lg border border-purple-500/10">
          Total Users: {users.length}
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-200 text-sm">
          Error loading users: {error}
        </div>
      )}

      {users.length === 1 && !loading && !error && (
        <div className="p-4 mb-4 bg-yellow-900/10 border border-yellow-500/20 rounded-xl text-yellow-500/80 text-xs">
          <strong>No other users found.</strong> You are the only registered user in the database. To see other users here, try signing out and creating a new account with a different email, or wait for real users to sign up!
        </div>
      )}

      <div className="space-y-4">
        {users.map(user => (
          <div key={user.uid} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[#0F0821] rounded-xl border border-purple-500/10 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-900/30 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">{user.email || 'Anonymous User'}</div>
                <div className="text-xs text-purple-400/60 uppercase tracking-tighter">{user.role || 'user'}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/20 rounded-lg border border-purple-500/10">
                <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-mono text-purple-200">{user.credits ?? 0}</span>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => updateCredits(user.uid, 2000)} className="px-1.5 py-0.5 text-[10px] bg-green-900/30 text-green-400 rounded hover:bg-green-900/50" title="Add 2000">+2K</button>
                  <button onClick={() => updateCredits(user.uid, 5000)} className="px-1.5 py-0.5 text-[10px] bg-green-900/30 text-green-400 rounded hover:bg-green-900/50" title="Add 5000">+5K</button>
                  <button onClick={() => updateCredits(user.uid, 10000)} className="px-1.5 py-0.5 text-[10px] bg-green-900/30 text-green-400 rounded hover:bg-green-900/50" title="Add 10000">+10K</button>
                </div>
              </div>

              <button 
                onClick={() => toggleUnlimited(user.uid, !user.isUnlimited)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                  user.isUnlimited 
                    ? 'bg-purple-600/20 border-purple-400 text-purple-200' 
                    : 'bg-transparent border-purple-500/10 text-purple-400/40 hover:border-purple-500/30'
                }`}
              >
                <InfinityIcon className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">UNLIMITED</span>
                {user.isUnlimited && <CheckCircle2 className="w-3 h-3 text-purple-400" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
