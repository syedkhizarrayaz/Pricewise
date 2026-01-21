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

export class HasDataService {
  private readonly API_KEY = process.env.HASDATA_API_KEY || '';
  private readonly BASE_URL = 'https://api.hasdata.com/scrape/google/shopping';
  
  constructor() {
    if (!this.API_KEY) {
      console.warn('⚠️ [HasData] HASDATA_API_KEY not found in environment variables. Please set it in the .env file at project root.');
    }
  }

  async searchProduct(params: HasDataSearchParams): Promise<{ results: HasDataResult[], requestMetadata: any }> {
    try {
      console.log('🔍 [HasData] Searching for:', params.product, 'near', params.address, params.zipCode);
      
      const location = this.formatLocationForAPI(params.address, params.zipCode);
      
      // Remove country and ensure no trailing commas or zip codes
      // Handle cases where location might already have "USA" at the end
      let locationWithoutCountry = location
        .replace(/,?\s*USA\s*,?\s*USA$/i, ', USA') // Remove duplicate USA
        .replace(/,?\s*USA?$/i, '') // Remove single USA
        .replace(/,?\s*United States$/i, '')
        .trim();
      
      // Remove any zip codes that might have been left behind (e.g., "City, ST 75074")
      locationWithoutCountry = locationWithoutCountry.replace(/\s+\d{5}(-\d{4})?$/, '');
      
      // Clean up any double commas or trailing commas
      locationWithoutCountry = locationWithoutCountry.replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();
      
      // Extract zip code from address or params
      let zipCode = params.zipCode?.trim() || '';
      if (!zipCode && params.address) {
        const zipMatch = params.address.match(/\b\d{5}(-\d{4})?\b/);
        if (zipMatch) {
          zipCode = zipMatch[0];
        }
      }
      
      // First API call: without zip code in query
      const queryWithoutZip = `${params.product} near ${locationWithoutCountry}`;
      
      console.log('📍 [HasData] Formatted location:', location);
      console.log('📍 [HasData] Query location (without zip):', locationWithoutCountry);
      console.log('🔍 [HasData] First API request (without zip):', JSON.stringify({
        deviceType: 'desktop',
        location: location,
        q: queryWithoutZip
      }));
      
      const options1 = {
        method: 'GET',
        url: this.BASE_URL,
        params: {
          q: queryWithoutZip,
          location: location,
          deviceType: 'desktop'
        },
        headers: {
          'x-api-key': this.API_KEY,
          'Content-Type': 'application/json'
        }
      };

      let allResults: any[] = [];
      let requestMetadata: any = null;
      
      try {
        const { data: data1 } = await axios.request(options1);
        console.log('✅ [HasData] First API response received:', data1.shoppingResults?.length || 0, 'results');
        
        if (data1.shoppingResults && data1.shoppingResults.length > 0) {
          allResults = [...data1.shoppingResults];
          requestMetadata = data1.requestMetadata;
        }
      } catch (error: any) {
        console.error('❌ [HasData] First API call error:', error.message);
      }
      
      // Second API call: with zip code in query (if zip code is available)
      if (zipCode) {
        const queryWithZip = `${params.product} near ${locationWithoutCountry} ${zipCode}`;
        
        console.log('🔍 [HasData] Second API request (with zip):', JSON.stringify({
          deviceType: 'desktop',
          location: location,
          q: queryWithZip
        }));
        
        const options2 = {
          method: 'GET',
          url: this.BASE_URL,
          params: {
            q: queryWithZip,
            location: location,
            deviceType: 'desktop'
          },
          headers: {
            'x-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          }
        };

        try {
          const { data: data2 } = await axios.request(options2);
          console.log('✅ [HasData] Second API response received:', data2.shoppingResults?.length || 0, 'results');
          
          if (data2.shoppingResults && data2.shoppingResults.length > 0) {
            // Combine results, avoiding duplicates by title and source
            const existingKeys = new Set(
              allResults.map(r => `${r.title?.toLowerCase()}_${r.source?.toLowerCase()}`)
            );
            
            for (const result of data2.shoppingResults) {
              const key = `${result.title?.toLowerCase()}_${result.source?.toLowerCase()}`;
              if (!existingKeys.has(key)) {
                allResults.push(result);
                existingKeys.add(key);
              }
            }
            
            // Use metadata from second call if first didn't have it
            if (!requestMetadata && data2.requestMetadata) {
              requestMetadata = data2.requestMetadata;
            }
          }
        } catch (error: any) {
          console.error('❌ [HasData] Second API call error:', error.message);
        }
      }

      console.log('✅ [HasData] Combined results:', allResults.length, 'total unique results');

      if (allResults.length === 0) {
        console.log('⚠️ [HasData] No results found from either call');
        return { results: [], requestMetadata: requestMetadata };
      }

      return { 
        results: allResults, 
        requestMetadata: requestMetadata 
      };

    } catch (error: any) {
      console.error('❌ [HasData] API error:', error.message);
      return { results: [], requestMetadata: null };
    }
  }

  private formatLocationForAPI(address: string, zipCode: string): string {
    try {
      // Remove zip code from address if it exists (to avoid duplicates)
      // Handle formats like "City, ST 12345" or "City, ST, 12345" or "City, ST 12345, USA"
      let cleanAddress = address.trim();
      
      // Remove zip code patterns from the end of address
      // Matches: " 75074", ", 75074", " 75074-1234", etc.
      cleanAddress = cleanAddress.replace(/[,]?\s*\d{5}(-\d{4})?(\s*,?\s*USA?)?$/i, '');
      
      const addressParts = cleanAddress.split(',').map(part => part.trim()).filter(part => part.length > 0);
      
      if (addressParts.length >= 2) {
        // Find city and state
        // Usually format: "Street", "City", "ST" or "Street", "City ST"
        let city = '';
        let state = '';
        
        // Try to find state abbreviation (2 uppercase letters)
        const stateMatch = cleanAddress.match(/,?\s*([A-Z]{2})\s*,?/);
        if (stateMatch) {
          state = stateMatch[1];
          // Extract city (usually before state)
          const beforeState = cleanAddress.substring(0, stateMatch.index || 0);
          const cityParts = beforeState.split(',').map(p => p.trim());
          city = cityParts[cityParts.length - 1] || addressParts[0];
        } else {
          // Fallback: assume last part is state or use addressParts
          if (addressParts.length >= 2) {
            city = addressParts[addressParts.length - 2];
            state = addressParts[addressParts.length - 1].replace(/[^A-Z]/g, '').substring(0, 2);
          }
        }
        
        // Validate state is 2 uppercase letters
        if (!state || state.length !== 2 || !/^[A-Z]{2}$/.test(state)) {
          // Fallback: try to extract from original address
          const fallbackMatch = address.match(/\b([A-Z]{2})\b/);
          if (fallbackMatch) {
            state = fallbackMatch[1];
          } else {
            state = 'TX'; // Default fallback
          }
        }
        
        // Use city from addressParts if not found
        if (!city || city.length === 0) {
          city = addressParts[0] || 'Unknown';
        }
        
        // Clean up - ensure no duplicate "USA" and proper formatting
        let formatted = `${city}, ${state}, USA`;
        // Remove any duplicate "USA" that might have been in the original (handle multiple cases)
        formatted = formatted.replace(/,\s*USA\s*,?\s*USA\s*,?\s*USA/gi, ', USA'); // Remove triple or more
        formatted = formatted.replace(/,\s*USA\s*,?\s*USA/gi, ', USA'); // Remove double
        formatted = formatted.trim();
        
        // Final check: if it still has duplicate, replace it one more time
        if (formatted.match(/USA.*USA/)) {
          formatted = formatted.replace(/USA\s*,?\s*USA/gi, 'USA').trim();
        }
        
        return formatted;
      } else {
        // Try regex pattern matching
        const cityMatch = address.match(/([A-Za-z\s]+),\s*([A-Z]{2})\b/);
        if (cityMatch) {
          return `${cityMatch[1].trim()}, ${cityMatch[2]}, USA`;
        }
      }
      
      return 'Sachse, TX, USA';
    } catch (error) {
      console.log('⚠️ [HasData] Location formatting failed:', error);
      return 'Sachse, TX, USA';
    }
  }

  filterStoresByLists(results: HasDataResult[], majorStores: string[], nearbyStores: string[]): HasDataResult[] {
    const allTargetStores = [...majorStores, ...nearbyStores];
    const selectedStores: HasDataResult[] = [];
    const usedStores = new Set<string>();

    for (const result of results) {
      const storeName = result.source;
      const matchingStore = allTargetStores.find(targetStore => 
        storeName.toLowerCase().includes(targetStore.toLowerCase()) ||
        targetStore.toLowerCase().includes(storeName.toLowerCase())
      );
      
      if (matchingStore && !usedStores.has(storeName)) {
        selectedStores.push(result);
        usedStores.add(storeName);
      }
    }

    return selectedStores;
  }
}

export const hasDataService = new HasDataService();

