import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, List, User, Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

import { motion } from 'motion/react';

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const navItems = [
    { id: 'find', icon: Search, label: 'Find', path: '/' },
    { id: 'stores', icon: MapPin, label: 'Stores', path: '/stores' },
    { id: 'lists', icon: List, label: 'Lists', path: '/lists' },
    { id: 'profile', icon: User, label: 'Profile', path: '/profile' },
  ];

  const handleTabClick = (id: string, path: string) => {
    onTabChange(id);
    navigate(path, { replace: true });
  };

  return (
    <div className="fixed bottom-6 left-0 right-0 px-6 z-50 pointer-events-none">
      <nav className="max-w-md mx-auto glass rounded-[2.5rem] border border-white/20 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] pointer-events-auto relative overflow-hidden">
        <div className="flex justify-around items-center h-20 px-4 relative">
          {navItems.map(({ id, icon: Icon, label, path }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => handleTabClick(id, path)}
                className={cn(
                  "relative flex flex-col items-center justify-center w-full h-full transition-all duration-500 z-10",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <motion.div
                  animate={isActive ? { y: -4, scale: 1.2 } : { y: 0, scale: 1 }}
                  className="relative"
                >
                  <Icon className="w-6 h-6" strokeWidth={isActive ? 3 : 2} />
                  {isActive && (
                    <motion.div
                      layoutId="activeGlow"
                      className="absolute inset-0 blur-lg bg-primary/40 -z-10"
                    />
                  )}
                </motion.div>
                <span className={cn(
                  "text-[9px] mt-1.5 font-black uppercase tracking-[0.15em] transition-all duration-300",
                  isActive ? "opacity-100 translate-y-0" : "opacity-40 translate-y-1"
                )}>
                  {label}
                </span>
                
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-2 w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
        
        <button
          onClick={toggleTheme}
          className="absolute top-1/2 -translate-y-1/2 right-4 p-3 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </nav>
    </div>
  );
}
