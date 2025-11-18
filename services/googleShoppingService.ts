import { StorePriceResult } from '../types';

export interface GoogleShoppingResult {
  product: string;
  price: number;
  store: string;
  storeAddress?: string;
  storeUrl?: string;
  imageUrl?: string;
  availability: 'in_stock' | 'out_of_stock' | 'limited';
}

export interface GoogleShoppingSearchParams {
  product: string;
  address: string;
  zipCode: string;
  radius?: number; // in miles, default 25
}

class GoogleShoppingService {
  private readonly GOOGLE_SHOPPING_BASE_URL = 'https://www.google.com/search';
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  /**
   * Search for a product on Google Shopping with nearby stores
   */
  async searchProductNearby(params: GoogleShoppingSearchParams): Promise<GoogleShoppingResult[]> {
    try {
      const searchUrl = this.buildGoogleShoppingUrl(params);
      console.log('🔍 Google Shopping URL:', searchUrl);
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      if (!response.ok) {
        throw new Error(`Google Shopping request failed: ${response.status}`);
      }

      const html = await response.text();
      return this.parseGoogleShoppingResults(html, params.product);
      
    } catch (error) {
      console.error('❌ Google Shopping search failed:', error);
      return [];
    }
  }

  /**
   * Build Google Shopping URL with nearby search parameters
   */
  private buildGoogleShoppingUrl(params: GoogleShoppingSearchParams): string {
    const { product, address, zipCode, radius = 25 } = params;
    
    // Encode the product name for URL
    const encodedProduct = encodeURIComponent(product);
    const encodedLocation = encodeURIComponent(`${address}, ${zipCode}`);
    
    // Google Shopping nearby search parameters
    const searchParams = new URLSearchParams({
      q: `${encodedProduct} nearby`,
      tbm: 'shop', // Shopping tab
      hl: 'en',
      gl: 'us',
      tbs: `shoprs:CAEYAyoT${encodedProduct}MjIMCAMSBk5lYXJieRgCWOuhIGAB`, // Nearby filter
      sa: 'X',
      ved: '2ahUKEwj5oczq7t2PAxWl6ckDHSorAcMQip4GKAF6BAgWEEg', // Shopping filter
      location: encodedLocation,
      radius: radius.toString(),
    });

    return `${this.GOOGLE_SHOPPING_BASE_URL}?${searchParams.toString()}`;
  }

  /**
   * Parse Google Shopping HTML results to extract product information
   */
  private parseGoogleShoppingResults(html: string, originalProduct: string): GoogleShoppingResult[] {
    const results: GoogleShoppingResult[] = [];
    
    try {
      // This is a simplified parser - in a real implementation, you'd use a proper HTML parser
      // For now, we'll extract basic information using regex patterns
      
      // Look for sponsored results or shopping results
      const shoppingResultsRegex = /<div[^>]*class="[^"]*sh-dgr__content[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
      const matches = html.match(shoppingResultsRegex) || [];
      
      for (const match of matches.slice(0, 5)) { // Limit to 5 results
        const result = this.extractProductFromHtml(match, originalProduct);
        if (result) {
          results.push(result);
        }
      }
      
      // If no shopping results found, try alternative selectors
      if (results.length === 0) {
        const alternativeResults = this.parseAlternativeSelectors(html, originalProduct);
        results.push(...alternativeResults);
      }
      
    } catch (error) {
      console.error('❌ Error parsing Google Shopping results:', error);
    }
    
    return results;
  }

