import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function shouldUseRedirectFlow(): boolean {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod|Android|wv|WebView/i.test(ua);
}

function isPopupRecoverableError(code?: string): boolean {
  return Boolean(
    code &&
      [
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment',
      ].includes(code)
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Complete redirect auth flow if user returned from Google auth page.
    getRedirectResult(auth).catch((error) => {
      console.error('Error handling redirect sign-in:', error);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();

    if (shouldUseRedirectFlow()) {
      await signInWithRedirect(auth, provider);
      return;
    }

    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (isPopupRecoverableError(error?.code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
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
