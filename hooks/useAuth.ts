import { useState, useEffect, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
    } finally {
      setLoading(false);
    }
  };

  const storeUser = async (userData: User) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error storing user:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      
      // Mock Google sign-in for demo purposes
      // In a real app, you would use proper OAuth flow
      const mockUser: User = {
        id: 'google_' + Math.random().toString(36).substr(2, 9),
        email: 'user@gmail.com',
        name: 'John Doe',
        avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
        provider: 'google',
        totalSavings: 1456.20,
        monthlySavings: 247.83,
        joinedAt: new Date('2024-01-15'),
        priceComparisons: 156,
        averageSavingsPercent: 23,
      };
      
      await storeUser(mockUser);
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    try {
      setLoading(true);
      
      // Mock Apple sign-in for demo purposes
      const mockUser: User = {
        id: 'apple_' + Math.random().toString(36).substr(2, 9),
        email: 'user@icloud.com',
        name: 'Jane Smith',
        avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
        provider: 'apple',
        totalSavings: 2134.56,
        monthlySavings: 312.45,
        joinedAt: new Date('2024-02-01'),
        priceComparisons: 203,
        averageSavingsPercent: 28,
      };
      
      await storeUser(mockUser);
    } catch (error) {
      console.error('Apple sign-in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      // Mock email sign-in
      const mockUser: User = {
        id: 'email_' + Math.random().toString(36).substr(2, 9),
        email,
        name: email.split('@')[0],
        provider: 'email',
        totalSavings: 892.34,
        monthlySavings: 156.78,
        joinedAt: new Date(),
        priceComparisons: 89,
        averageSavingsPercent: 19,
      };
      
      await storeUser(mockUser);
    } catch (error) {
      console.error('Email sign-in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      setLoading(true);
      
      // Mock sign-up
      const mockUser: User = {
        id: 'new_' + Math.random().toString(36).substr(2, 9),
        email,
        name,
        provider: 'email',
        totalSavings: 0,
        monthlySavings: 0,
        joinedAt: new Date(),
        priceComparisons: 0,
        averageSavingsPercent: 0,
      };
      
      await storeUser(mockUser);
    } catch (error) {
      console.error('Sign-up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  return {
    user,
    loading,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUp,
    signOut,
  };
};

export { AuthContext };