  /**
   * Extract product information from HTML snippet
   */
  private extractProductFromHtml(htmlSnippet: string, originalProduct: string): GoogleShoppingResult | null {
    try {
      // Extract price using various patterns
      const pricePatterns = [
        /\$(\d+\.?\d*)/g,
        /(\d+\.?\d*)\s*USD/g,
        /Price:\s*\$?(\d+\.?\d*)/gi,
      ];
      
      let price = 0;
      for (const pattern of pricePatterns) {
        const match = htmlSnippet.match(pattern);
        if (match) {
          const priceStr = match[0].replace(/[$,]/g, '');
          const parsedPrice = parseFloat(priceStr);
          if (parsedPrice > 0) {
            price = parsedPrice;
            break;
          }
        }
      }
      
      if (price === 0) return null;
      
      // Extract store name
      const storePatterns = [
        /<span[^>]*class="[^"]*sh-dgr__title[^"]*"[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*class="[^"]*sh-dgr__title[^"]*"[^>]*>([^<]+)<\/a>/i,
        /Store:\s*([^<\n]+)/gi,
      ];
      
      let store = 'Unknown Store';
      for (const pattern of storePatterns) {
        const match = htmlSnippet.match(pattern);
        if (match && match[1]) {
          store = match[1].trim();
          break;
        }
      }
      
      // Extract store address if available
      const addressPattern = /<span[^>]*class="[^"]*sh-dgr__address[^"]*"[^>]*>([^<]+)<\/span>/i;
      const addressMatch = htmlSnippet.match(addressPattern);
      const storeAddress = addressMatch ? addressMatch[1].trim() : undefined;
      
      // Extract product URL
      const urlPattern = /<a[^>]*href="([^"]*)"[^>]*class="[^"]*sh-dgr__title[^"]*"/i;
      const urlMatch = htmlSnippet.match(urlPattern);
      const storeUrl = urlMatch ? urlMatch[1] : undefined;
      
      // Extract image URL
      const imagePattern = /<img[^>]*src="([^"]*)"[^>]*class="[^"]*sh-dgr__image[^"]*"/i;
      const imageMatch = htmlSnippet.match(imagePattern);
      const imageUrl = imageMatch ? imageMatch[1] : undefined;
      
      return {
        product: originalProduct,
        price,
        store,
        storeAddress,
        storeUrl,
        imageUrl,
        availability: 'in_stock' as const,
      };
      
    } catch (error) {
      console.error('❌ Error extracting product from HTML:', error);
      return null;
    }
  }

  /**
   * Parse alternative selectors if main shopping results not found
   */
  private parseAlternativeSelectors(html: string, originalProduct: string): GoogleShoppingResult[] {
    const results: GoogleShoppingResult[] = [];
    
    try {
      // Look for price patterns in the entire HTML
      const priceRegex = /\$(\d+\.?\d*)/g;
      const priceMatches = html.match(priceRegex) || [];
      
      // Look for store patterns
      const storeRegex = /(Walmart|Target|Kroger|Safeway|Publix|Whole Foods|Costco|Sam's Club|CVS|Walgreens|Rite Aid)/gi;
      const storeMatches = html.match(storeRegex) || [];
      
      // Create results from found prices and stores
      for (let i = 0; i < Math.min(priceMatches.length, storeMatches.length, 3); i++) {
        const price = parseFloat(priceMatches[i].replace('$', ''));
        const store = storeMatches[i];
        
        if (price > 0 && store) {
          results.push({
            product: originalProduct,
            price,
            store,
            availability: 'in_stock' as const,
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Error parsing alternative selectors:', error);
    }
    
    return results;
  }

  /**
   * Convert Google Shopping results to StorePriceResult format
   */
  convertToStorePriceResults(googleResults: GoogleShoppingResult[]): StorePriceResult[] {
    return googleResults.map(result => ({
      store: {
        id: `google_${result.store.toLowerCase().replace(/\s+/g, '_')}`,
        name: result.store,
        address: result.storeAddress || 'Address not available',
        city: 'Unknown',
        state: 'Unknown',
        zipCode: 'Unknown',
        phone: 'Unknown',
        distance: 0, // Google Shopping doesn't provide exact distance
        rating: 0,
        isOpen: true,
        hours: 'Unknown',
        website: result.storeUrl,
        imageUrl: result.imageUrl,
      },
      items: [{
        name: result.product,
        price: result.price,
        unit: 'each',
        availability: result.availability,
        imageUrl: result.imageUrl,
        storeUrl: result.storeUrl,
      }],
      totalPrice: result.price,
      savings: 0, // Will be calculated later
      isBestDeal: false, // Will be determined after comparison
    }));
  }
}

export const googleShoppingService = new GoogleShoppingService();
