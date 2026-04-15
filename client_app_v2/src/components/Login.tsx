import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Loader2, Globe } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

import { motion } from 'motion/react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err.code === 'auth/popup-blocked') {
        setError('Sign-in popup was blocked. Please allow popups or try opening the app in a new tab.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Firebase Auth. Please check your Firebase Console settings.');
      } else {
        setError(err.message || 'Failed to sign in with Google. Try opening the app in a new tab if this persists.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-safe-top min-h-screen flex flex-col justify-center px-6 py-12 bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-sm"
      >
        <div className="w-20 h-20 gradient-primary rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl shadow-primary/20 mb-8">
          <Lock className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-center text-4xl font-black tracking-tighter text-foreground">
          Welcome <span className="text-primary">Back</span>
        </h2>
        <p className="mt-3 text-center text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Sign in to your account
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm"
      >
        <div className="modern-card p-8 space-y-8">
          <form className="space-y-6" onSubmit={handleEmailLogin}>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Email address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-5 py-4 modern-input"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Password</label>
                <a href="#" className="text-[10px] font-black text-primary uppercase tracking-widest hover:opacity-70 transition-opacity">Forgot?</a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-5 py-4 modern-input"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-destructive text-[10px] font-black uppercase tracking-widest text-center bg-destructive/10 py-3 rounded-2xl"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-2xl gradient-primary px-3 py-5 text-xs font-black text-white shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 active:scale-[0.97] transition-all disabled:opacity-50 uppercase tracking-widest"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign in'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
              <span className="bg-card px-4 text-muted-foreground/50">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-muted/30 px-3 py-5 text-xs font-black text-foreground hover:bg-muted/50 transition-all active:scale-[0.97] uppercase tracking-widest"
          >
            <Globe className="w-5 h-5 text-primary" strokeWidth={2.5} />
            Google
          </button>
        </div>

        <p className="mt-10 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Not a member?{' '}
          <Link to="/signup" className="text-primary hover:opacity-70 transition-opacity">
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
