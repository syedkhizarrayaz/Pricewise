import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface UserLocationContextType {
  userAddress: string;
  userZipCode: string;
  setUserLocation: (address: string, zipCode: string) => void;
  clearUserLocation: () => void;
}

const UserLocationContext = createContext<UserLocationContextType | undefined>(undefined);

export const UserLocationProvider = ({ children }: { children: ReactNode }) => {
  // Initialize with empty strings, will be set by setUserLocation
  const [userAddress, setUserAddress] = useState<string>('');
  const [userZipCode, setUserZipCode] = useState<string>('');

  console.log('📍 [UserLocation] Provider rendered with state:', { userAddress, userZipCode });

  // Track state changes
  useEffect(() => {
    console.log('📍 [UserLocation] State changed:', { userAddress, userZipCode });
  }, [userAddress, userZipCode]);

  const setUserLocation = (address: string, zipCode: string) => {
    console.log('📍 [UserLocation] Setting user location:', { address, zipCode });
    setUserAddress(address);
    setUserZipCode(zipCode);
    console.log('📍 [UserLocation] User location set successfully');
  };

  const clearUserLocation = () => {
    setUserAddress('');
    setUserZipCode('');
    console.log('📍 [UserLocation] Cleared user location');
  };

  return (
    <UserLocationContext.Provider value={{
      userAddress,
      userZipCode,
      setUserLocation,
      clearUserLocation
    }}>
      {children}
    </UserLocationContext.Provider>
  );
};

export const useUserLocation = () => {
  const context = useContext(UserLocationContext);
  if (context === undefined) {
    throw new Error('useUserLocation must be used within a UserLocationProvider');
  }
  console.log('📍 [UserLocation] Hook called, current values:', { 
    userAddress: context.userAddress, 
    userZipCode: context.userZipCode 
  });
  return context;
};
