// API Configuration
// Replace these with your actual API keys

export const API_CONFIG = {
  // Backend API URL
  // ⚠️ IMPORTANT FOR MOBILE/EMULATOR: localhost won't work!
  // 
  // How to find your machine's IP address:
  //   Windows: ipconfig | findstr IPv4
  //   Mac/Linux: ifconfig | grep "inet " | grep -v 127.0.0.1
  //
  // For different platforms:
  //   - Web: 'http://localhost:3001' works fine
  //   - iOS Simulator: 'http://localhost:3001' usually works
  //   - Android Emulator: Use 'http://10.0.2.2:3001' (special alias for host)
  //   - Physical Devices: Use your machine's IP, e.g., 'http://192.168.1.9:3001'
  //
  // Example: 'http://192.168.1.9:3001' (replace with your actual IP)
  BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.8:3001',
  
  // Python Service URL
  // ⚠️ IMPORTANT FOR MOBILE/EMULATOR: localhost won't work!
  //
  // How to find your machine's IP address:
  //   Windows: ipconfig | findstr IPv4
  //   Mac/Linux: ifconfig | grep "inet " | grep -v 127.0.0.1
  //
  // For different platforms:
  //   - Web: 'http://localhost:8000' works fine
  //   - iOS Simulator: 'http://localhost:8000' usually works
  //   - Android Emulator: Use 'http://10.0.2.2:8000' (special alias for host)
  //   - Physical Devices: Use your machine's IP, e.g., 'http://192.168.1.9:8000'
  //
  // Example: 'http://192.168.1.9:8000' (replace with your actual IP)
  PYTHON_SERVICE_URL: process.env.EXPO_PUBLIC_PYTHON_SERVICE_URL || 'http://192.168.1.8:8000',
  
  // Unwrangle API for product search and details
  UNWRANGLE_API_KEY: process.env.UNWRANGLE_API_KEY,
  
  // OpenAI API for store discovery and location analysis
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Google Places API for store discovery
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY, // You'll need to add your Google Places API key
  
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
