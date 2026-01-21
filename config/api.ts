// API Configuration
// All API keys are loaded from .env file at project root

export const API_CONFIG = {
  // Backend API URL
  // Production server: 104.248.75.168
  // Can be overridden with EXPO_PUBLIC_BACKEND_URL environment variable
  BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://104.248.75.168:3001',
  
  // Python Service URL
  // Production server: 104.248.75.168
  // Can be overridden with EXPO_PUBLIC_PYTHON_SERVICE_URL environment variable
  PYTHON_SERVICE_URL: process.env.EXPO_PUBLIC_PYTHON_SERVICE_URL || 'http://104.248.75.168:8000',
  
  // API keys are NOT accessible from frontend for security
  // All API calls go through backend
  // Frontend only needs backend URL
  
  // Search configuration
  SEARCH_CONFIG: {
    MAX_SEARCH_RADIUS: 50, // Maximum radius in miles
    MIN_STORES_REQUIRED: 1, // Minimum stores to find
    TARGET_STORES: 5, // Target number of stores to find
    DEFAULT_START_RADIUS: 5, // Default starting radius
  },
  
  // AI Configuration
  AI_CONFIG: {
    MODEL: 'gpt-4',
    TEMPERATURE: 0.3,
    MAX_TOKENS: 2000,
    VISION_MODEL: 'gpt-4-vision-preview',
  },
  
  // Request timeouts
  TIMEOUTS: {
    API_REQUEST: 10000, // 10 seconds
    AI_REQUEST: 15000, // 15 seconds
    LOCATION_REQUEST: 10000, // 10 seconds
  },
};

// Environment-specific configurations
export const getApiConfig = () => {
  return API_CONFIG;
};

// Helper function to validate API keys
export const validateApiKeys = () => {
  const config = getApiConfig();
  const missingKeys = [];
  
  // API key validation removed - keys are backend-only
  // Frontend doesn't need API keys, only backend URL
  return true;
  
  return true;
};

export default getApiConfig();
