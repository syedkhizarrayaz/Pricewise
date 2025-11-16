/**
 * Python Matcher Service Integration
 * 
 * This service integrates with the local Python FastAPI service
 * to get corrected product matches from HasData responses.
 */

import { getApiConfig } from '@/config/api';
import { Platform } from 'react-native';

// Helper to detect if we're on web (localhost works) or mobile (need IP)
const isWebPlatform = () => {
  try {
    return Platform.OS === 'web';
  } catch {
    return typeof window !== 'undefined';
  }
};

// Helper to get default URL based on platform
const getDefaultPythonServiceUrl = () => {
  const isWeb = isWebPlatform();
  // On web, localhost works. On mobile, we need the actual IP address
  if (isWeb) {
    return 'http://localhost:8000';
  }
  // For React Native mobile/emulator, suggest using IP
  // Android emulator uses 10.0.2.2, iOS simulator can use localhost
  // Physical devices need the actual machine IP (e.g., 192.168.1.x)
  return 'http://localhost:8000'; // Will need to be overridden with actual IP for physical devices
};

// Types for Python service communication
interface PythonMatcherRequest {
  query: string;
  hasdata_results: Array<{
    position?: number;
    title: string;
    extractedPrice: number;
    source: string;
    [key: string]: any;
  }>;
  weights?: {
    token_set?: number;
    embed?: number;
    partial?: number;
    brand?: number;
  };
  conf_threshold?: number;
  tie_delta?: number;
}

interface PythonMatcherResponse {
  selected_product: any | null;
  score: number;
  confidence_ok: boolean;
  reason: string;
  all_candidates: Array<{
    candidate: any;
    score: number;
    price_per_liter?: number;
    [key: string]: any;
  }>;
  processing_time_ms: number;
}

