import axios from 'axios';
import { getApiConfig } from '@/config/api';

export interface GooglePlace {
  place_id: string;
  name: string;
  vicinity: string;
  rating: number;
  user_ratings_total: number;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
}

export interface GooglePlacesResponse {
  results: GooglePlace[];
  status: string;
}

// New API interfaces
export interface NewGooglePlace {
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  priceLevel?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface NewGooglePlacesResponse {
  places: NewGooglePlace[];
}

export interface StoreWithAddress {
  name: string;
  address: string;
  priceLevel?: string;
}

class GooglePlacesService {
  private readonly API_KEY: string;
  private readonly BASE_URL = 'https://maps.googleapis.com/maps/api/place';
  private readonly NEW_API_URL = 'https://places.googleapis.com/v1/places:searchText';

  constructor() {
    try {
      this.API_KEY = getApiConfig().GOOGLE_PLACES_API_KEY;
      console.log('🔑 [GooglePlaces] API Key loaded:', this.API_KEY ? `${this.API_KEY.substring(0, 10)}...` : 'NOT_FOUND');
    } catch (error) {
      console.error('❌ [GooglePlaces] Failed to load API key:', error);
      this.API_KEY = '';
    }
  }

  /**
   * Get major grocery store chains in a state/country
   */
  async getMajorStoresInState(state: string, country: string = 'US'): Promise<string[]> {
    try {
      // Check if API key is available
      console.log('🔍 [GooglePlaces] Checking API key:', {
        hasKey: !!this.API_KEY,
        keyStart: this.API_KEY ? this.API_KEY.substring(0, 10) : 'NONE',
        isValid: this.API_KEY && this.API_KEY.startsWith('AIzaSy')
      });
      
      if (!this.API_KEY || this.API_KEY.startsWith('AIzaSy') === false) {
        console.log('⚠️ [GooglePlaces] API key not configured, returning null for AI fallback');
        console.log('🔍 [GooglePlaces] API key details:', {
          key: this.API_KEY,
          length: this.API_KEY ? this.API_KEY.length : 0,
          startsWithAIzaSy: this.API_KEY ? this.API_KEY.startsWith('AIzaSy') : false
        });
        return [];
      }

      console.log(`🏪 [GooglePlaces] Getting major stores in ${state}, ${country}`);
      
      // Use new API directly (avoids CORS issues)
      return await this.getMajorStoresInStateNewAPI(state, country);
      
    } catch (error) {
      console.error('❌ [GooglePlaces] Error getting major stores:', error);
      return []; // Return empty array to trigger AI fallback
    }
  }

  /**
   * Get nearby grocery stores from specific address
   */
  async getNearbyStores(address: string, radius: number = 5000): Promise<string[]> {
    try {
      // Check if API key is available
      console.log('🔍 [GooglePlaces] Checking API key for nearby stores:', {
        hasKey: !!this.API_KEY,
        keyStart: this.API_KEY ? this.API_KEY.substring(0, 10) : 'NONE',
        isValid: this.API_KEY && this.API_KEY.startsWith('AIzaSy')
      });
      
      if (!this.API_KEY || this.API_KEY.startsWith('AIzaSy') === false) {
        console.log('⚠️ [GooglePlaces] API key not configured, returning null for AI fallback');
        return [];
      }

      console.log(`🏪 [GooglePlaces] Getting nearby stores from ${address}`);
      
      // Use new API directly instead of geocoding (avoids CORS issues)
      const radiusInMiles = Math.round(radius / 1609.34); // Convert meters to miles
      return await this.searchGroceryStoresNewAPI(address, radiusInMiles);
      
    } catch (error) {
      console.error('❌ [GooglePlaces] Error getting nearby stores:', error);
      return []; // Return empty array to trigger AI fallback
    }
  }

  /**
   * Search for places by text query
   */
  private async searchPlaces(query: string): Promise<GooglePlacesResponse> {
    const url = `${this.BASE_URL}/textsearch/json`;
    const params = {
      query,
      key: this.API_KEY,
      type: 'grocery_or_supermarket'
    };
    
    const response = await axios.get(url, { params });
    return response.data;
  }

  /**
   * Search for nearby places
   */
  private async searchNearby(lat: number, lng: number, radius: number, type: string): Promise<GooglePlacesResponse> {
    const url = `${this.BASE_URL}/nearbysearch/json`;
    const params = {
      location: `${lat},${lng}`,
      radius,
      type,
      key: this.API_KEY
    };
    
    const response = await axios.get(url, { params });
    return response.data;
  }

