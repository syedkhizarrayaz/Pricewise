import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { Find } from './components/Find';
import { Stores } from './components/Stores';
import { Lists } from './components/Lists';
import { Profile } from './components/Profile';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SplashScreen } from './components/SplashScreen';
import { AnimatePresence } from 'motion/react';

function MainLayout() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
  const [showSplash, setShowSplash] = useState(true);
  
  // Lifted state for location sharing
  const [sharedLocation, setSharedLocation] = useState('');
  const [sharedCoords, setSharedCoords] = useState<{ lat: number; lng: number } | undefined>();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setSharedCoords(coords);
          setSharedLocation('Current Location');
        }
      );
    }
  }, []);

  // We use a state to track the active tab for the main views
  // to keep them mounted and maintain state.
  const [activeTab, setActiveTab] = useState('find');

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500); // 1.5s for a slightly more modern feel than just 1s
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen />}
      </AnimatePresence>

      {!showSplash && (
        <>
          {isAuthPage ? (
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Routes>
          ) : (
            <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/10 selection:text-primary transition-colors duration-300">
              <main className="pb-20">
                <div className={activeTab === 'find' ? 'block' : 'hidden'}>
                  <Find 
                    sharedLocation={sharedLocation} 
                    setSharedLocation={setSharedLocation}
                    sharedCoords={sharedCoords}
                    setSharedCoords={setSharedCoords}
                  />
                </div>
                <div className={activeTab === 'stores' ? 'block' : 'hidden'}>
                  <Stores 
                    sharedLocation={sharedLocation}
                    sharedCoords={sharedCoords}
                  />
                </div>
                <div className={activeTab === 'lists' ? 'block' : 'hidden'}>
                  <Lists />
                </div>
                <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
                  <Profile />
                </div>
              </main>
              <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <MainLayout />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}