class PythonMatcherService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    // Try to get from config first
    try {
      const config = getApiConfig();
      if (config?.PYTHON_SERVICE_URL) {
        this.baseUrl = config.PYTHON_SERVICE_URL;
        console.log(`🔗 [PythonMatcher] Using Python service URL from config: ${this.baseUrl}`);
      } else {
        // Fallback to environment variable or default
        // For React Native, you need to use your machine's IP address instead of localhost
        // Example: 'http://192.168.1.9:8000' (use your actual IP)
        this.baseUrl = process.env.EXPO_PUBLIC_PYTHON_SERVICE_URL || 
                       process.env.PYTHON_SERVICE_URL || 
                       getDefaultPythonServiceUrl();
        console.log(`🔗 [PythonMatcher] Using Python service URL: ${this.baseUrl}`);
      }
    } catch (error) {
      // Config not available, use default
      this.baseUrl = process.env.EXPO_PUBLIC_PYTHON_SERVICE_URL || 
                     process.env.PYTHON_SERVICE_URL || 
                     getDefaultPythonServiceUrl();
      console.log(`🔗 [PythonMatcher] Using default Python service URL: ${this.baseUrl}`);
    }
    
    const isWeb = isWebPlatform();
    console.log(`📱 [PythonMatcher] Platform: ${Platform.OS}${isWeb ? ' (Web)' : ' (Mobile)'}`);
    
    if (!isWeb && this.baseUrl.includes('localhost')) {
      console.warn(`⚠️ [PythonMatcher] ⚠️ LOCALHOST WON'T WORK ON MOBILE DEVICES/EMULATORS! ⚠️`);
      console.warn(`💡 [PythonMatcher] Please set your machine's IP address in config/api.ts:`);
      console.warn(`💡 [PythonMatcher]   PYTHON_SERVICE_URL: 'http://YOUR_IP_ADDRESS:8000'`);
      console.warn(`💡 [PythonMatcher] Example: 'http://192.168.1.9:8000'`);
      console.warn(`💡 [PythonMatcher] Or set EXPO_PUBLIC_PYTHON_SERVICE_URL environment variable`);
      console.warn(`💡 [PythonMatcher] Android Emulator: Use 'http://10.0.2.2:8000'`);
    }
    
    this.timeout = 30000; // 30 seconds (increased for LLM calls)
  }

  /**
   * Get the best match from HasData results using simple fallback logic
   */
  private getBestMatchFallback(query: string, hasdataResults: any[]): any {
    if (!hasdataResults || hasdataResults.length === 0) {
      return null;
    }

    // Simple fallback: find the product with the most similar title
    const queryLower = query.toLowerCase();
    let bestMatch = hasdataResults[0];
    let bestScore = 0;

    for (const result of hasdataResults) {
      const titleLower = result.title.toLowerCase();
      
      // Simple scoring based on keyword matches
      let score = 0;
      const queryWords = queryLower.split(' ');
      const titleWords = titleLower.split(' ');
      
      for (const queryWord of queryWords) {
        if (titleWords.some(titleWord => titleWord.includes(queryWord) || queryWord.includes(titleWord))) {
          score += 1;
        }
      }
      
      // Bonus for exact matches
      if (titleLower.includes(queryLower)) {
        score += 2;
      }
      
      // Bonus for lower price (if we want to prefer cheaper options)
      if (result.extractedPrice < bestMatch.extractedPrice) {
        score += 0.5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }

    console.log(`🔄 [PythonMatcher] Fallback selected: ${bestMatch.title} (score: ${bestScore.toFixed(2)})`);
    return bestMatch;
  }

  /**
   * Check if Python service is available
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      console.log(`🔍 [PythonMatcher] Checking service availability at: ${this.baseUrl}/health`);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`✅ [PythonMatcher] Service is available`);
        return true;
      } else {
        console.warn(`⚠️ [PythonMatcher] Service returned status: ${response.status}`);
        return false;
      }
    } catch (error: any) {
      console.warn('⚠️ [PythonMatcher] Service not available:', error.message || error);
      console.warn(`💡 [PythonMatcher] Make sure Python service is running at: ${this.baseUrl}`);
      
      const isWeb = isWebPlatform();
      if (!isWeb && this.baseUrl.includes('localhost')) {
        console.warn(`💡 [PythonMatcher] ⚠️ LOCALHOST WON'T WORK ON MOBILE! ⚠️`);
        console.warn(`💡 [PythonMatcher] Update config/api.ts with your machine's IP address:`);
        console.warn(`💡 [PythonMatcher]   PYTHON_SERVICE_URL: 'http://YOUR_IP:8000'`);
        console.warn(`💡 [PythonMatcher] Android Emulator: Use 'http://10.0.2.2:8000'`);
      } else {
        console.warn(`💡 [PythonMatcher] Verify the service URL in config/api.ts matches your running service`);
      }
      
      return false;
    }
  }

  /**
   * Match products using Python service
   */
  async matchProducts(
    query: string,
    hasdataResults: any[]
  ): Promise<PythonMatcherResponse> {
    try {
      console.log(`🤖 [PythonMatcher] Matching products for: "${query}"`);
      console.log(`🤖 [PythonMatcher] Processing ${hasdataResults.length} candidates`);

      const requestData: PythonMatcherRequest = {
        query,
        hasdata_results: hasdataResults,
        weights: {
          token_set: 0.50,  // Increased - most important for query matching
          embed: 0.30,     // Increased - semantic understanding
          partial: 0.15,    // Keep same
          brand: 0.05      // Reduced - less important than query match
        },
        conf_threshold: 0.55,
        tie_delta: 0.05
      };

      console.log(`🚀 [PythonMatcher] Calling Python service at: ${this.baseUrl}/match-products`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/match-products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error(`❌ [PythonMatcher] Network error calling Python service:`, fetchError.message || fetchError);
        throw new Error(`Failed to connect to Python service at ${this.baseUrl}: ${fetchError.message || 'Network request failed'}`);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`❌ [PythonMatcher] Python service returned error: ${response.status} ${response.statusText}`);
        console.error(`❌ [PythonMatcher] Error details: ${errorText}`);
        throw new Error(`Python service error: ${response.status} ${response.statusText}`);
      }

      let result: PythonMatcherResponse;
      try {
        result = await response.json();
      } catch (jsonError: any) {
        console.error(`❌ [PythonMatcher] Failed to parse response as JSON:`, jsonError);
        throw new Error('Python service returned invalid JSON response');
      }
      
      console.log(`✅ [PythonMatcher] Python service response received`);
      console.log(`🤖 [PythonMatcher] Selected: ${result.selected_product?.title || 'None'}`);
      console.log(`🤖 [PythonMatcher] Score: ${result.score.toFixed(3)}, Confidence: ${result.confidence_ok}`);
      console.log(`🤖 [PythonMatcher] Processing time: ${result.processing_time_ms}ms`);

      return result;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('❌ [PythonMatcher] Request timeout');
        throw new Error('Python service request timed out');
      }
      console.error('❌ [PythonMatcher] Error calling service:', error.message || error);
      throw error;
    }
  }

  /**
   * Process HasData results for multiple stores and return matches for each store
   */
  async processStoresWithHasData(
    query: string,
    hasdataResults: any[],
    nearbyStores: string[]
  ): Promise<{
    storeMatches: { [storeName: string]: any };
    storesNeedingAI: string[];
    processingTime: number;
    source: string;
  }> {
    try {
      // Check if service is available
      const isAvailable = await this.isServiceAvailable();
      
      if (!isAvailable) {
        console.log('⚠️ [PythonMatcher] Service not available, using fallback');
        // Fallback: return first HasData result for each store
        const storeMatches: { [storeName: string]: any } = {};
        const storesNeedingAI: string[] = [];
        
        // Group HasData results by store
        const storeResults: { [storeName: string]: any[] } = {};
        for (const result of hasdataResults) {
          const storeName = result.source;
          if (!storeResults[storeName]) {
            storeResults[storeName] = [];
          }
          storeResults[storeName].push(result);
        }
        
        // For each nearby store, try to find a match
        for (const store of nearbyStores) {
          if (storeResults[store] && storeResults[store].length > 0) {
            // Use fallback matching for this store
            const fallbackMatch = this.getBestMatchFallback(query, storeResults[store]);
            if (fallbackMatch) {
              storeMatches[store] = {
                product: fallbackMatch,
                score: 0.6,
                confidence_ok: true,
                reason: 'fallback_match'
              };
            } else {
              storesNeedingAI.push(store);
            }
          } else {
            storesNeedingAI.push(store);
          }
        }
        
        return {
          storeMatches,
          storesNeedingAI,
          processingTime: 0,
          source: 'fallback'
        };
      }

      // Use Python service for matching
      const requestData = {
        query,
        hasdata_results: hasdataResults,
        nearby_stores: nearbyStores
      };

      console.log(`🚀 [PythonMatcher] Calling Python service at: ${this.baseUrl}/match-products-for-stores`);
      console.log(`📊 [PythonMatcher] Request data:`, {
        query,
        resultsCount: hasdataResults.length,
        storesCount: nearbyStores.length
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/match-products-for-stores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error(`❌ [PythonMatcher] Network error calling Python service:`, fetchError.message || fetchError);
        throw new Error(`Failed to connect to Python service at ${this.baseUrl}: ${fetchError.message || 'Network request failed'}`);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`❌ [PythonMatcher] Python service returned error: ${response.status} ${response.statusText}`);
        console.error(`❌ [PythonMatcher] Error details: ${errorText}`);
        throw new Error(`Python service error: ${response.status} ${response.statusText}`);
      }

      let result;
      try {
        result = await response.json();
      } catch (jsonError: any) {
        console.error(`❌ [PythonMatcher] Failed to parse response as JSON:`, jsonError);
        throw new Error('Python service returned invalid JSON response');
      }
      
      console.log(`✅ [PythonMatcher] Python service response received`);
      console.log(`🤖 [PythonMatcher] Store matches: ${result.matched_stores || Object.keys(result.store_matches || {}).length}/${result.total_stores || nearbyStores.length}`);
      console.log(`🤖 [PythonMatcher] Stores needing AI: ${result.stores_needing_ai?.length || 0}`);
      console.log(`🤖 [PythonMatcher] Processing time: ${result.processing_time_ms || 0}ms`);

      return {
        storeMatches: result.store_matches || {},
        storesNeedingAI: result.stores_needing_ai || [],
        processingTime: result.processing_time_ms || 0,
        source: 'python_service'
      };

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('❌ [PythonMatcher] Request timeout, using fallback');
      } else {
        console.error('❌ [PythonMatcher] Processing failed, using fallback:', error.message || error);
      }
      
      // Fallback to intelligent matching - never throw, always return results
      console.log('🔄 [PythonMatcher] Using fallback matching algorithm');
      const storeMatches: { [storeName: string]: any } = {};
      const storesNeedingAI: string[] = [];
      
      // Group HasData results by store
      const storeResults: { [storeName: string]: any[] } = {};
      for (const result of hasdataResults) {
        const storeName = result.source;
        if (!storeResults[storeName]) {
          storeResults[storeName] = [];
        }
        storeResults[storeName].push(result);
      }
      
      // For each nearby store, try to find a match
      for (const store of nearbyStores) {
        // Try to match store name (case-insensitive, partial match)
        let matchedStoreName = store;
        let storeProducts = storeResults[store];
        
        // If exact match not found, try partial matching
        if (!storeProducts || storeProducts.length === 0) {
          for (const [hasDataStoreName, products] of Object.entries(storeResults)) {
            if (hasDataStoreName.toLowerCase().includes(store.toLowerCase()) ||
                store.toLowerCase().includes(hasDataStoreName.toLowerCase())) {
              matchedStoreName = hasDataStoreName;
              storeProducts = products;
              break;
            }
          }
        }
        
        if (storeProducts && storeProducts.length > 0) {
          const fallbackMatch = this.getBestMatchFallback(query, storeProducts);
          if (fallbackMatch) {
            storeMatches[store] = {
              product: fallbackMatch,
              score: 0.6,
              confidence_ok: true,
              reason: 'fallback_match'
            };
          } else {
            storesNeedingAI.push(store);
          }
        } else {
          storesNeedingAI.push(store);
        }
      }
      
      console.log(`✅ [PythonMatcher] Fallback matching completed: ${Object.keys(storeMatches).length} stores matched, ${storesNeedingAI.length} need AI`);
      
      return {
        storeMatches,
        storesNeedingAI,
        processingTime: 0,
        source: 'fallback'
      };
    }
  }

  /**
   * Process HasData results with Python service for better matching (legacy method)
   */
  async processHasDataResults(
    query: string,
    hasdataResults: any[]
  ): Promise<{
    bestMatch: any | null;
    allMatches: any[];
    confidence: number;
    processingTime: number;
    source: string;
  }> {
    try {
      // Check if service is available
      const isAvailable = await this.isServiceAvailable();
      
      if (!isAvailable) {
        console.log('⚠️ [PythonMatcher] Service not available, using fallback');
        const fallbackMatch = this.getBestMatchFallback(query, hasdataResults);
        return {
          bestMatch: fallbackMatch,
          allMatches: hasdataResults,
          confidence: 0.6, // Slightly higher confidence for fallback
          processingTime: 0,
          source: 'fallback'
        };
      }

      // Use Python service for matching
      const pythonResult = await this.matchProducts(query, hasdataResults);
      
      return {
        bestMatch: pythonResult.selected_product,
        allMatches: pythonResult.all_candidates.map(c => c.candidate),
        confidence: pythonResult.score,
        processingTime: pythonResult.processing_time_ms,
        source: 'python_service'
      };

    } catch (error) {
      console.error('❌ [PythonMatcher] Processing failed, using fallback:', error);
      
      // Fallback to intelligent matching
      const fallbackMatch = this.getBestMatchFallback(query, hasdataResults);
      return {
        bestMatch: fallbackMatch,
        allMatches: hasdataResults,
        confidence: 0.6,
        processingTime: 0,
        source: 'fallback'
      };
    }
  }
}

// Export singleton instance
export const pythonMatcherService = new PythonMatcherService();
export default pythonMatcherService;
