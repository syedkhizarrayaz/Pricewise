import axios from 'axios';

export interface HasDataSearchParams {
  product: string;
  address: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}

export interface HasDataResult {
  position: number;
  title: string;
  productId: string;
  productLink: string;
  price: string;
  extractedPrice: number;
  source: string;
  reviews?: number;
  rating?: number;
  delivery?: string;
  extensions?: string[];
  thumbnail?: string;
}

export interface HasDataResponse {
  requestMetadata: {
    id: string;
    status: string;
    html: string;
    url: string;
  };
  shoppingResults: HasDataResult[];
  pagination?: {
    next: string;
  };
}

class HasDataService {
  private readonly API_KEY = '9e03138f-d924-4e01-bc1a-91f57cd12543';
  private readonly BASE_URL = 'https://api.hasdata.com/scrape/google/shopping';

  /**
   * Search for products using HasData API
   */
  async searchProduct(params: HasDataSearchParams): Promise<{ results: HasDataResult[], requestMetadata: any }> {
    try {
      console.log('🔍 [HasData] Searching for:', params.product, 'near', params.address, params.zipCode);
      
      // Format location as "City, State, Country" instead of using UULE
      const location = this.formatLocationForAPI(params.address, params.zipCode);
      
      // Format query to include "near City, State" for better location targeting
      // Remove country from location for cleaner search
      const locationWithoutCountry = location.replace(/, USA$/, '').replace(/, United States$/, '');
      const queryWithLocation = `${params.product} near ${locationWithoutCountry}`;
      
      const options = {
        method: 'GET',
        url: this.BASE_URL,
        params: {
          q: queryWithLocation,
          location: location,
          deviceType: 'desktop'
        },
        headers: {
          'x-api-key': this.API_KEY,
          'Content-Type': 'application/json'
        }
      };

      console.log('🔍 [HasData] API request:', options.params);

      const { data } = await axios.request(options);
      console.log('✅ [HasData] API response received:', data.shoppingResults?.length || 0, 'results');
      console.log('🔗 [HasData] RequestMetadata URL:', data.requestMetadata?.url);

      if (!data.shoppingResults || data.shoppingResults.length === 0) {
        console.log('⚠️ [HasData] No results found');
        return { results: [], requestMetadata: data.requestMetadata };
      }

      // COMMENTED OUT: Process results to select cheapest price for each store
      // This logic can get wrong product prices sometimes, so we'll let Python service handle matching
      // const processedResults = this.selectCheapestPricePerStore(data.shoppingResults);
      // console.log('🏪 [HasData] Processed results (cheapest per store):', processedResults.length, 'stores');
      
      // Use all results without cheapest price filtering - let Python service handle matching
      const processedResults = data.shoppingResults;
      console.log('🏪 [HasData] Using all results (no cheapest filtering):', processedResults.length, 'results');

      return { 
        results: processedResults, 
        requestMetadata: data.requestMetadata 
      };

    } catch (error) {
      console.error('❌ [HasData] API error:', error);
      return { results: [], requestMetadata: null };
    }
  }

  /**
   * Select the cheapest price for each store when multiple prices are available
   */
  private selectCheapestPricePerStore(results: HasDataResult[]): HasDataResult[] {
    const storeGroups = new Map<string, HasDataResult[]>();
    
    // Group results by store name
    for (const result of results) {
      const storeName = result.source;
      if (!storeGroups.has(storeName)) {
        storeGroups.set(storeName, []);
      }
      storeGroups.get(storeName)!.push(result);
    }
    
    const cheapestResults: HasDataResult[] = [];
    
    // For each store, select the cheapest price
    for (const [storeName, storeResults] of storeGroups) {
      if (storeResults.length === 1) {
        // Only one result for this store, use it
        cheapestResults.push(storeResults[0]);
      } else {
        // Multiple results for this store, find the cheapest
        const cheapest = storeResults.reduce((min, current) => 
          current.extractedPrice < min.extractedPrice ? current : min
        );
        console.log(`💰 [HasData] Store "${storeName}" has ${storeResults.length} prices, selected cheapest: $${cheapest.extractedPrice}`);
        cheapestResults.push(cheapest);
      }
    }
    
    return cheapestResults;
  }

