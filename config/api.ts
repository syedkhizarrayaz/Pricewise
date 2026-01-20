// API Configuration
// Replace these with your actual API keys

export const API_CONFIG = {
  // Backend API URL
  // Production server: 104.248.75.168
  // Can be overridden with EXPO_PUBLIC_BACKEND_URL environment variable
  BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://104.248.75.168:3001',
  
  // Python Service URL
  // Production server: 104.248.75.168
  // Can be overridden with EXPO_PUBLIC_PYTHON_SERVICE_URL environment variable
  PYTHON_SERVICE_URL: process.env.EXPO_PUBLIC_PYTHON_SERVICE_URL || 'http://104.248.75.168:8000',
  
  // Unwrangle API for product search and details
  UNWRANGLE_API_KEY: process.env.UNWRANGLE_API_KEY,
  
  // OpenAI API for store discovery and location analysis
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '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',
  
  // Google Places API for store discovery
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyD8dkXiyOx4XoVIF4hosNG91h47zgPnsQY', // You'll need to add your Google Places API key
  
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
  
  if (!config.UNWRANGLE_API_KEY || config.UNWRANGLE_API_KEY === 'your-unwrangle-api-key') {
    missingKeys.push('UNWRANGLE_API_KEY');
  }
  
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key') {
    missingKeys.push('OPENAI_API_KEY');
  }
  
  if (missingKeys.length > 0) {
    console.warn('Missing API keys:', missingKeys.join(', '));
    console.warn('Please update the API keys in config/api.ts');
    return false;
  }
  
  return true;
};

export default getApiConfig();
