import axios from 'axios';
import { Platform } from 'react-native';

/**
 * Backend API Service
 * Client for calling the backend API instead of direct third-party API calls
 */

// Helper to detect if we're on web (localhost works) or mobile (need IP)
const isWebPlatform = () => {
  try {
    return Platform.OS === 'web';
  } catch {
    return typeof window !== 'undefined';
  }
};

// Helper to get default URL based on platform
const getDefaultBackendUrl = () => {
  const isWeb = isWebPlatform();
  // On web, localhost works. On mobile, we need the actual IP address
  if (isWeb) {
    return 'http://localhost:3001';
  }
  // For React Native mobile/emulator, suggest using IP
  // Android emulator uses 10.0.2.2, iOS simulator can use localhost
  // Physical devices need the actual machine IP (e.g., 192.168.1.x)
  return 'http://localhost:3001'; // Will need to be overridden with actual IP for physical devices
};

// Backend URL - can be configured via environment or use default
// For React Native mobile, you MUST use your machine's IP address instead of localhost
// Example: 'http://192.168.1.9:3001' (use your actual IP)
// For Android emulator: 'http://10.0.2.2:3001'
const BACKEND_BASE_URL = 
  process.env.EXPO_PUBLIC_BACKEND_URL || 
  process.env.BACKEND_URL || 
  getDefaultBackendUrl();

export interface GrocerySearchRequest {
  items: string[];
  address: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  nearbyStores?: string[];
}

export interface GrocerySearchResponse {
  success: boolean;
  query: {
    items: string[];
    location: {
      address: string;
      zipCode: string;
    };
  };
  stores: {
    [storeName: string]: {
      products: any[];
      totalPrice: number;
    };
  };
  pythonMatches?: {
    store_matches: { [storeName: string]: any };
    stores_needing_ai: string[];
  };
  processing_time_ms: number;
  error?: string;
}

class BackendApiService {
  private baseUrl: string;

  constructor() {
    // Try to get from config first
    try {
      const { getApiConfig } = require('@/config/api');
      const config = getApiConfig();
      if (config?.BACKEND_URL) {
        this.baseUrl = config.BACKEND_URL;
        console.log(`🔗 [BackendAPI] Using backend URL from config: ${this.baseUrl}`);
        return;
      }
    } catch (error) {
      // Config not available, use default
    }
    
    // Fallback to environment variable or default
    this.baseUrl = BACKEND_BASE_URL;
    const isWeb = isWebPlatform();
    
    console.log(`🔗 [BackendAPI] Using backend URL: ${this.baseUrl}`);
    console.log(`📱 [BackendAPI] Platform: ${Platform.OS}${isWeb ? ' (Web)' : ' (Mobile)'}`);
    
    if (!isWeb && this.baseUrl.includes('localhost')) {
      console.warn(`⚠️ [BackendAPI] ⚠️ LOCALHOST WON'T WORK ON MOBILE DEVICES/EMULATORS! ⚠️`);
      console.warn(`💡 [BackendAPI] Please set your machine's IP address in config/api.ts:`);
      console.warn(`💡 [BackendAPI]   BACKEND_URL: 'http://YOUR_IP_ADDRESS:3001'`);
      console.warn(`💡 [BackendAPI] Example: 'http://192.168.1.9:3001'`);
      console.warn(`💡 [BackendAPI] Or set EXPO_PUBLIC_BACKEND_URL environment variable`);
      console.warn(`💡 [BackendAPI] Android Emulator: Use 'http://10.0.2.2:3001'`);
    }
  }

  /**
   * Search for grocery prices via backend API
   */
  async searchGroceryPrices(request: GrocerySearchRequest): Promise<GrocerySearchResponse> {
    try {
      console.log('📡 [BackendAPI] Calling backend grocery search:', {
        items: request.items,
        address: request.address,
        zipCode: request.zipCode,
        stores: request.nearbyStores?.length || 0
      });
      console.log('📡 [BackendAPI] Request URL:', `${this.baseUrl}/api/grocery/search`);
      console.log('📡 [BackendAPI] Request payload:', JSON.stringify(request, null, 2));
      
      const response = await axios.post<GrocerySearchResponse>(
        `${this.baseUrl}/api/grocery/search`,
        request,
        {
          timeout: 60000, // 60 seconds timeout
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ [BackendAPI] Backend response received:', {
        stores: Object.keys(response.data.stores || {}).length,
        processingTime: response.data.processing_time_ms,
        success: response.data.success
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ [BackendAPI] Error calling backend:', error.message);
      
      if (error.response) {
        // Log full error details for debugging
        console.error('❌ [BackendAPI] Response error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        const errorMessage = error.response.data?.error || error.response.statusText || 'Unknown error';
        throw new Error(`Backend API error (${error.response.status}): ${errorMessage}`);
      } else if (error.request) {
        console.error('❌ [BackendAPI] No response received:', error.request);
        throw new Error('Backend API is not reachable. Make sure the backend server is running.');
      } else {
        console.error('❌ [BackendAPI] Request setup error:', error.message);
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }

  /**
   * Check backend health
   */
  async checkHealth(): Promise<boolean> {
    try {
      console.log(`🏥 [BackendAPI] Checking health at: ${this.baseUrl}/api/health`);
      const response = await axios.get(`${this.baseUrl}/api/health`, { 
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const isHealthy = response.status === 200;
      if (isHealthy) {
        console.log(`✅ [BackendAPI] Backend is healthy`);
      } else {
        console.warn(`⚠️ [BackendAPI] Backend returned status: ${response.status}`);
      }
      return isHealthy;
    } catch (error: any) {
      console.warn(`❌ [BackendAPI] Health check failed:`, error.message || error);
      const isWeb = isWebPlatform();
      if (!isWeb && this.baseUrl.includes('localhost')) {
        console.warn(`💡 [BackendAPI] If you're on mobile/emulator, localhost won't work!`);
        console.warn(`💡 [BackendAPI] Update config/api.ts with your machine's IP address`);
      }
      return false;
    }
  }

  /**
   * Get backend service status
   */
  async getServiceStatus(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/grocery/health`, { timeout: 5000 });
      return response.data;
    } catch {
      return null;
    }
  }
}

export const backendApiService = new BackendApiService();

