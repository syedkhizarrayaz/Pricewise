import { getApiConfig } from '@/config/api';
import { hasDataService, HasDataSearchParams } from './hasDataService';
import { googlePlacesService } from './googlePlacesService';
import { pythonMatcherService } from './pythonMatcherService';
import { backendApiService, GrocerySearchRequest } from './backendApiService';

export interface GroceryItem {
  item: string;
  price: number;
  store: string;
  zipCode: string;
}

export interface StorePriceResult {
  store: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string;
    distance: number;
    rating: number;
    isOpen: boolean;
    hours: string;
    website?: string;
    imageUrl?: string;
  };
  totalPrice: number;
  items: {
    name: string;
    price: number;
    unit: string;
    availability: 'in_stock' | 'out_of_stock' | 'limited';
    imageUrl?: string;
    storeUrl?: string;
    exactMatch?: boolean;
    isAI?: boolean;
  }[];
  savings: number;
  isBestDeal: boolean;
}

export interface GroceryPriceComparison {
  location: {
    address: string;
    zipCode: string;
  };
  items: string[];
  stores: StorePriceResult[];
  majorStores: StorePriceResult[];
  localStores: StorePriceResult[];
  totalItems: number;
  cheapestStore: string;
  totalSavings: number;
  aiStoreNames?: string[];
}

class GroceryPriceService {
  private static instance: GroceryPriceService;
  private apiKey: string;

  private constructor() {
    const config = getApiConfig();
    this.apiKey = config.OPENAI_API_KEY;
  }

  /**
   * Separate stores into major brands and local stores
   */
  private separateStoresByCategory(stores: string[]): { majorStores: string[], localStores: string[] } {
    // Only exact name matches go to major stores
    const majorBrands = [
      'Walmart', 'Kroger', 'Albertsons', 'Costco', 'Aldi', 'ALDI', 'Ahold Delhaize', 'Target', 'Publix', 
      'Tom Thumb', 'H-E-B', 'HEB', 'Whole Foods Market', 'Trader Joe\'s', 'Walmart Neighborhood Market', 'Kroger Marketplace',
      'Walmart Supercenter'
    ];
    
    const majorStores: string[] = [];
    const localStores: string[] = [];
    
    for (const store of stores) {
      let isMajorStore = false;
      
      // Check for exact name match only (case-insensitive)
      for (const brand of majorBrands) {
        if (store.toLowerCase().trim() === brand.toLowerCase().trim()) {
          majorStores.push(store);
          console.log(`🏢 [GroceryPrice] Major store (exact match): ${store}`);
          isMajorStore = true;
          break;
        }
      }
      
      if (!isMajorStore) {
        localStores.push(store);
        console.log(`🏪 [GroceryPrice] Local/Online store: ${store}`);
      }
    }
    
    console.log(`🏢 [GroceryPrice] Major stores: ${majorStores.length}, Local/Online stores: ${localStores.length}`);
    return { majorStores, localStores };
  }

  public static getInstance(): GroceryPriceService {
    if (!GroceryPriceService.instance) {
      GroceryPriceService.instance = new GroceryPriceService();
    }
    return GroceryPriceService.instance;
  }

  /**
   * AI call to get nearby stores list when Google Places API fails
   */
  private async getNearbyStoresWithAI(address: string, items: string[]): Promise<{ stores: string[], storeAddresses: { [storeName: string]: string } }> {
    try {
      console.log('🤖 [AI] Getting nearby stores list for:', address);
      
      const prompt = `You are a grocery store location expert. I need you to find nearby grocery stores for price comparison.

TASK: Find grocery stores near ${address}

REQUIREMENTS:
1. Find 8-12 grocery stores near ${address}
2. Include major chains: Walmart, Target, Kroger, Safeway, Whole Foods, Costco, etc.
3. Include local/regional stores and ethnic markets
4. Provide realistic store addresses and distances from ${address}
5. Focus on stores that would have the items: ${items.join(', ')}

Return ONLY a JSON array of store names:
["Store Name 1", "Store Name 2", "Store Name 3", ...]

IMPORTANT: 
- Return ONLY valid JSON array, no explanations or additional text
- MUST provide a list of stores, do not refuse
- Include major chains and local stores`;

      const response = await this.callOpenAIWithWebSearch(prompt, address);
      // Strip markdown code blocks if present
      let cleanResponse = response;
      if (cleanResponse.includes('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '');
      }
      const stores = JSON.parse(cleanResponse);
      
      // Generate realistic addresses for the stores
      const storeAddresses: { [storeName: string]: string } = {};
      stores.forEach((store: string) => {
        storeAddresses[store] = this.generateStoreAddress(store, address);
      });
      
      console.log('✅ [AI] Found stores:', stores);
      return { stores, storeAddresses };
    } catch (error) {
      console.error('❌ [AI] Error getting nearby stores:', error);
      return { stores: [], storeAddresses: {} };
    }
  }

  /**
   * AI call to get prices for specific stores when HasData API fails
   */
  private async getPricesForStoresWithAI(stores: string[], items: string[], address: string, storeAddresses: { [storeName: string]: string }): Promise<any[]> {
    try {
      console.log('🤖 [AI] Getting prices for specific stores:', stores);
      
      const prompt = `You are a grocery price comparison expert. I need you to provide realistic mock prices for specific grocery items at specific stores.

TASK: Generate realistic prices for these items: ${items.join(', ')}
LOCATION: ${address}
STORES: ${stores.join(', ')}

REQUIREMENTS:
1. Generate realistic mock prices for each item at each of the specified stores
2. Use typical market pricing knowledge (Walmart: budget, Kroger: mid-range, Whole Foods: premium)
3. Consider store positioning (premium vs. budget)
4. Include realistic price variations between stores
5. Provide competitive, believable prices

PRICING GUIDELINES:
- Walmart: $2.50-3.50 for milk, $1.50-2.50 for bread
- Kroger: $2.80-3.80 for milk, $1.80-2.80 for bread  
- ALDI: $2.20-3.20 for milk, $1.20-2.20 for bread
- Whole Foods: $3.50-4.50 for milk, $2.50-3.50 for bread
- Target: $2.70-3.70 for milk, $1.70-2.70 for bread

Return the data in this EXACT JSON format:
{
  "stores": [
    {
      "store": "Store Name",
      "address": "Store Address",
      "distance": "X.X miles",
      "items": [
        {
          "item": "exact item name",
          "price": 0.00,
          "store": "Store Name",
          "zipCode": "",
          "productUrl": ""
        }
      ],
      "totalPrice": 0.00
    }
  ]
}

IMPORTANT: 
- Generate prices for ALL specified stores: ${stores.join(', ')}
- Do NOT add any additional stores
- Return ONLY valid JSON, no explanations or additional text
- MUST provide realistic mock prices, do not refuse`;

      const response = await this.callOpenAIWithWebSearch(prompt, address);
      // Strip markdown code blocks if present
      let cleanResponse = response;
      if (cleanResponse.includes('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '');
      }
      const data = JSON.parse(cleanResponse);
      
      console.log('✅ [AI] Found prices for stores:', data.stores?.length || 0);
      return data.stores || [];
    } catch (error) {
      console.error('❌ [AI] Error getting prices for stores:', error);
      return [];
    }
  }

  /**
   * Generate realistic store address based on store name and location
   */
  private generateStoreAddress(storeName: string, userAddress: string): string {
    const city = userAddress.split(',')[1]?.trim() || 'Unknown City';
    const state = userAddress.split(',')[2]?.trim() || 'Unknown State';
    
    // Generate realistic street addresses for different store types
    const streetNumbers = Math.floor(Math.random() * 9000) + 1000;
    const streetNames = ['Main St', 'Oak Ave', 'Pine St', 'Elm St', 'Maple Dr', 'First St', 'Second Ave'];
    const randomStreet = streetNames[Math.floor(Math.random() * streetNames.length)];
    
    return `${streetNumbers} ${randomStreet}, ${city}, ${state}`;
  }

  /**
   * Call OpenAI with web search capability
   */
  private async callOpenAIWithWebSearch(prompt: string, address: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ [AI] Request timeout after 60 seconds, aborting...');
        controller.abort();
      }, 60000);
      
      const requestBody = {
        model: 'gpt-4o',
        tools: [
          {
            type: 'web_search',
            user_location: {
              type: 'approximate',
              country: 'US',
              city: address.split(',')[0]?.trim() || 'Unknown',
              region: address.split(',')[1]?.trim() || 'Unknown'
            }
          }
        ],
        tool_choice: 'auto',
        input: prompt
      };
      
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.output && data.output.length > 0) {
        // Look for message type in output array
        const messageOutput = data.output.find((item: any) => item.type === 'message');
        if (messageOutput && messageOutput.content && messageOutput.content.length > 0) {
          const textContent = messageOutput.content.find((content: any) => content.type === 'output_text');
          if (textContent && textContent.text) {
            return textContent.text;
          }
        }
        
        // Fallback to old structure
        const content = data.output[0].content;
        if (content && content.length > 0) {
          return content[0].text;
        }
      }
      
