import { googlePlacesService } from './googlePlacesService';
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

  private constructor() {
    // All API keys and logic are handled by backend
    // Frontend only communicates with backend API
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
      
      // Step 2: If Google Places API failed or returned no results, log warning
      // Backend will handle store discovery if needed
      if (nearbyStoresWithAddresses.length === 0) {
        console.log('⚠️ [GroceryPrice] Google Places API returned no stores');
        console.log('📡 [GroceryPrice] Backend will handle store discovery if needed');
      } else {
        console.log('✅ [GroceryPrice] Using Google Places API results:', nearbyStores);
      }
      
      // Step 3: Call Backend API for all product search and matching
      // Backend handles: HasData API, Python service, and all logic
      let hasDataResults: StorePriceResult[] = [];
      
      console.log('📡 [GroceryPrice] Calling backend API for product search');
      const backendRequest: GrocerySearchRequest = {
        items: items,
        address: address,
        zipCode: zipCode,
        latitude: latitude,
        longitude: longitude,
        nearbyStores: nearbyStores
      };
      
      try {
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
      } catch (error: any) {
        console.error('❌ [GroceryPrice] Backend API error:', error.message);
        // No fallback - backend must handle everything
        throw new Error(`Failed to get grocery prices: ${error.message || 'Backend API unavailable'}`);
      }
      
      // Backend handles all store discovery and pricing
      // No need for frontend to handle AI pricing - backend does it all
      const allResults = hasDataResults;
      
      // Process and format the combined results
      const processedResults = this.processCombinedResults(allResults, items, address, zipCode);
      
      console.log('🛒 [GroceryPrice] Final results:', {
        totalStores: processedResults.stores.length,
        hasDataStores: hasDataResults.length,
        cheapestStore: processedResults.cheapestStore
      });

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
      console.error('🛒 [GroceryPrice] Error fetching grocery prices:', error);
      
      // No fallback - rethrow error so UI can handle it
      // Backend must be available for the app to work
      throw error;
    }
  }

  // REMOVED: searchWithHasData - All HasData and Python service calls are handled by backend

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