  /**
   * Format location as "City, State, Country" for HasData API
   * Extracts city, state, country from full address like "Whistle Ln, Sachse, TX 75048, USA"
   */
  private formatLocationForAPI(address: string, zipCode: string): string {
    try {
      console.log('🔍 [HasData] Formatting location from address:', address);
      
      // Parse the address to extract city and state
      // Expected format: "Whistle Ln, Sachse, TX 75048, USA" -> "Sachse, TX, USA"
      const addressParts = address.split(',').map(part => part.trim());
      
      if (addressParts.length >= 3) {
        // Extract city and state from the address
        const city = addressParts[1]; // "Sachse"
        const state = addressParts[2]; // "TX 75048"
        
        // Clean state to remove zip code if present
        const cleanState = state.replace(/\d+/g, '').trim(); // Remove numbers, keep "TX"
        
        // Check if there's a country part
        const country = addressParts.length > 3 ? addressParts[3] : 'USA';
        
        // Format as "City, State, Country"
        const formattedLocation = `${city}, ${cleanState}, ${country}`;
        console.log('🔍 [HasData] Formatted location:', formattedLocation);
        return formattedLocation;
      } else {
        // Fallback: try to extract city and state from the full address
        const cityMatch = address.match(/([A-Za-z\s]+),\s*([A-Z]{2})/);
        if (cityMatch) {
          const formattedLocation = `${cityMatch[1].trim()}, ${cityMatch[2]}, USA`;
          console.log('🔍 [HasData] Fallback formatted location:', formattedLocation);
          return formattedLocation;
        }
      }
      
      // Ultimate fallback
      console.log('⚠️ [HasData] Could not parse address, using fallback location');
      return 'Sachse, TX, USA';
      
    } catch (error) {
      console.log('⚠️ [HasData] Location formatting failed:', error);
      return 'Sachse, TX, USA';
    }
  }

  /**
   * Filter results to only include stores from the provided lists
   */
  filterStoresByLists(results: HasDataResult[], majorStores: string[], nearbyStores: string[]): HasDataResult[] {
    const allTargetStores = [...majorStores, ...nearbyStores];
    const selectedStores: HasDataResult[] = [];
    const usedStores = new Set<string>();

    console.log('🏪 [HasData] Filtering stores by lists:', {
      majorStores,
      nearbyStores,
      totalResults: results.length
    });

    // Filter results to only include stores from our target lists
    for (const result of results) {
      const storeName = result.source;
      
      // Check if this store matches any of our target stores
      const matchingStore = allTargetStores.find(targetStore => 
        storeName.toLowerCase().includes(targetStore.toLowerCase()) ||
        targetStore.toLowerCase().includes(storeName.toLowerCase())
      );
      
      if (matchingStore && !usedStores.has(storeName)) {
        selectedStores.push(result);
        usedStores.add(storeName);
        console.log(`✅ [HasData] Selected store: ${storeName} (matches: ${matchingStore})`);
      }
    }

    console.log('🏪 [HasData] Filtered stores:', selectedStores.map(s => s.source));
    return selectedStores;
  }

  /**
   * Convert HasData results to StorePriceResult format
   */
  convertToStorePriceResults(hasDataResults: HasDataResult[], product: string, address: string, zipCode: string, requestMetadataUrl?: string, storeAddresses?: { [storeName: string]: string }): any[] {
    return hasDataResults.map(result => ({
      store: {
        id: `hasdata_${result.source.toLowerCase().replace(/\s+/g, '_')}`,
        name: result.source,
        address: storeAddresses?.[result.source] || this.generateStoreAddress(result.source, address, zipCode),
        city: address.split(',')[0]?.trim() || 'Unknown',
        state: address.split(',')[1]?.trim() || 'Unknown',
        zipCode: zipCode,
        phone: 'Unknown',
        distance: this.extractDistance(result.extensions) || 0,
        rating: result.rating || 0,
        isOpen: true,
        hours: 'Unknown',
        website: requestMetadataUrl || result.productLink,
        imageUrl: result.thumbnail,
      },
      items: [{
        name: product,
        price: result.extractedPrice,
        unit: 'each',
        availability: 'in_stock' as const,
        imageUrl: result.thumbnail,
        storeUrl: requestMetadataUrl || result.productLink,
      }],
      totalPrice: result.extractedPrice,
      savings: 0, // Will be calculated later
      isBestDeal: false, // Will be determined after comparison
    }));
  }

  /**
   * Generate realistic store address based on store name and location
   */
  private generateStoreAddress(storeName: string, userAddress: string, zipCode: string): string {
    const city = userAddress.split(',')[0]?.trim() || 'Unknown City';
    const state = userAddress.split(',')[1]?.trim() || 'Unknown State';
    
    // Generate realistic street addresses for different store types
    const streetNumbers = Math.floor(Math.random() * 9000) + 1000;
    const streetNames = ['Main St', 'Oak Ave', 'Pine St', 'Elm St', 'Maple Dr', 'First St', 'Second Ave'];
    const randomStreet = streetNames[Math.floor(Math.random() * streetNames.length)];
    
    return `${streetNumbers} ${randomStreet}, ${city}, ${state} ${zipCode}`;
  }

  /**
   * Extract distance from extensions array
   */
  private extractDistance(extensions?: string[]): number {
    if (!extensions) return 0;
    
    for (const ext of extensions) {
      const match = ext.match(/(\d+(?:\.\d+)?)\s*mi/);
      if (match) {
        return parseFloat(match[1]);
      }
    }
    return 0;
  }
}

export const hasDataService = new HasDataService();
