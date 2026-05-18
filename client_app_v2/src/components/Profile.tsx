import React, { useState, useEffect } from 'react';
import { User, Settings, Bell, Shield, HelpCircle, LogOut, ChevronRight, TrendingUp, Sparkles, X, Loader2, Mail, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function Profile() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [savings, setSavings] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Settings state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Fetch user settings/profile data
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSavings(data.totalSavings || 0);
        setNotificationsEnabled(data.notificationsEnabled ?? true);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdating(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName,
        notificationsEnabled,
        updatedAt: Date.now()
      }, { merge: true });
      setShowSettings(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReportIssue = () => {
    const subject = encodeURIComponent("Issue Report - Pricewise App");
    const body = encodeURIComponent(`User ID: ${user?.uid || 'Guest'}\n\nPlease describe the issue you encountered:`);
    window.location.href = `mailto:alpha.ai.us@gmail.com?subject=${subject}&body=${body}`;
  };

  const menuItems = [
    { icon: Settings, label: 'Account Settings', onClick: () => setShowSettings(true) },
    { icon: Bell, label: 'Notifications', onClick: () => setShowNotifications(true) },
    { icon: Mail, label: 'Report an issue', onClick: handleReportIssue },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="pt-safe-top p-6 pb-24 max-w-md mx-auto">
      <header className="mb-12 text-center relative">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/10 rounded-full blur-3xl -z-10" />
        
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-32 h-32 bg-card rounded-[2.5rem] mx-auto mb-6 flex items-center justify-center relative border-4 border-background shadow-2xl shadow-primary/10"
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" className="w-full h-full rounded-[2.5rem] object-cover" referrerPolicy="no-referrer" />
          ) : (
            <User className="w-16 h-16 text-muted-foreground/30" strokeWidth={1.5} />
          )}
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -bottom-2 -right-2 w-10 h-10 gradient-primary rounded-2xl border-4 border-background flex items-center justify-center shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-white fill-white" />
          </motion.div>
        </motion.div>
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-4xl font-black text-foreground tracking-tighter">
            {user?.displayName || 'Guest User'}
          </h1>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] mt-2">
            {user?.email || 'Sign in to sync your lists.'}
          </p>
        </motion.div>
        
        {!user && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex gap-4 mt-10"
          >
            <button
              onClick={() => navigate('/login')}
              className="flex-1 py-5 gradient-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-[0.97] transition-all"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="flex-1 py-5 bg-card border border-border/50 text-foreground rounded-2xl font-black text-xs uppercase tracking-widest active:scale-[0.97] transition-all"
            >
              Sign Up
            </button>
          </motion.div>
        )}
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="gradient-primary rounded-[3rem] p-10 text-primary-foreground mb-12 shadow-2xl shadow-primary/30 relative overflow-hidden group"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Total Savings</span>
          </div>
          <p className="text-5xl font-black mb-3 tracking-tighter">${savings.toFixed(2)}</p>
          <p className="text-[10px] text-white/60 font-black uppercase tracking-widest">Estimated monthly savings</p>
        </div>
        
        {/* Animated background shapes */}
        <motion.div 
          animate={{ 
            rotate: [0, 360],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/10 rounded-[3rem] blur-3xl" 
        />
        <div className="absolute -left-10 -top-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl" />
      </motion.div>

      <div className="space-y-4">
        {menuItems.map(({ icon: Icon, label, onClick }, idx) => (
          <motion.button
            key={label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + (idx * 0.05) }}
            onClick={onClick}
            className="w-full flex items-center justify-between p-6 modern-card group"
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-muted/50 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-all group-hover:scale-110">
                <Icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={2.5} />
              </div>
              <span className="font-black text-foreground tracking-tight text-lg group-hover:text-primary transition-colors">{label}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center group-hover:bg-primary/10 transition-all">
              <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </div>
          </motion.button>
        ))}

        {user && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            onClick={handleLogout}
            className="w-full flex items-center gap-5 p-6 text-destructive font-black mt-8 hover:bg-destructive/5 rounded-[2rem] transition-all group"
          >
            <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <LogOut className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <span className="text-lg tracking-tight uppercase tracking-[0.1em] text-xs">Sign Out</span>
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-card w-full max-w-sm rounded-[3rem] border border-border shadow-2xl overflow-hidden p-10"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black tracking-tight">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-3 hover:bg-muted rounded-2xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 ml-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-6 py-5 modern-input"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl">
                    <div className="flex items-center gap-3">
                      {theme === 'light' ? <Sun className="w-4 h-4 text-primary" /> : <Moon className="w-4 h-4 text-primary" />}
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Dark Mode</span>
                    </div>
                    <button 
                      type="button"
                      onClick={toggleTheme}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        theme === 'dark' ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <motion.div 
                        animate={{ x: theme === 'dark' ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Bell className="w-4 h-4 text-primary" />
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Notifications</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        notificationsEnabled ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <motion.div 
                        animate={{ x: notificationsEnabled ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full py-5 gradient-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                >
                  {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Settings'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showNotifications && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-card w-full max-w-sm rounded-[3rem] border border-border shadow-2xl overflow-hidden p-10"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black tracking-tight">Notifications</h2>
                <button onClick={() => setShowNotifications(false)} className="p-3 hover:bg-muted rounded-2xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-6 bg-muted/30 rounded-[2rem] border border-border/50">
                  <p className="text-sm font-bold text-foreground">Price Alerts</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Get notified when prices drop for your items.</p>
                </div>
                <div className="p-6 bg-muted/30 rounded-[2rem] border border-border/50">
                  <p className="text-sm font-bold text-foreground">Weekly Summary</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">A summary of your savings this week.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
