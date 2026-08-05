import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface UserProfile {
  uid: string;
  email: string;
  credits: number;
  isUnlimited: boolean;
  role: 'user' | 'admin';
  createdAt: any;
  isBlocked?: boolean;
  nickname?: string;
  processedCount?: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('stockconv_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    return !localStorage.getItem('stockconv_profile');
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Subscribe to user profile changes
        const userDocRef = doc(db, 'users', firebaseUser.uid);

        const unsubscribeProfile = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserProfile;
            
            // Automatically unblock the admin if they were somehow blocked
            if (firebaseUser.email?.toLowerCase() === 'titaniumfact97@gmail.com' && data.isBlocked) {
              data.isBlocked = false;
              updateDoc(userDocRef, { isBlocked: false }).catch(console.error);
            }
            
            setProfile(data);
            localStorage.setItem('stockconv_profile', JSON.stringify(data));
          } else {
             const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              credits: firebaseUser.email?.toLowerCase() === 'titaniumfact97@gmail.com' ? 999999 : 100,
              isUnlimited: firebaseUser.email?.toLowerCase() === 'titaniumfact97@gmail.com',
              role: firebaseUser.email?.toLowerCase() === 'titaniumfact97@gmail.com' ? 'admin' : 'user',
              createdAt: serverTimestamp(),
              processedCount: 0,
              isBlocked: false,
            };
            try {
              setDoc(userDocRef, newProfile).catch(err => console.error("Error writing profile to server:", err));
              setProfile(newProfile);
              localStorage.setItem('stockconv_profile', JSON.stringify(newProfile));
            } catch (err: any) {
              console.error("Error creating profile:", err);
            }
          }
          setLoading(false);
        }, (err) => {
          console.error("Profile snapshot error:", err);
          setError("Error listening to user profile.");
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        localStorage.removeItem('stockconv_profile');
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signIn = async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // Just ignore or set a mild message
        console.log("Sign in popup closed by user");
        return;
      }
      if (err.code === 'auth/network-request-failed') {
        setError("Network error. Please check your connection.");
        return;
      }
      setError(err.message || "An error occurred during sign in.");
      console.error("Sign in error:", err);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signIn, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