  /**
   * Geocode an address to get coordinates
   */
  private async geocodeAddress(address: string): Promise<{lat: number, lng: number} | null> {
    try {
      const url = `${this.BASE_URL}/geocode/json`;
      const params = {
        address,
        key: this.API_KEY
      };
      
      const response = await axios.get(url, { params });
      
      if (response.data.results && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ [GooglePlaces] Geocoding error:', error);
      return null;
    }
  }

  /**
   * Search for grocery stores using the new Places API (searchText endpoint)
   */
  async searchGroceryStoresNewAPI(address: string, radius: number = 5): Promise<string[]> {
    try {
      // Check if API key is available
      if (!this.API_KEY || this.API_KEY.startsWith('AIzaSy') === false) {
        console.log('⚠️ [GooglePlaces] API key not configured, returning empty array for AI fallback');
        return [];
      }

      console.log(`🏪 [GooglePlaces] Searching grocery stores near ${address} using new API`);
      
      const textQuery = `grocery stores near ${address} in ${radius} miles`;
      
      const requestBody = {
        textQuery: textQuery,
        maxResultCount: 20,
        languageCode: 'en',
        regionCode: 'US'
      };

      const headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.priceLevel'
      };

      const response = await axios.post(this.NEW_API_URL, requestBody, { headers });
      
      if (response.data.places && response.data.places.length > 0) {
        console.log('🔍 [GooglePlaces] Raw API results (names only):', response.data.places.length, 'places found');
        response.data.places.forEach((place: NewGooglePlace, index: number) => {
          console.log(`  ${index + 1}. ${place.displayName.text} - ${place.formattedAddress}`);
        });
        
        const filteredStores = response.data.places
          .filter((place: NewGooglePlace) => {
            // Filter out the user's input address (be more specific - look for street address, not city/state)
            const userAddressParts = address.toLowerCase().split(',').map(part => part.trim());
            const isUserAddress = userAddressParts.some(part => {
              // Only check for street address parts (numbers and street names), not city/state
              const isStreetAddress = /^\d+/.test(part) || part.includes('street') || part.includes('ave') || part.includes('rd') || part.includes('pkwy') || part.includes('blvd') || part.includes('dr') || part.includes('st');
              const matches = isStreetAddress && part.length > 3 && place.formattedAddress.toLowerCase().includes(part);
              if (matches) {
                console.log(`🔍 [GooglePlaces] User address part "${part}" found in store address "${place.formattedAddress}"`);
              }
              return matches;
            });
            
            // Check if it's a grocery store (more flexible matching)
            // COMMENTED OUT: Static store filtering - let all stores through for better coverage
            // const storeName = place.displayName.text.toLowerCase();
            // const isGroceryStore = storeName.includes('grocery') || 
            //                      storeName.includes('market') ||
            //                      storeName.includes('supermarket') ||
            //                      storeName.includes('food') ||
            //                      storeName.includes('walmart') ||
            //                      storeName.includes('target') ||
            //                      storeName.includes('kroger') ||
            //                      storeName.includes('safeway') ||
            //                      storeName.includes('whole foods') ||
            //                      storeName.includes('costco') ||
            //                      storeName.includes('sam\'s club') ||
            //                      storeName.includes('h-e-b') ||
            //                      storeName.includes('publix') ||
            //                      storeName.includes('wegmans') ||
            //                      storeName.includes('tom thumb') ||
            //                      storeName.includes('albertsons') ||
            //                      storeName.includes('food lion') ||
            //                      storeName.includes('giant') ||
            //                      storeName.includes('stop & shop') ||
            //                      storeName.includes('aldi') ||
            //                      storeName.includes('sprouts') ||
            //                      storeName.includes('7-eleven') ||
            //                      storeName.includes('dollar general') ||
            //                      storeName.includes('spec\'s') ||
            //                      storeName.includes('halal') ||
            //                      storeName.includes('mecca');
            
            // Include all stores except user's address
            const shouldInclude = !isUserAddress;
            console.log(`🔍 [GooglePlaces] Filtering: ${place.displayName.text} - isUserAddress: ${isUserAddress}, include: ${shouldInclude}`);
            
            return shouldInclude;
          });
        
        const storeNames = filteredStores.map((place: NewGooglePlace) => place.displayName.text);
        console.log(`✅ [GooglePlaces] Found ${storeNames.length} stores using new API:`, storeNames);
        return storeNames;
      }
      
      console.log('⚠️ [GooglePlaces] No stores found using new API');
      return [];
      
    } catch (error: any) {
      console.error('❌ [GooglePlaces] Error with new API:', error);
      return []; // Return empty array to trigger AI fallback
    }
  }