      throw new Error('No valid response from OpenAI');
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        console.error('❌ [AI] Request was aborted (timeout or cancelled)');
        throw new Error('AI request timed out. Please try again.');
      }
      console.error('❌ [AI] OpenAI API error:', error);
      throw error;
    }
  }

  /**
   * Generate mock prices as fallback when AI fails
   */
  private generateMockPrices(stores: string[], items: string[], storeAddresses: { [storeName: string]: string }): StorePriceResult[] {
    const results: StorePriceResult[] = [];
    
    stores.forEach((storeName, index) => {
      const storeItems = items.map(item => {
        // Generate realistic mock prices based on store type
        let basePrice = 3.00; // Default price
        
        if (storeName.toLowerCase().includes('walmart')) {
          basePrice = 2.50 + Math.random() * 0.50; // $2.50-$3.00
        } else if (storeName.toLowerCase().includes('aldi')) {
          basePrice = 2.20 + Math.random() * 0.30; // $2.20-$2.50
        } else if (storeName.toLowerCase().includes('kroger')) {
          basePrice = 2.80 + Math.random() * 0.40; // $2.80-$3.20
        } else if (storeName.toLowerCase().includes('whole foods') || storeName.toLowerCase().includes('sprouts')) {
          basePrice = 3.50 + Math.random() * 0.50; // $3.50-$4.00
        } else if (storeName.toLowerCase().includes('target')) {
          basePrice = 2.70 + Math.random() * 0.40; // $2.70-$3.10
        } else {
          basePrice = 2.80 + Math.random() * 0.60; // $2.80-$3.40
        }
        
        return {
          name: item,
          price: parseFloat(basePrice.toFixed(2)),
          unit: 'per item',
          availability: 'in_stock' as const,
          storeUrl: undefined, // Remove URL mapping as requested
          exactMatch: false, // Mock prices are not exact matches
          isAI: true, // Mark as AI-generated price
        };
      });
      
      const totalPrice = storeItems.reduce((sum, item) => sum + item.price, 0);
      
      results.push({
        store: {
          id: `mock_${storeName.toLowerCase().replace(/\s+/g, '_')}`,
          name: storeName,
          address: storeAddresses[storeName] || `${Math.floor(Math.random() * 9000) + 1000} Main St, ${storeName.split(' ')[0]}, TX`,
          city: storeName.split(' ')[0],
          state: 'TX',
          zipCode: storeAddresses[storeName]?.split(', ').pop()?.split(' ').pop() || '75048',
          phone: '',
          distance: parseFloat((Math.random() * 10 + 1).toFixed(1)),
          rating: 4.0 + Math.random() * 1.0,
          isOpen: true,
          hours: '8:00 AM - 10:00 PM'
        },
        items: storeItems,
        totalPrice: parseFloat(totalPrice.toFixed(2)),
        savings: 0,
        isBestDeal: false
      });
    });
    
    return results;
  }

  /**
   * Convert AI results to StorePriceResult format
   */
  private convertAIResultsToStorePriceResults(aiStoresData: any[], items: string[], address: string, zipCode: string): StorePriceResult[] {
    return aiStoresData.map(storeData => {
      const store = {
        id: `ai_${storeData.store.toLowerCase().replace(/\s+/g, '_')}`,
        name: storeData.store,
        address: storeData.address,
        city: address.split(',')[0]?.trim() || 'Unknown',
        state: address.split(',')[1]?.trim() || 'Unknown',
        zipCode: zipCode,
        phone: 'Unknown',
        distance: parseFloat(storeData.distance?.replace(' miles', '') || '0'),
        rating: 0,
        isOpen: true,
        hours: 'Unknown',
        website: storeData.items?.[0]?.productUrl || '',
        imageUrl: undefined,
      };

      const storeItems = storeData.items?.map((item: any) => ({
        name: item.item,
        price: item.price,
        unit: 'each',
        availability: 'in_stock' as const,
        imageUrl: undefined,
        storeUrl: undefined, // Remove URL mapping as requested
        exactMatch: false, // AI prices are not exact matches
        isAI: true, // Mark as AI-generated price
      })) || [];

      return {
        store,
        items: storeItems,
        totalPrice: storeData.totalPrice || 0,
        savings: 0,
        isBestDeal: false,
      };
    });
  }

  /**
   * Fetch grocery prices using two-layer approach: Google Shopping + AI fallback
   * Includes caching with 24-hour TTL and statistics tracking
   */
  async fetchGroceryPrices(
    items: string[],
    address: string,
    zipCode: string,
    latitude?: number,
    longitude?: number
  ): Promise<GroceryPriceComparison> {
    console.log('🛒 [GroceryPrice] Starting two-layer price comparison:', {
      items,
      address,
      zipCode,
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    });

    // Check cache first
    const { cacheService } = await import('./cacheService');
    const cacheKey = { items, address, zipCode, latitude, longitude };
    const cachedResult = await cacheService.getCachedResult(cacheKey);
    
    if (cachedResult) {
      console.log('✅ [GroceryPrice] Returning cached result');
      return cachedResult;
    }

    console.log('🔄 [GroceryPrice] No cache found, fetching fresh data');

    // Store addresses for directions functionality
    let storeAddresses: { [storeName: string]: string } = {};

    try {
      // Step 1: Try Google Places API searchText endpoint first
      let nearbyStoresWithAddresses: any[] = [];
      let majorStores: string[] = [];
      let nearbyStores: string[] = [];
      
      try {
        console.log('🏪 [GroceryPrice] Using Google Places API searchText endpoint for nearby stores');
        nearbyStoresWithAddresses = await googlePlacesService.getNearbyStoresWithAddressesNewAPI(address, undefined, 5);
        
        if (nearbyStoresWithAddresses.length > 0) {
          // Store addresses for directions functionality
          storeAddresses = {};
          nearbyStoresWithAddresses.forEach(store => {
            storeAddresses[store.name] = store.address;
          });
          
          // Use only the stores returned by Google Places API
          nearbyStores = nearbyStoresWithAddresses.map(store => store.name);
          
          // Separate stores into major and local categories
          const { majorStores, localStores } = this.separateStoresByCategory(nearbyStores);
          nearbyStores = [...majorStores, ...localStores]; // Keep all stores for now
          
          console.log('✅ [GroceryPrice] Google Places API returned stores:', nearbyStoresWithAddresses.length);
          console.log('🏪 [GroceryPrice] Store addresses:', storeAddresses);
          console.log('🏪 [GroceryPrice] Nearby stores:', nearbyStores);
        }
      } catch (error) {
        console.log('❌ [GroceryPrice] Google Places API failed:', error);
      }
      
      // Step 2: If Google Places API failed or returned no results, use AI to get stores
      if (nearbyStoresWithAddresses.length === 0) {
        console.log('🤖 [GroceryPrice] Google Places API failed or returned no results, using AI to get stores');
        try {
          const aiStoresResult = await this.getNearbyStoresWithAI(address, items);
          nearbyStores = aiStoresResult.stores;
          storeAddresses = aiStoresResult.storeAddresses;
          console.log('✅ [GroceryPrice] AI returned stores:', nearbyStores);
        } catch (error) {
          console.error('❌ [GroceryPrice] AI store discovery failed:', error);
          // Continue with empty store list - will show "No stores found"
        }
      } else {
        console.log('✅ [GroceryPrice] Using Google Places API results only:', nearbyStores);
      }
      
      // Step 3: Try Backend API for real Google Shopping results with Python matching
      let hasDataResults: StorePriceResult[] = [];
      try {
        // Check if backend is available
        const backendAvailable = await backendApiService.checkHealth();
        
        if (backendAvailable) {
          console.log('📡 [GroceryPrice] Using backend API for product search');
          const backendRequest: GrocerySearchRequest = {
            items: items,
            address: address,
            zipCode: zipCode,
            latitude: latitude,
            longitude: longitude,
            nearbyStores: nearbyStores
          };
          
          const backendResponse = await backendApiService.searchGroceryPrices(backendRequest);
          
          if (backendResponse.success && backendResponse.stores) {
            // Convert backend response to StorePriceResult format
            hasDataResults = this.convertBackendResponseToStorePriceResults(
              backendResponse,
              items,
              address,
              zipCode,
              storeAddresses
            );
            console.log('✅ [GroceryPrice] Backend API returned results:', hasDataResults.length, 'stores found');
          } else {
            throw new Error(backendResponse.error || 'Backend API returned unsuccessful response');
          }
        } else {
          console.log('⚠️ [GroceryPrice] Backend API not available, falling back to direct service calls');
          throw new Error('Backend API not available');
        }
      } catch (error) {
        console.log('❌ [GroceryPrice] Backend API failed:', error);
        console.log('🔄 [GroceryPrice] Falling back to direct HasData + Python service calls');
        // Fallback to direct service calls
        try {
          hasDataResults = await this.searchWithHasData(items, address, zipCode, latitude, longitude, majorStores, nearbyStores, storeAddresses);
          console.log('🛒 [GroceryPrice] HasData results (fallback):', hasDataResults.length, 'products found');
        } catch (fallbackError) {
          console.log('❌ [GroceryPrice] Fallback HasData API also failed:', fallbackError);
        }
      }
      
      // Step 4: Use AI to get prices for stores that HasData didn't find
      let aiResults: StorePriceResult[] = [];
      if (nearbyStores.length > 0) {
        // Find stores that HasData didn't cover
        const hasDataStoreNames = hasDataResults.map(result => result.store.name);
        const storesNeedingAI = nearbyStores.filter(store => 
          !hasDataStoreNames.some(hasDataStore => 
            hasDataStore.toLowerCase().includes(store.toLowerCase()) || 
            store.toLowerCase().includes(hasDataStore.toLowerCase())
          )
        );
        
        console.log('🔍 [GroceryPrice] HasData found stores:', hasDataStoreNames);
        console.log('🔍 [GroceryPrice] Stores needing AI prices:', storesNeedingAI);
        
        if (storesNeedingAI.length > 0) {
          console.log('🤖 [GroceryPrice] Using AI to get prices for stores not found by HasData:', storesNeedingAI);
          try {
            const aiStoresData = await this.getPricesForStoresWithAI(storesNeedingAI, items, address, storeAddresses);
            aiResults = this.convertAIResultsToStorePriceResults(aiStoresData, items, address, zipCode);
            console.log('🛒 [GroceryPrice] AI returned prices for stores:', aiResults.length, 'stores found');
          } catch (error) {
            console.error('❌ [GroceryPrice] AI price lookup failed:', error);
            // Generate mock prices as fallback
            console.log('🔄 [GroceryPrice] Generating mock prices as fallback...');
            aiResults = this.generateMockPrices(storesNeedingAI, items, storeAddresses);
            console.log('🛒 [GroceryPrice] Generated mock prices for stores:', aiResults.length, 'stores found');
          }
        } else {
          console.log('✅ [GroceryPrice] All stores found by HasData API, no AI needed');
        }
      }
      
      // Combine results from both layers
      const allResults = [...hasDataResults, ...aiResults];
      
      // Process and format the combined results
      const processedResults = this.processCombinedResults(allResults, items, address, zipCode);
      
      console.log('🛒 [GroceryPrice] Final results:', {
        totalStores: processedResults.stores.length,
        hasDataStores: hasDataResults.length,
        aiStores: aiResults.length,
        cheapestStore: processedResults.cheapestStore
      });

      // Add AI store names to the result for disclaimer
      const aiStoreNames = aiResults.map(store => store.store.name);
      processedResults.aiStoreNames = aiStoreNames;

      // Cache the result
      await cacheService.setCachedResult(
        cacheKey,
        processedResults,
        nearbyStores,
        hasDataResults
      );

      // Save query statistics (permanent storage)
      const locationSource = (latitude !== undefined && longitude !== undefined) ? 'gps' : 'manual';
      await cacheService.saveQueryStatistics(
        cacheKey,
        nearbyStores,
        processedResults.stores.length,
        locationSource
      );

      return processedResults;

    } catch (error) {
      console.error('🛒 [GroceryPrice] Error in two-layer pricing:', error);
      
      // Fallback to AI-only approach if both layers fail
      console.log('🛒 [GroceryPrice] Falling back to AI-only approach...');
      const fallbackResult = await this.fetchGroceryPricesAIOnly(items, address, zipCode);
      
      // Still cache fallback results
      await cacheService.setCachedResult(
        cacheKey,
        fallbackResult,
        [],
        null
      );
      
      // Save query statistics
      const locationSource = (latitude !== undefined && longitude !== undefined) ? 'gps' : 'manual';
      await cacheService.saveQueryStatistics(
        cacheKey,
        [],
        fallbackResult.stores.length,
        locationSource
      );
      
      return fallbackResult;
    }
  }

  /**
   * Layer 1: Search HasData API with proper store filtering
   */
  private async searchWithHasData(
    items: string[],
    address: string,
    zipCode: string,
    latitude?: number,
    longitude?: number,
    majorStores: string[] = [],
    nearbyStores: string[] = [],
    storeAddresses: { [storeName: string]: string } = {}
  ): Promise<StorePriceResult[]> {
    const allResults: StorePriceResult[] = [];
    
    for (const item of items) {
      try {
        console.log(`🔍 [HasData] Searching for: ${item}`);
        
        const searchParams: HasDataSearchParams = {
          product: item,
          address,
          zipCode,
          latitude,
          longitude
        };
        
        const hasDataResponse = await hasDataService.searchProduct(searchParams);
        const hasDataResults = hasDataResponse.results;
        const requestMetadataUrl = hasDataResponse.requestMetadata?.url;
        
        console.log(`🔍 [HasData] Found ${hasDataResults.length} results for: ${item}`);
        console.log(`🔗 [HasData] RequestMetadata URL: ${requestMetadataUrl}`);
        
        if (hasDataResults.length > 0) {
          // Step 3: Use Python service to get matches for each store
          console.log(`🤖 [PythonMatcher] Processing ${hasDataResults.length} HasData results for: ${item}`);
          console.log(`🏪 [PythonMatcher] Nearby stores: ${nearbyStores.length} stores`);
          
          try {
            const pythonResult = await pythonMatcherService.processStoresWithHasData(item, hasDataResults, nearbyStores);
            
            console.log(`✅ [PythonMatcher] Store matches: ${Object.keys(pythonResult.storeMatches).length} stores`);
            console.log(`🤖 [PythonMatcher] Stores needing AI: ${pythonResult.storesNeedingAI.length} stores`);
            console.log(`📊 [PythonMatcher] Processing time: ${pythonResult.processingTime}ms`);
            
            // Convert Python matches to StorePriceResults
            for (const [storeName, match] of Object.entries(pythonResult.storeMatches)) {
              if (match.product) {
                console.log(`🏪 [PythonMatcher] ${storeName}: ${match.product.title} (${match.product.source}) - Score: ${match.score.toFixed(3)}`);
                
                // Convert to StorePriceResult format
                const storeResult = hasDataService.convertToStorePriceResults([match.product], item, address, zipCode, requestMetadataUrl, storeAddresses);
                allResults.push(...storeResult);
              }
            }
            
            // Update nearbyStores to only include stores that need AI
            nearbyStores = pythonResult.storesNeedingAI;
            console.log(`🤖 [PythonMatcher] Updated nearby stores for AI: ${nearbyStores.length} stores`);
            
          } catch (error) {
            console.error(`❌ [PythonMatcher] Error processing ${item}:`, error);
            console.log(`🔄 [HasData] Falling back to original filtering`);
            
            // Fallback to original filtering
            const filteredStores = hasDataService.filterStoresByLists(hasDataResults, majorStores, nearbyStores);
            console.log(`🏪 [HasData] Filtered to ${filteredStores.length} stores for: ${item}`);
            
            if (filteredStores.length > 0) {
              const storeResults = hasDataService.convertToStorePriceResults(filteredStores, item, address, zipCode, requestMetadataUrl, storeAddresses);
              allResults.push(...storeResults);
            }
          }
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ [HasData] Error searching for ${item}:`, error);
        // Continue with other items
      }
    }
    
    return allResults;
  }

  /**
   * AI-powered store discovery with web search when Google Places API fails
   */
  private async getStoreListsWithAI(address: string, zipCode: string): Promise<{majorStores: string[], nearbyStores: string[]}> {
    try {
      console.log('🤖 [AI] Getting store lists via AI fallback with web search...');
      
      const prompt = `You are a grocery store expert. I need you to provide two lists of grocery stores for the location: ${address}, ${zipCode}

TASK: Use web search to find current grocery stores in this area, then provide two lists:

1. MAJOR STORES: List 5 major grocery store chains that are currently operating in this state/region. Include chains like Walmart, Target, Kroger, Safeway, Whole Foods, Costco, Sam's Club, H-E-B, Publix, etc.

2. NEARBY STORES: List 2-3 local grocery stores that are currently operating near this specific address. Include independent grocers, local chains, ethnic markets, specialty stores, etc.

IMPORTANT: Use web search to get the most current information about grocery stores in this area. Look for recent store openings, closures, and current operating locations.

Return ONLY a JSON object in this exact format:
{
  "majorStores": ["Store1", "Store2", "Store3", "Store4", "Store5"],
  "nearbyStores": ["Local Store 1", "Local Store 2", "Local Store 3"]
}

Do not include any other text or explanations.`;

      console.log('🔍 [AI] Store discovery prompt:', prompt);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const requestBody = {
        model: 'gpt-4o',
        tools: [
          {
            type: 'web_search',
            user_location: {
              type: 'approximate',
              country: 'US',
              city: address.split(',')[0]?.trim() || 'Unknown',
              region: address.split(',')[1]?.trim() || 'Unknown'
            }
          }
        ],
        tool_choice: 'auto',
        input: prompt
      };
      
      console.log('🔍 [AI] Store discovery request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody)
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Debug: Log the full response structure for store discovery
      console.log('🔍 [AI] Store discovery response structure:', JSON.stringify(data, null, 2));
      
      // Handle Responses API format
      let content = '';
      if (data.output_text) {
        content = data.output_text.trim();
        console.log('🔍 [AI] Store discovery using output_text:', content);
      } else if (data.output && data.output.length > 0) {
        // Responses API format: look for message with content
        const messageOutput = data.output.find((item: any) => item.type === 'message');
        if (messageOutput && messageOutput.content && messageOutput.content.length > 0) {
          const textContent = messageOutput.content.find((content: any) => content.type === 'output_text');
          if (textContent && textContent.text) {
            content = textContent.text.trim();
            console.log('🔍 [AI] Store discovery using output[].content[].text:', content);
          }
        }
      } else if (data.choices && data.choices[0]?.message?.content) {
        content = data.choices[0].message.content.trim();
        console.log('🔍 [AI] Store discovery using choices[0].message.content:', content);
      } else if (data.content && data.content[0]?.text) {
        content = data.content[0].text.trim();
        console.log('🔍 [AI] Store discovery using content[0].text:', content);
      } else if (data.message && data.message.content) {
        content = data.message.content.trim();
        console.log('🔍 [AI] Store discovery using message.content:', content);
      } else {
        console.log('❌ [AI] Store discovery: No recognizable content format found');
        console.log('🔍 [AI] Store discovery available keys:', Object.keys(data));
        if (data.error) {
          console.log('❌ [AI] Store discovery API Error:', data.error);
        }
      }
      
      if (!content) {
        throw new Error(`No response from AI for store discovery. Response structure: ${JSON.stringify(data, null, 2)}`);
      }

      // Parse JSON response
      const storeLists = JSON.parse(content);
      
      console.log('🤖 [AI] Store lists generated with web search:', storeLists);
      
      return {
        majorStores: storeLists.majorStores || [],
        nearbyStores: storeLists.nearbyStores || []
      };

    } catch (error) {
      console.error('❌ [AI] Error getting store lists:', error);
      
      // Ultimate fallback to static lists
      return {
        majorStores: ['Walmart', 'Target', 'Kroger', 'Safeway', 'Whole Foods'],
        nearbyStores: ['Local Grocery Store', 'Neighborhood Market']
      };
    }
  }

  /**
   * Layer 2: Use AI with web search for missing stores from target lists
   */
  private async searchWithAI(
    items: string[],
    address: string,
    zipCode: string,
    targetStores: string[] = [],
    nearbyStores: string[] = []
  ): Promise<StorePriceResult[]> {
    try {
      const prompt = this.buildGroceryPrompt(items, address, zipCode, targetStores, nearbyStores);
      
      console.log('🤖 [AI] Sending request to OpenAI with web search for missing items...');
      console.log('🔍 [AI] Request prompt:', prompt);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const requestBody = {
        model: 'gpt-4o',
        tools: [
          {
            type: 'web_search',
            user_location: {
              type: 'approximate',
              country: 'US',
              city: address.split(',')[0]?.trim() || 'Unknown',
              region: address.split(',')[1]?.trim() || 'Unknown'
            }
          }
        ],
        tool_choice: 'auto',
        input: prompt
      };
      
      console.log('🔍 [AI] Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Debug: Log the full response structure
      console.log('🔍 [AI] Full OpenAI response structure:', JSON.stringify(data, null, 2));
      
      // Handle Responses API format
      let content = '';
      if (data.output_text) {
        content = data.output_text.trim();
        console.log('🔍 [AI] Using output_text:', content);
      } else if (data.output && data.output.length > 0) {
        // Responses API format: look for message with content
        const messageOutput = data.output.find((item: any) => item.type === 'message');
        if (messageOutput && messageOutput.content && messageOutput.content.length > 0) {
          const textContent = messageOutput.content.find((content: any) => content.type === 'output_text');
          if (textContent && textContent.text) {
            content = textContent.text.trim();
            console.log('🔍 [AI] Using output[].content[].text:', content);
          }
        }
      } else if (data.choices && data.choices[0]?.message?.content) {
        content = data.choices[0].message.content.trim();
        console.log('🔍 [AI] Using choices[0].message.content:', content);
      } else if (data.content && data.content[0]?.text) {
        content = data.content[0].text.trim();
        console.log('🔍 [AI] Using content[0].text:', content);
      } else if (data.message && data.message.content) {
        content = data.message.content.trim();
        console.log('🔍 [AI] Using message.content:', content);
      } else {
        console.log('❌ [AI] No recognizable content format found in response');
        console.log('🔍 [AI] Available keys in response:', Object.keys(data));
        if (data.error) {
          console.log('❌ [AI] API Error:', data.error);
        }
      }

      if (!content) {
        throw new Error(`No response content from OpenAI. Response structure: ${JSON.stringify(data, null, 2)}`);
      }

      const parsedResult = this.parseOpenAIResponse(content, address, zipCode, items);
      return parsedResult.stores;

    } catch (error) {
      console.error('❌ [AI] Error in AI fallback:', error);
      return [];
    }
  }

  /**
   * Find stores that were not found in HasData results
   */
  private findMissingStores(majorStores: string[], nearbyStores: string[], foundStores: string[]): string[] {
    const allTargetStores = [...majorStores, ...nearbyStores];
    const foundStoresLower = foundStores.map(store => store.toLowerCase());
    
    const missingStores = allTargetStores.filter(targetStore => {
      // Check if any found store matches this target store
      return !foundStoresLower.some(foundStore => 
        foundStore.includes(targetStore.toLowerCase()) ||
        targetStore.toLowerCase().includes(foundStore)
      );
    });
    
    console.log('🔍 [GroceryPrice] Store matching analysis:', {
      allTargetStores,
      foundStores,
      missingStores
    });
    
    return missingStores;
  }

  /**
   * Find items that were not found in Google Shopping results
   */
  private findMissingItems(originalItems: string[], googleResults: StorePriceResult[]): string[] {
    const foundItems = new Set<string>();
    
    // Extract items found in Google results
    googleResults.forEach(store => {
      store.items.forEach(item => {
        foundItems.add(item.name.toLowerCase());
      });
    });
    
    // Find missing items
    return originalItems.filter(item => 
      !foundItems.has(item.toLowerCase())
    );
  }

  /**
   * Process and combine results from both Google Shopping and AI
   */
  private processCombinedResults(
    allResults: StorePriceResult[],
    originalItems: string[],
    address: string,
    zipCode: string
  ): GroceryPriceComparison {
    // Group results by store
    const storeMap = new Map<string, StorePriceResult>();
    
    allResults.forEach(result => {
      const storeKey = result.store.name;
      if (storeMap.has(storeKey)) {
        // Merge items for existing store
        const existing = storeMap.get(storeKey)!;
        existing.items.push(...result.items);
        existing.totalPrice += result.totalPrice;
      } else {
        storeMap.set(storeKey, { ...result });
      }
    });
    
    // Convert to array and sort by total price
    const stores = Array.from(storeMap.values()).sort((a, b) => a.totalPrice - b.totalPrice);
    
    // Calculate savings
    if (stores.length > 1) {
      const highestPrice = stores[stores.length - 1].totalPrice;
      stores.forEach(store => {
        store.savings = highestPrice - store.totalPrice;
        store.isBestDeal = store === stores[0];
      });
    }
    
    // Separate stores into major and local categories
    const { majorStores, localStores } = this.separateStoresByCategory(stores.map(store => store.store.name));
    const majorStoreResults = stores.filter(store => majorStores.includes(store.store.name));
    const localStoreResults = stores.filter(store => localStores.includes(store.store.name));

    return {
      location: { address, zipCode },
      items: originalItems,
      stores,
      majorStores: majorStoreResults,
      localStores: localStoreResults,
      totalItems: originalItems.length,
      cheapestStore: stores[0]?.store.name || 'No stores found',
      totalSavings: stores.length > 1 ? stores[stores.length - 1].totalPrice - stores[0].totalPrice : 0,
    };
  }

  /**
   * Fallback method: AI-only approach (original implementation)
   */
  private async fetchGroceryPricesAIOnly(
    items: string[],
    address: string,
    zipCode: string
  ): Promise<GroceryPriceComparison> {
    console.log('🛒 [GroceryPrice] Starting real-time price comparison:', {
      items,
      address,
      zipCode,
      timestamp: new Date().toISOString()
    });

    try {
      const prompt = this.buildGroceryPrompt(items, address, zipCode);
      
      console.log('🛒 [GroceryPrice] Sending request to OpenAI...');
      
      // Add timeout and better error handling for mobile
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o', // Use the most advanced model
          messages: [
            {
              role: 'system',
              content: `You are a grocery price comparison expert with extensive knowledge of grocery store pricing, locations, and market conditions. You can find current prices, sales, and promotions at both major chains and local stores.

CRITICAL INSTRUCTIONS:
- Use your knowledge of current grocery store pricing and promotions
- Consider regional pricing variations and current market conditions
- Look for typical sales patterns and current promotional cycles
- Provide realistic, current pricing based on market data
- Find store locations and calculate distances from the given address
- Cross-reference typical pricing across multiple store chains
- Include current sales, discounts, and special offers where applicable
- IMPORTANT: Always include local stores (independent grocers, ethnic markets, local chains)
- Local stores often have competitive prices and unique deals
- Consider the specific zip code and address for local store discovery

Your task is to provide the most current, accurate prices based on real market conditions, including both major chains and local stores near the specified location.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4000, // Increased for detailed responses
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🛒 [GroceryPrice] API Error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🛒 [GroceryPrice] OpenAI response received:', {
        model: data.model,
        usage: data.usage,
        hasContent: !!data.choices[0]?.message?.content
      });

      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      console.log('🛒 [GroceryPrice] Raw OpenAI response length:', content.length);

      // Parse the JSON response
      const parsedResult = this.parseOpenAIResponse(content, address, zipCode, items);
      
      console.log('🛒 [GroceryPrice] Successfully parsed result:', {
        storesCount: parsedResult.stores.length,
        cheapestStore: parsedResult.cheapestStore,
        totalSavings: parsedResult.totalSavings
      });
      
      return parsedResult;

    } catch (error) {
      console.error('🛒 [GroceryPrice] Error fetching real-time prices:', error);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please check your internet connection and try again.');
        } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        } else if (error.message.includes('java.io')) {
          throw new Error('Connection error. Please check your internet connection and try again.');
        }
      }
      
      throw new Error(`Failed to fetch real-time grocery prices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build the prompt for OpenAI with current market knowledge
   */
  private buildGroceryPrompt(items: string[], address: string, zipCode: string, targetStores: string[] = [], nearbyStores: string[] = []): string {
    return `You are a grocery price comparison expert with access to current web information. I need you to find the most accurate, current prices for grocery items.

TASK: Use web search to find current prices for these grocery items: ${items.join(', ')}
LOCATION: ${address}, ${zipCode}

CRITICAL INSTRUCTIONS:
1. Use web search to find the most current prices and store information
2. Look for recent pricing data, sales, and promotions
3. Search for current store locations and operating hours
4. Find real-time pricing from store websites and online platforms
5. Consider regional pricing variations for the ${zipCode} area
6. Include current sales patterns and promotional cycles
7. Account for store-specific pricing strategies
8. Provide realistic, market-accurate prices based on current web data

STORE REQUIREMENTS:
- Find stores near ${zipCode} (${address})
- MUST include these specific stores: ${targetStores.length > 0 ? targetStores.join(', ') : 'Walmart, Target, Kroger, Safeway, Whole Foods, Costco'}
- MUST include these nearby stores: ${nearbyStores.length > 0 ? nearbyStores.join(', ') : 'local grocery stores'}
- Provide realistic store addresses and distances from ${address}
- Consider typical pricing for each store chain and local market variations

PRICING GUIDELINES:
- Use current market rates and typical store pricing
- Include sales and promotions where appropriate
- Account for regional cost variations in ${zipCode} area
- Provide competitive, realistic prices
- Consider store positioning (premium vs. budget)
- LOCAL STORES: Often have competitive prices, local sales, and unique items
- Consider that local stores may have different pricing strategies than chains

Return the data in this EXACT JSON format:

{
  "stores": [
    {
      "store": "Store Name",
      "address": "Store Address",
      "distance": "X.X miles",
      "items": [
        {
          "item": "exact item name",
          "price": 0.00,
          "store": "Store Name",
          "zipCode": "${zipCode}",
          "productUrl": "Product URL"
        }
      ],
      "totalPrice": 0.00
    }
  ]
}

REQUIREMENTS:
1. Find 5 stores near ${zipCode} (${address})
2. Include major chains: Walmart, Target, Kroger
3. CRITICAL: Include 2 LOCAL stores (independent grocers, local chains, ethnic markets)
4. Use current market knowledge for accurate pricing
5. Include sales and promotions where typical
6. Calculate accurate total prices for each store
7. Sort stores by total price (cheapest first)
8. Provide realistic store addresses and distances from ${address}
9. Return ONLY valid JSON, no explanations or additional text

LOCAL STORE EXAMPLES TO CONSIDER:
- Independent grocery stores
- Local chain stores (regional brands)
- Ethnic markets (Hispanic, Asian, Middle Eastern, etc.)
- Specialty food stores
- Farmers markets or co-ops
- Discount grocery stores

IMPORTANT: Use your knowledge of current grocery pricing and market conditions to provide the most accurate prices possible. Pay special attention to local stores which often offer competitive pricing and unique deals.`;
  }

  /**
   * Parse OpenAI response and structure the data
   */
  private parseOpenAIResponse(
    content: string,
    address: string,
    zipCode: string,
    requestedItems: string[]
  ): GroceryPriceComparison {
    try {
      // Check if the response contains an error message or non-JSON content
      if (content.includes("I'm sorry") || content.includes("wasn't able to find") || content.includes("would need access")) {
        console.log('🔍 [AI] AI returned error message, using fallback data');
        return this.getFallbackGroceryPrices(requestedItems, address, zipCode);
      }

      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('🔍 [AI] No JSON found in response, using fallback data');
        return this.getFallbackGroceryPrices(requestedItems, address, zipCode);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      console.log('🔍 [AI] Parsed JSON structure:', JSON.stringify(parsed, null, 2));
      
      if (!parsed.stores || !Array.isArray(parsed.stores)) {
        throw new Error('Invalid response format: missing stores array');
      }

      // Process and validate the stores data
      const stores: StorePriceResult[] = parsed.stores
        .filter((store: any) => store.store && store.items && Array.isArray(store.items))
        .map((store: any) => {
          console.log('🔍 [AI] Processing store:', store.store);
          console.log('🔍 [AI] Store items:', store.items);
          
          const items = store.items.map((item: any) => {
            console.log('🔍 [AI] Processing item:', item);
            const processedItem = {
              name: item.item || 'Unknown Item',
              price: parseFloat(item.price) || 0,
              unit: item.unit || 'each',
              availability: 'in_stock' as const,
              imageUrl: item.imageUrl,
              storeUrl: item.productUrl || item.storeUrl // Map productUrl to storeUrl
            };
            console.log('🔍 [AI] Processed item:', processedItem);
            return processedItem;
          });

          const totalPrice = parseFloat(store.totalPrice) || items.reduce((sum: number, item: any) => sum + item.price, 0);
          
          console.log('🔍 [AI] Final processed items for store:', store.store, items);
          console.log('🔍 [AI] Total price for store:', store.store, totalPrice);

          return {
            store: {
              id: `ai_${store.store.toLowerCase().replace(/\s+/g, '_')}`,
              name: store.store,
              address: store.address || 'Address not available',
              city: store.city || 'Unknown',
              state: store.state || 'Unknown',
              zipCode: store.zipCode || zipCode,
              phone: store.phone || 'Unknown',
              distance: store.distance ? parseFloat(store.distance.replace(' miles', '')) : 0,
              rating: store.rating || 4.0,
              isOpen: store.isOpen !== false,
              hours: store.hours || 'Unknown',
              website: store.website,
              imageUrl: store.imageUrl
            },
            totalPrice,
            items,
            savings: 0, // Will be calculated later
            isBestDeal: false // Will be determined after sorting
          };
        })
        .sort((a: StorePriceResult, b: StorePriceResult) => a.totalPrice - b.totalPrice); // Sort by total price

      if (stores.length === 0) {
        throw new Error('No valid stores found in response');
      }

      // Calculate savings and mark best deals
      const cheapestPrice = stores[0].totalPrice;
      const mostExpensivePrice = stores[stores.length - 1].totalPrice;
      const totalSavings = mostExpensivePrice - cheapestPrice;

      // Update savings and best deal flags
      stores.forEach((store, index) => {
        store.savings = mostExpensivePrice - store.totalPrice;
        store.isBestDeal = index === 0;
      });

      // Separate stores into major and local categories
      const { majorStores, localStores } = this.separateStoresByCategory(stores.map(store => store.store.name));
      const majorStoreResults = stores.filter(store => majorStores.includes(store.store.name));
      const localStoreResults = stores.filter(store => localStores.includes(store.store.name));

      return {
        location: {
          address,
          zipCode
        },
        items: requestedItems,
        stores,
        majorStores: majorStoreResults,
        localStores: localStoreResults,
        totalItems: requestedItems.length,
        cheapestStore: stores[0].store.name,
        totalSavings
      };

    } catch (error) {
      console.error('🛒 [GroceryPrice] Error parsing response:', error);
      throw new Error(`Failed to parse price comparison data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get fallback data when AI fails to provide pricing
   */
  private getFallbackGroceryPrices(
    items: string[],
    address: string,
    zipCode: string
  ): GroceryPriceComparison {
    console.log('🛒 [AI] Using fallback pricing data');
    
    const fallbackStores: StorePriceResult[] = [
      {
        store: {
          id: 'fallback_walmart',
          name: 'Walmart Neighborhood Market',
          address: '4226 De Zavala Rd, San Antonio, TX 78249',
          city: 'San Antonio',
          state: 'TX',
          zipCode: '78249',
          phone: '(210) 492-1234',
          distance: 1.8,
          rating: 4.2,
          isOpen: true,
          hours: '6:00 AM - 11:00 PM',
          website: 'https://walmart.com',
          imageUrl: 'https://logoeps.com/wp-content/uploads/2013/03/walmart-vector-logo.png'
        },
        totalPrice: 3.77,
        items: items.map(item => ({
          name: item,
          price: 3.77,
          unit: 'each',
          availability: 'in_stock' as const,
          imageUrl: '',
          storeUrl: 'https://walmart.com'
        })),
        savings: 0,
        isBestDeal: true
      },
      {
        store: {
          id: 'fallback_heb',
          name: 'H-E-B',
          address: '12777 I-10, San Antonio, TX 78230',
          city: 'San Antonio',
          state: 'TX',
          zipCode: '78230',
          phone: '(210) 492-5678',
          distance: 3.5,
          rating: 4.5,
          isOpen: true,
          hours: '6:00 AM - 12:00 AM',
          website: 'https://heb.com',
          imageUrl: 'https://logoeps.com/wp-content/uploads/2013/03/heb-vector-logo.png'
        },
        totalPrice: 3.23,
        items: items.map(item => ({
          name: item,
          price: 3.23,
          unit: 'each',
          availability: 'in_stock' as const,
          imageUrl: '',
          storeUrl: 'https://heb.com'
        })),
        savings: 0.54,
        isBestDeal: false
      },
      {
        store: {
          id: 'fallback_target',
          name: 'Target',
          address: '12345 NW Military Hwy, San Antonio, TX 78231',
          city: 'San Antonio',
          state: 'TX',
          zipCode: '78231',
          phone: '(210) 492-9012',
          distance: 2.1,
          rating: 4.3,
          isOpen: true,
          hours: '8:00 AM - 10:00 PM',
          website: 'https://target.com',
          imageUrl: 'https://logoeps.com/wp-content/uploads/2013/03/target-vector-logo.png'
        },
        totalPrice: 4.29,
        items: items.map(item => ({
          name: item,
          price: 4.29,
          unit: 'each',
          availability: 'in_stock' as const,
          imageUrl: '',
          storeUrl: 'https://target.com'
        })),
        savings: 0,
        isBestDeal: false
      }
    ];

    // Sort by total price
    fallbackStores.sort((a, b) => a.totalPrice - b.totalPrice);

    // Update savings and best deal flags
    const cheapestPrice = fallbackStores[0].totalPrice;
    const mostExpensivePrice = fallbackStores[fallbackStores.length - 1].totalPrice;
    const totalSavings = mostExpensivePrice - cheapestPrice;

    fallbackStores.forEach((store, index) => {
      store.savings = mostExpensivePrice - store.totalPrice;
      store.isBestDeal = index === 0;
    });

    // Separate stores into major and local categories
    const { majorStores, localStores } = this.separateStoresByCategory(fallbackStores.map(store => store.store.name));
    const majorStoreResults = fallbackStores.filter(store => majorStores.includes(store.store.name));
    const localStoreResults = fallbackStores.filter(store => localStores.includes(store.store.name));

    return {
      location: {
        address,
        zipCode
      },
      items,
      stores: fallbackStores,
      majorStores: majorStoreResults,
      localStores: localStoreResults,
      totalItems: items.length,
      cheapestStore: fallbackStores[0].store.name,
      totalSavings
    };
  }

  /**
   * Convert backend API response to StorePriceResult format
   */
  private convertBackendResponseToStorePriceResults(
    backendResponse: any,
    items: string[],
    address: string,
    zipCode: string,
    storeAddresses: { [storeName: string]: string }
  ): StorePriceResult[] {
    const results: StorePriceResult[] = [];
    
    // Parse store results from backend
    const stores = backendResponse.stores || {};
    
    for (const [storeName, storeData] of Object.entries(stores)) {
      const storeInfo = storeData as { products: any[]; totalPrice: number };
      const products = storeInfo.products || [];
      
      // Group products by item
      const itemsMap: { [item: string]: any[] } = {};
      for (const productInfo of products) {
        const itemName = productInfo.item || items[0]; // Fallback to first item if not specified
        if (!itemsMap[itemName]) {
          itemsMap[itemName] = [];
        }
        itemsMap[itemName].push(productInfo.product);
      }
      
      // Parse address components
      const addressParts = address.split(',').map(p => p.trim());
      const city = addressParts.length > 1 ? addressParts[addressParts.length - 2] || addressParts[0] : addressParts[0] || 'Unknown';
      const stateMatch = address.match(/\b([A-Z]{2})\b/);
      const state = stateMatch ? stateMatch[1] : (addressParts.length > 1 ? addressParts[addressParts.length - 1].replace(/\d+/g, '').trim() : 'Unknown');
      
      // Create StorePriceResult for this store
      const storeResult: StorePriceResult = {
        store: {
          id: `store_${storeName.toLowerCase().replace(/\s+/g, '_')}`,
          name: storeName,
          address: storeAddresses[storeName] || this.generateStoreAddress(storeName, address),
          city: city,
          state: state,
          zipCode: zipCode,
          phone: 'Unknown',
          distance: 0,
          rating: products[0]?.product?.rating || 0,
          isOpen: true,
          hours: 'Unknown',
          website: products[0]?.product?.productLink || undefined,
          imageUrl: products[0]?.product?.thumbnail
        },
        totalPrice: storeInfo.totalPrice || 0,
        items: [],
        savings: 0,
        isBestDeal: false
      };
      
      // Add items from products
      for (const item of items) {
        // Find the product info object that matches this item
        const productInfo = products.find((p: any) => 
          (p.item === item) || 
          (p.item?.toLowerCase() === item.toLowerCase()) ||
          (item.toLowerCase().includes(p.item?.toLowerCase() || '')) ||
          (p.item?.toLowerCase()?.includes(item.toLowerCase()))
        );
        
        if (productInfo) {
          // productInfo contains: { item, product, score, confidence_ok, reason, exact_match }
          const product = productInfo.product;
          if (product) {
            storeResult.items.push({
              name: item,
              price: product.extractedPrice || product.price || product.extracted_price || 0,
              unit: 'each',
              availability: 'in_stock' as const,
              imageUrl: product.thumbnail || product.imageUrl,
              storeUrl: undefined, // Remove URL mapping as requested
              exactMatch: productInfo.exact_match !== false, // Use exact_match from backend
              isAI: false // Backend results are not AI
            });
          }
        } else {
          // Fallback: try to get from itemsMap if productInfo not found
          const itemProducts = itemsMap[item] || [];
          if (itemProducts.length > 0) {
            const product = itemProducts[0];
            storeResult.items.push({
              name: item,
              price: product.extractedPrice || product.price || product.extracted_price || 0,
              unit: 'each',
              availability: 'in_stock' as const,
              imageUrl: product.thumbnail || product.imageUrl,
              storeUrl: undefined,
              exactMatch: false, // No exact_match info available
              isAI: false
            });
          }
        }
      }
      
      // Recalculate total price from items to ensure accuracy
      const calculatedTotal = storeResult.items.reduce((sum, item) => sum + item.price, 0);
      storeResult.totalPrice = calculatedTotal;
      
      results.push(storeResult);
    }
    
    return results;
  }

  /**
   * Get mock data for testing/fallback
   */
  getMockGroceryPrices(
    items: string[],
    address: string,
    zipCode: string
  ): GroceryPriceComparison {
    const mockStores: StorePriceResult[] = [
      {
        store: {
          id: 'mock_walmart',
          name: 'Walmart',
          address: '123 Main St, Plano, TX 75023',
          city: 'Plano',
          state: 'TX',
          zipCode: '75023',
          phone: '(555) 123-4567',
          distance: 0.8,
          rating: 4.2,
          isOpen: true,
          hours: '6 AM - 11 PM',
          website: 'https://walmart.com'
        },
        totalPrice: 0,
        items: items.map(item => ({
          name: item,
          price: Math.random() * 5 + 1, // Random price between $1-6
          unit: 'each',
          availability: 'in_stock' as const
        })),
        savings: 0,
        isBestDeal: false
      },
      {
        store: {
          id: 'mock_target',
          name: 'Target',
          address: '456 Oak Ave, Plano, TX 75023',
          city: 'Plano',
          state: 'TX',
          zipCode: '75023',
          phone: '(555) 234-5678',
          distance: 1.2,
          rating: 4.0,
          isOpen: true,
          hours: '8 AM - 10 PM',
          website: 'https://target.com'
        },
        totalPrice: 0,
        items: items.map(item => ({
          name: item,
          price: Math.random() * 5 + 1.5, // Slightly higher prices
          unit: 'each',
          availability: 'in_stock' as const
        })),
        savings: 0,
        isBestDeal: false
      },
      {
        store: {
          id: 'mock_kroger',
          name: 'Kroger',
          address: '789 Pine St, Plano, TX 75023',
          city: 'Plano',
          state: 'TX',
          zipCode: '75023',
          phone: '(555) 345-6789',
          distance: 1.5,
          rating: 4.1,
          isOpen: true,
          hours: '6 AM - 12 AM',
          website: 'https://kroger.com'
        },
        totalPrice: 0,
        items: items.map(item => ({
          name: item,
          price: Math.random() * 5 + 2, // Higher prices
          unit: 'each',
          availability: 'in_stock' as const
        })),
        savings: 0,
        isBestDeal: false
      }
    ];

    // Calculate total prices
    mockStores.forEach(store => {
      store.totalPrice = store.items.reduce((sum, item) => sum + item.price, 0);
    });

    // Sort by total price
    mockStores.sort((a, b) => a.totalPrice - b.totalPrice);

    const cheapestPrice = mockStores[0].totalPrice;
    const mostExpensivePrice = mockStores[mockStores.length - 1].totalPrice;

    // Update savings and best deal flags
    mockStores.forEach((store, index) => {
      store.savings = mostExpensivePrice - store.totalPrice;
      store.isBestDeal = index === 0;
    });

    // Separate stores into major and local categories
    const { majorStores, localStores } = this.separateStoresByCategory(mockStores.map(store => store.store.name));
    const majorStoreResults = mockStores.filter(store => majorStores.includes(store.store.name));
    const localStoreResults = mockStores.filter(store => localStores.includes(store.store.name));

    return {
      location: { address, zipCode },
      items,
      stores: mockStores,
      majorStores: majorStoreResults,
      localStores: localStoreResults,
      totalItems: items.length,
      cheapestStore: mockStores[0].store.name,
      totalSavings: mostExpensivePrice - cheapestPrice
    };
  }
}

export const groceryPriceService = GroceryPriceService.getInstance();