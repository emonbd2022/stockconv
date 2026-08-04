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

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
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
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-bold text-white uppercase tracking-wider">Admin Dashboard</h2>
      </div>

      <div className="space-y-4">
        {users.map(user => (
          <div key={user.uid} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[#0F0821] rounded-xl border border-purple-500/10 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-900/30 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">{user.email}</div>
                <div className="text-xs text-purple-400/60 uppercase tracking-tighter">{user.role}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/20 rounded-lg border border-purple-500/10">
                <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-mono text-purple-200">{user.credits}</span>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => updateCredits(user.uid, 10)} className="px-1.5 py-0.5 text-[10px] bg-green-900/30 text-green-400 rounded hover:bg-green-900/50">+10</button>
                  <button onClick={() => updateCredits(user.uid, 50)} className="px-1.5 py-0.5 text-[10px] bg-green-900/30 text-green-400 rounded hover:bg-green-900/50">+50</button>
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
