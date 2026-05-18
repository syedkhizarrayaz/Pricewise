import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
// All API calls go through backend - no direct API keys in frontend
import { API_CONFIG } from '@/config/api';

// Create axios instance for backend API only
const apiClient = axios.create({
  baseURL: API_CONFIG.BACKEND_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Store API - Removed old API calls, using Unwrangle and GPT services instead

// Location API - Removed old API calls, using Expo Location instead

// AI Integration API - REMOVED
// All AI functionality is handled by backend
// Frontend should call backend API endpoints for any AI features

// Product Search API
// Product API - Removed old API calls, using Unwrangle service instead

// User API - Removed old API calls, using local storage instead

// Mock data functions removed - using Unwrangle and GPT services instead

export default apiClient;
