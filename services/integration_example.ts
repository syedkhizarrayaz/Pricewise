/**
 * Integration example for React Native app with Product Matcher Service
 * 
 * This file shows how to integrate the Python FastAPI service with your
 * React Native grocery price comparison app.
 */

// Types for the Python service
interface ProductMatchRequest {
  query: string;
  hasdata_results: Array<{
    position: number;
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

interface ProductMatchResponse {
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

// Configuration
const PYTHON_SERVICE_URL = 'http://localhost:8000'; // Change to your service URL
const TIMEOUT_MS = 10000; // 10 seconds timeout

/**
 * Call the Python product matcher service
 */
export const matchProductsWithPythonService = async (
  query: string,
  hasdataResults: any[]
): Promise<ProductMatchResponse> => {
  try {
    console.log(`🤖 [PythonService] Matching products for query: "${query}"`);
    console.log(`🤖 [PythonService] Processing ${hasdataResults.length} candidates`);

    const requestData: ProductMatchRequest = {
      query,
      hasdata_results: hasdataResults,
      // Optional: customize weights for better matching
      weights: {
        token_set: 0.35,
        embed: 0.25,
        partial: 0.15,
        brand: 0.10
      },
      conf_threshold: 0.55,
      tie_delta: 0.05
    };

    const response = await fetch(`${PYTHON_SERVICE_URL}/match-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
      // Add timeout
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`Python service error: ${response.status} ${response.statusText}`);
    }

    const result: ProductMatchResponse = await response.json();
    
    console.log(`🤖 [PythonService] Selected: ${result.selected_product?.title || 'None'}`);
    console.log(`🤖 [PythonService] Score: ${result.score.toFixed(3)}, Confidence: ${result.confidence_ok}`);
    console.log(`🤖 [PythonService] Processing time: ${result.processing_time_ms}ms`);

    return result;

  } catch (error) {
    console.error('❌ [PythonService] Error calling product matcher:', error);
    throw error;
  }
};

/**
 * Enhanced grocery price service that uses Python matcher
 */
export class EnhancedGroceryPriceService {
  private pythonServiceUrl: string;

  constructor(pythonServiceUrl: string = PYTHON_SERVICE_URL) {
    this.pythonServiceUrl = pythonServiceUrl;
  }

  /**
   * Process HasData results with Python service for better matching
   */
  async processHasDataResultsWithPython(
    query: string,
    hasdataResults: any[]
  ): Promise<{
    bestMatch: any | null;
    allMatches: any[];
    confidence: number;
    processingTime: number;
  }> {
    try {
      const pythonResult = await matchProductsWithPythonService(query, hasdataResults);
      
      return {
        bestMatch: pythonResult.selected_product,
        allMatches: pythonResult.all_candidates.map(c => c.candidate),
        confidence: pythonResult.score,
        processingTime: pythonResult.processing_time_ms
      };

    } catch (error) {
      console.error('❌ [EnhancedGroceryPrice] Python service failed, falling back to original logic:', error);
      
      // Fallback to original HasData processing
      return {
        bestMatch: hasdataResults[0] || null,
        allMatches: hasdataResults,
        confidence: 0.5, // Medium confidence for fallback
        processingTime: 0
      };
    }
  }

  /**
   * Check if Python service is available
   */
  async isPythonServiceAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout for health check
      });
      
      return response.ok;
    } catch (error) {
      console.warn('⚠️ [EnhancedGroceryPrice] Python service not available:', error);
      return false;
    }
  }
}

/**
 * Example usage in your existing grocery price service
 */
export const integrateWithExistingService = async (
  originalHasDataResults: any[],
  userQuery: string
) => {
  const enhancedService = new EnhancedGroceryPriceService();
  
  // Check if Python service is available
  const isAvailable = await enhancedService.isPythonServiceAvailable();
  
  if (isAvailable) {
    console.log('✅ [Integration] Using Python service for enhanced matching');
    
    // Use Python service for better matching
    const pythonResult = await enhancedService.processHasDataResultsWithPython(
      userQuery,
      originalHasDataResults
    );
    
    return {
      ...pythonResult,
      source: 'python_service'
    };
    
  } else {
    console.log('⚠️ [Integration] Python service not available, using original logic');
    
    // Fallback to original processing
    return {
      bestMatch: originalHasDataResults[0] || null,
      allMatches: originalHasDataResults,
      confidence: 0.5,
      processingTime: 0,
      source: 'fallback'
    };
  }
};

/**
 * Batch processing for multiple queries
 */
export const batchMatchProducts = async (
  queries: Array<{ query: string; hasdataResults: any[] }>
): Promise<ProductMatchResponse[]> => {
  try {
    const batchRequest = queries.map(({ query, hasdataResults }) => ({
      query,
      hasdata_results: hasdataResults
    }));

    const response = await fetch(`${PYTHON_SERVICE_URL}/match-multiple-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchRequest),
      signal: AbortSignal.timeout(TIMEOUT_MS * 2) // Longer timeout for batch
    });

    if (!response.ok) {
      throw new Error(`Batch processing error: ${response.status}`);
    }

    const results = await response.json();
    return results.results;

  } catch (error) {
    console.error('❌ [BatchMatch] Error in batch processing:', error);
    throw error;
  }
};

// Example of how to modify your existing fetchPrices function
export const enhancedFetchPrices = async (
  items: string[],
  address: string,
  zipCode: string,
  useGPS: boolean,
  latitude?: number,
  longitude?: number
) => {
  // ... your existing HasData API calls ...
  
  // After getting HasData results, enhance them with Python service
  const enhancedResults = [];
  
  for (const item of items) {
    try {
      // Get HasData results for this item
      const hasdataResults = await getHasDataResults(item, address);
      
      // Enhance with Python service
      const enhanced = await integrateWithExistingService(hasdataResults, item);
      
      enhancedResults.push({
        item,
        bestMatch: enhanced.bestMatch,
        confidence: enhanced.confidence,
        source: enhanced.source
      });
      
    } catch (error) {
      console.error(`❌ [EnhancedFetch] Error processing item ${item}:`, error);
      // Continue with other items
    }
  }
  
  return enhancedResults;
};