  /**
   * Get nearby grocery stores using the new API (wrapper method)
   */
  async getNearbyStoresNewAPI(address: string, radius: number = 5): Promise<string[]> {
    return this.searchGroceryStoresNewAPI(address, radius);
  }

  /**
   * Search for grocery stores with addresses using the new Places API
   */
  async searchGroceryStoresWithAddressesNewAPI(address: string, zipCode?: string, radius: number = 5): Promise<StoreWithAddress[]> {
    try {
      // Check if API key is available
      if (!this.API_KEY || this.API_KEY.startsWith('AIzaSy') === false) {
        console.log('⚠️ [GooglePlaces] API key not configured, returning empty array for AI fallback');
        return [];
      }

      console.log(`🏪 [GooglePlaces] Searching grocery stores with addresses near ${address} using new API`);
      
      // Format address for Google Places API: "grocery stores nearest [full address] in X miles"
      // Try to simplify the address format to match the working curl command
      let simplifiedAddress = address;
      if (address.includes(',')) {
        // Extract just the street and city part, remove the full address
        const parts = address.split(',');
        if (parts.length >= 2) {
          // Remove house number and take just street name and city: "Whistle Ln, Sachse"
          const streetPart = parts[0].trim();
          const streetName = streetPart.replace(/^\d+\s+/, ''); // Remove house number
          simplifiedAddress = `${streetName}, ${parts[1].trim()}`;
        }
      }
      const fullAddress = zipCode ? `${simplifiedAddress} ${zipCode}, USA` : simplifiedAddress;
      const textQuery = `grocery stores nearest ${fullAddress} in ${radius} miles`;
      console.log(`🔍 [GooglePlaces] Text query: ${textQuery}`);
      
      const requestBody = {
        textQuery: textQuery,
        maxResultCount: 20,
        languageCode: 'en',
        regionCode: 'US'
      };

      const headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.priceLevel'
      };

      const response = await axios.post(this.NEW_API_URL, requestBody, { headers });
      
      if (response.data.places && response.data.places.length > 0) {
        console.log('🔍 [GooglePlaces] Raw API results:', response.data.places.length, 'places found');
        response.data.places.forEach((place: NewGooglePlace, index: number) => {
          console.log(`  ${index + 1}. ${place.displayName.text} - ${place.formattedAddress}`);
        });
        
        const storesWithAddresses = response.data.places
          .map((place: NewGooglePlace) => ({
            name: place.displayName.text,
            address: place.formattedAddress,
            priceLevel: place.priceLevel
          }))
          .filter((store: StoreWithAddress) => {
            // Filter out the user's input address (be more specific - look for street address, not city/state)
            const userAddressParts = address.toLowerCase().split(',').map(part => part.trim());
            const isUserAddress = userAddressParts.some(part => {
              // Only check for street address parts (numbers and street names), not city/state
              const isStreetAddress = /^\d+/.test(part) || part.includes('street') || part.includes('ave') || part.includes('rd') || part.includes('pkwy') || part.includes('blvd') || part.includes('dr') || part.includes('st');
              const matches = isStreetAddress && part.length > 3 && store.address.toLowerCase().includes(part);
              if (matches) {
                console.log(`🔍 [GooglePlaces] User address part "${part}" found in store address "${store.address}"`);
              }
              return matches;
            });
            
            // Check if it's a grocery store (more flexible matching)
            // COMMENTED OUT: Static store filtering - let all stores through for better coverage
            // const storeName = store.name.toLowerCase();
            // const isGroceryStore = storeName.includes('grocery') || 
            //                      storeName.includes('market') ||
            //                      storeName.includes('supermarket') ||
            //                      storeName.includes('food') ||
            //                      storeName.includes('walmart') ||
            //                      storeName.includes('target') ||
            //                      storeName.includes('kroger') ||
            //                      storeName.includes('safeway') ||
            //                      storeName.includes('whole foods') ||
            //                      storeName.includes('costco') ||
            //                      storeName.includes('sam\'s club') ||
            //                      storeName.includes('h-e-b') ||
            //                      storeName.includes('publix') ||
            //                      storeName.includes('wegmans') ||
            //                      storeName.includes('tom thumb') ||
            //                      storeName.includes('albertsons') ||
            //                      storeName.includes('food lion') ||
            //                      storeName.includes('giant') ||
            //                      storeName.includes('stop & shop') ||
            //                      storeName.includes('aldi') ||
            //                      storeName.includes('sprouts') ||
            //                      storeName.includes('7-eleven') ||
            //                      storeName.includes('dollar general') ||
            //                      storeName.includes('spec\'s') ||
            //                      storeName.includes('halal') ||
            //                      storeName.includes('mecca');
            
            // Include all stores except user's address
            const shouldInclude = !isUserAddress;
            console.log(`🔍 [GooglePlaces] Filtering: ${store.name} - isUserAddress: ${isUserAddress}, include: ${shouldInclude}`);
            
            return shouldInclude;
          });
        
        console.log(`✅ [GooglePlaces] Found ${storesWithAddresses.length} stores with addresses using new API:`, storesWithAddresses);
        return storesWithAddresses;
      }
      
      console.log('⚠️ [GooglePlaces] No stores found using new API');
      return [];
      
    } catch (error: any) {
      console.error('❌ [GooglePlaces] Error with new API:', error);
      return []; // Return empty array to trigger AI fallback
    }
  }

  /**
   * Get nearby grocery stores with addresses using the new API (wrapper method)
   */
  async getNearbyStoresWithAddressesNewAPI(address: string, zipCode?: string, radius: number = 5): Promise<StoreWithAddress[]> {
    return this.searchGroceryStoresWithAddressesNewAPI(address, zipCode, radius);
  }

  /**
   * Load Google Maps JavaScript API if not already loaded
   */
  private async loadGoogleMapsAPI(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    // Check if Google Maps is already loaded
    if ((window as any).google?.maps?.importLibrary) {
      return true;
    }

    try {
      console.log('🗺️ [GooglePlaces] Loading Google Maps JavaScript API...');
      
      // Check if script is already being loaded
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        console.log('🗺️ [GooglePlaces] Google Maps script already exists, waiting for it to load...');
        return new Promise((resolve) => {
          const checkLoaded = () => {
            if ((window as any).google?.maps?.importLibrary) {
              console.log('✅ [GooglePlaces] Google Maps JavaScript API loaded successfully');
              resolve(true);
            } else {
              setTimeout(checkLoaded, 100);
            }
          };
          checkLoaded();
        });
      }
      
      // Load Google Maps JavaScript API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      return new Promise((resolve) => {
        script.onload = () => {
          console.log('✅ [GooglePlaces] Google Maps JavaScript API script loaded, waiting for initialization...');
          // Wait a bit for the API to be fully initialized
          setTimeout(() => {
            if ((window as any).google?.maps?.importLibrary) {
              console.log('✅ [GooglePlaces] Google Maps JavaScript API fully loaded');
              resolve(true);
            } else {
              console.log('⚠️ [GooglePlaces] Google Maps JavaScript API script loaded but importLibrary not available');
              resolve(false);
            }
          }, 1000);
        };
        script.onerror = () => {
          console.log('❌ [GooglePlaces] Failed to load Google Maps JavaScript API');
          resolve(false);
        };
        document.head.appendChild(script);
      });
    } catch (error) {
      console.error('❌ [GooglePlaces] Error loading Google Maps JavaScript API:', error);
      return false;
    }
  }

  /**
   * Search for grocery stores using Google Maps JavaScript API (same as Stores tab)
   */
  async searchGroceryStoresWithJavaScriptAPI(address: string, radius: number = 5): Promise<StoreWithAddress[]> {
    try {
      // Check if API key is available
      if (!this.API_KEY || this.API_KEY.startsWith('AIzaSy') === false) {
        console.log('⚠️ [GooglePlaces] API key not configured, returning empty array for AI fallback');
        return [];
      }

      console.log(`🏪 [GooglePlaces] Searching grocery stores near ${address} using JavaScript API`);
      
      // Load Google Maps JavaScript API if not already available
      if (typeof window === 'undefined' || !(window as any).google?.maps?.importLibrary) {
        console.log('🗺️ [GooglePlaces] Google Maps JavaScript API not available, loading...');
        const loaded = await this.loadGoogleMapsAPI();
        if (!loaded) {
          console.log('⚠️ [GooglePlaces] Failed to load Google Maps JavaScript API, falling back to REST API');
          return this.searchGroceryStoresWithAddressesNewAPI(address, undefined, radius);
        }
      }

      try {
        const { Place } = await (window as any).google.maps.importLibrary("places");
        
        const request = {
          textQuery: `grocery stores near ${address}`,
          fields: ['displayName', 'location', 'businessStatus', 'formattedAddress'],
          includedType: 'grocery_store',
          useStrictTypeFiltering: true,
          isOpenNow: true,
          language: 'en-US',
          maxResultCount: 20,
          minRating: 1,
          region: 'us',
        };

        console.log('🗺️ [GooglePlaces] Searching for grocery stores near:', address);
        const { places } = await Place.searchByText(request);

        if (places && places.length > 0) {
          console.log('🔍 [GooglePlaces] Raw JavaScript API results:', places.length, 'places found');
          places.forEach((place: any, index: number) => {
            console.log(`  ${index + 1}. ${place.displayName?.text} - ${place.formattedAddress}`);
          });

          const storesWithAddresses = places.map((place: any) => ({
            name: place.displayName?.text || 'Unknown Store',
            address: place.formattedAddress || 'Unknown Address',
            priceLevel: undefined // JavaScript API doesn't provide price level
          }));

          console.log(`✅ [GooglePlaces] Found ${storesWithAddresses.length} stores using JavaScript API:`, storesWithAddresses);
          return storesWithAddresses;
        }

        console.log('⚠️ [GooglePlaces] No stores found using JavaScript API');
        return [];
      } catch (error) {
        console.error('❌ [GooglePlaces] JavaScript API error:', error);
        // Fallback to REST API
        return this.searchGroceryStoresWithAddressesNewAPI(address, undefined, radius);
      }
    } catch (error) {
      console.error('❌ [GooglePlaces] Error with JavaScript API:', error);
      return []; // Return empty array to trigger AI fallback
    }
  }

  /**
   * Get major stores in state using the new API
   */
  async getMajorStoresInStateNewAPI(state: string, country: string = 'US'): Promise<string[]> {
    try {
      // Check if API key is available
      if (!this.API_KEY || this.API_KEY.startsWith('AIzaSy') === false) {
        console.log('⚠️ [GooglePlaces] API key not configured, returning empty array for AI fallback');
        return [];
      }

      console.log(`🏪 [GooglePlaces] Getting major stores in ${state} using new API`);
      
      const majorChains = [
        'Walmart', 'Target', 'Kroger', 'Safeway', 'Whole Foods', 'Costco', 
        'Sam\'s Club', 'H-E-B', 'Publix', 'Wegmans', 'Giant Eagle', 'Stop & Shop'
      ];
      
      const foundStores: string[] = [];
      
      for (const chain of majorChains) {
        try {
          const textQuery = `${chain} grocery store ${state} ${country}`;
          
          const requestBody = {
            textQuery: textQuery
          };

          const headers = {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress'
          };

          const response = await axios.post(this.NEW_API_URL, requestBody, { headers });
          
          if (response.data.places && response.data.places.length > 0) {
            // Check if any result is actually in the target state
            const stateResults = response.data.places.filter((place: NewGooglePlace) => 
              place.formattedAddress.toLowerCase().includes(state.toLowerCase()) ||
              place.displayName.text.toLowerCase().includes(state.toLowerCase())
            );
            
            if (stateResults.length > 0) {
              foundStores.push(chain);
              console.log(`✅ [GooglePlaces] Found ${chain} in ${state} using new API`);
            }
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.log(`⚠️ [GooglePlaces] Error searching for ${chain} with new API:`, error);
        }
      }
      
      console.log(`🏪 [GooglePlaces] Major stores found in ${state} using new API:`, foundStores);
      return foundStores.slice(0, 5); // Return top 5
      
    } catch (error) {
      console.error('❌ [GooglePlaces] Error getting major stores with new API:', error);
      return []; // Return empty array to trigger AI fallback
    }
  }
}

export const googlePlacesService = new GooglePlacesService();
