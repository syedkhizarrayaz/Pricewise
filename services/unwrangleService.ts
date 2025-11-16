import axios from 'axios';
import { getApiConfig } from '@/config/api';

// Configuration
const config = getApiConfig();
const UNWRANGLE_API_KEY = config.UNWRANGLE_API_KEY;
const UNWRANGLE_BASE_URL = 'https://data.unwrangle.com/api/getter/';

export interface UnwrangleProduct {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  currency: string;
  image: string;
  url: string;
  platform: string;
  rating?: number;
  reviewCount?: number;
  availability?: string;
  description?: string;
  features?: string[];
  specifications?: Record<string, any>;
}

export interface UnwrangleSearchResult {
  products: UnwrangleProduct[];
  totalCount: number;
  searchQuery: string;
  platform: string;
}

export interface UnwrangleProductDetail {
  product: UnwrangleProduct;
  variants?: UnwrangleProduct[];
  relatedProducts?: UnwrangleProduct[];
  priceHistory?: Array<{
    date: string;
    price: number;
  }>;
  sellerInfo?: {
    name: string;
    rating: number;
    reviewCount: number;
  };
}

export class UnwrangleService {
  private static instance: UnwrangleService;
  
  public static getInstance(): UnwrangleService {
    if (!UnwrangleService.instance) {
      UnwrangleService.instance = new UnwrangleService();
    }
    return UnwrangleService.instance;
  }

  /**
   * Search products using Unwrangle API
   */
  async searchProducts(
    query: string,
    platform: string = 'amazon_search',
    countryCode: string = 'us'
  ): Promise<UnwrangleSearchResult> {
    console.log('🔍 [DEBUG] UnwrangleService.searchProducts called:', {
      query,
      platform,
      countryCode,
      apiKey: UNWRANGLE_API_KEY ? 'Present' : 'Missing'
    });
    
    try {
      const params = new URLSearchParams({
        platform,
        search: query,
        country_code: countryCode,
        api_key: UNWRANGLE_API_KEY,
      });

      const url = `${UNWRANGLE_BASE_URL}?${params.toString()}`;
      console.log('🔍 [DEBUG] Making API request to:', url);

      const response = await axios.get(url, {
        timeout: config.TIMEOUTS.API_REQUEST,
      });

      console.log('🔍 [DEBUG] Unwrangle API response received:', {
        status: response.status,
        dataKeys: Object.keys(response.data),
        hasError: !!response.data.error,
        rawData: response.data
      });

      if (response.data.error) {
        console.error('🔍 [DEBUG] Unwrangle API returned error:', response.data.error);
        throw new Error(response.data.error);
      }

      // Transform the response to our interface
      const products = this.transformSearchResults(response.data, platform);
      console.log('🔍 [DEBUG] Transformed products:', {
        count: products.length,
        firstProduct: products[0] ? {
          title: products[0].title,
          price: products[0].price,
          platform: products[0].platform
        } : null
      });
      
      return {
        products,
        totalCount: products.length,
        searchQuery: query,
        platform,
      };
    } catch (error) {
      console.error('🔍 [DEBUG] Error searching products with Unwrangle:', error);
      throw error;
    }
  }

  /**
   * Get product details using Unwrangle API
   */
  async getProductDetails(productUrl: string): Promise<UnwrangleProductDetail> {
    console.log('🔍 [DEBUG] getProductDetails called with URL:', productUrl);
    
    try {
      // Determine the correct platform based on the URL
      let platform = 'amazon_detail';
      if (productUrl.includes('walmart.com')) {
        platform = 'walmart_detail';
      } else if (productUrl.includes('target.com')) {
        platform = 'target_detail';
      } else if (productUrl.includes('amazon.com')) {
        platform = 'amazon_detail';
      }
      
      console.log('🔍 [DEBUG] Using platform:', platform);
      
      const params = new URLSearchParams({
        platform,
        url: productUrl,
        api_key: UNWRANGLE_API_KEY,
      });

      const url = `${UNWRANGLE_BASE_URL}?${params.toString()}`;
      console.log('🔍 [DEBUG] Making product details API request to:', url);

      const response = await axios.get(url, {
        timeout: config.TIMEOUTS.API_REQUEST,
      });

      console.log('🔍 [DEBUG] Product details API response:', {
        status: response.status,
        dataKeys: Object.keys(response.data),
        hasError: !!response.data.error
      });

      if (response.data.error) {
        console.error('🔍 [DEBUG] Product details API returned error:', response.data.error);
        throw new Error(response.data.error);
      }

      // Transform the response to our interface
      const product = this.transformProductDetail(response.data);
      
      return {
        product,
        variants: response.data.variants ? this.transformSearchResults(response.data.variants, platform.replace('_detail', '')) : undefined,
        relatedProducts: response.data.related_products ? this.transformSearchResults(response.data.related_products, platform.replace('_detail', '')) : undefined,
        priceHistory: response.data.price_history || undefined,
        sellerInfo: response.data.seller_info || undefined,
      };
    } catch (error) {
      console.error('🔍 [DEBUG] Error getting product details with Unwrangle:', error);
      throw error;
    }
  }

  /**
   * Search products across multiple platforms
   */
  async searchProductsMultiPlatform(
    query: string,
    platforms: string[] = ['amazon_search', 'walmart_search', 'target_search'],
    countryCode: string = 'us'
  ): Promise<UnwrangleSearchResult[]> {
    console.log('🔍 [DEBUG] UnwrangleService.searchProductsMultiPlatform called:', {
      query,
      platforms,
      countryCode
    });
    
    const results = await Promise.allSettled(
      platforms.map(platform => this.searchProducts(query, platform, countryCode))
    );

    console.log('🔍 [DEBUG] Multi-platform search results:', {
      totalResults: results.length,
      fulfilled: results.filter(r => r.status === 'fulfilled').length,
      rejected: results.filter(r => r.status === 'rejected').length,
      rejectedReasons: results
        .filter(r => r.status === 'rejected')
        .map(r => (r as PromiseRejectedResult).reason)
    });

    const filteredResults = results
      .filter((result): result is PromiseFulfilledResult<UnwrangleSearchResult> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
      
    console.log('🔍 [DEBUG] Filtered results:', {
      count: filteredResults.length,
      platforms: filteredResults.map(r => r.platform)
    });

    return filteredResults;
  }

  /**
   * Get product details from multiple platforms
   */
  async getProductDetailsMultiPlatform(productUrls: string[]): Promise<UnwrangleProductDetail[]> {
    const results = await Promise.allSettled(
      productUrls.map(url => this.getProductDetails(url))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<UnwrangleProductDetail> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  /**
   * Transform search results to our interface
   */
  private transformSearchResults(data: any, platform: string): UnwrangleProduct[] {
    console.log('🔍 [DEBUG] transformSearchResults called with:', {
      dataType: typeof data,
      isArray: Array.isArray(data),
      hasResults: data?.results ? 'Yes' : 'No',
      resultsLength: data?.results?.length || 0,
      dataKeys: data ? Object.keys(data) : []
    });

    // Handle different response structures
    let productsArray: any[] = [];
    
    if (Array.isArray(data)) {
      // Direct array of products
      productsArray = data;
    } else if (data?.results && Array.isArray(data.results)) {
      // Products in results property
      productsArray = data.results;
    } else if (data?.data && Array.isArray(data.data)) {
      // Products in data property
      productsArray = data.data;
    } else {
      console.warn('🔍 [DEBUG] No products array found in response');
      return [];
    }

    console.log('🔍 [DEBUG] Processing products array:', {
      length: productsArray.length,
      firstProduct: productsArray[0] ? {
        id: productsArray[0].id,
        name: productsArray[0].name,
        price: productsArray[0].price
      } : null
    });

    return productsArray.map((item: any, index: number) => ({
      id: item.id || item.asin || `product_${index}`,
      title: item.title || item.name || 'Unknown Product',
      price: this.parsePrice(item.price),
      originalPrice: this.parsePrice(item.original_price || item.list_price),
      currency: item.currency || 'USD',
      image: item.image || item.image_url || item.thumbnail || '',
      url: item.url || item.link || '',
      platform,
      rating: this.parseRating(item.rating),
      reviewCount: this.parseReviewCount(item.review_count || item.reviews || item.total_ratings),
      availability: this.parseAvailability(item.availability, item.in_stock),
      description: item.description || '',
      features: item.features || [],
      specifications: item.specifications || {},
    }));
  }

  /**
   * Transform product detail to our interface
   */
  private transformProductDetail(data: any): UnwrangleProduct {
    return {
      id: data.id || data.asin || 'unknown',
      title: data.title || data.name || 'Unknown Product',
      price: this.parsePrice(data.price),
      originalPrice: this.parsePrice(data.original_price || data.list_price),
      currency: data.currency || 'USD',
      image: data.image || data.image_url || '',
      url: data.url || data.link || '',
      platform: 'amazon',
      rating: this.parseRating(data.rating),
      reviewCount: this.parseReviewCount(data.review_count || data.reviews),
      availability: this.parseAvailability(data.availability, data.in_stock),
      description: data.description || '',
      features: data.features || [],
      specifications: data.specifications || {},
    };
  }

  /**
   * Parse price from various formats
   */
  private parsePrice(price: any): number {
    if (typeof price === 'number') {
      return price;
    }
    if (typeof price === 'string') {
      // Remove currency symbols and commas, then parse
      const cleaned = price.replace(/[$,€£¥]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Parse rating from various formats
   */
  private parseRating(rating: any): number | undefined {
    if (typeof rating === 'number') {
      return rating;
    }
    if (typeof rating === 'string') {
      const parsed = parseFloat(rating);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  /**
   * Parse review count from various formats
   */
  private parseReviewCount(reviewCount: any): number | undefined {
    if (typeof reviewCount === 'number') {
      return reviewCount;
    }
    if (typeof reviewCount === 'string') {
      // Remove common suffixes like "reviews", "ratings", etc.
      const cleaned = reviewCount.replace(/[^\d]/g, '');
      const parsed = parseInt(cleaned, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  /**
   * Parse availability from various formats
   */
  private parseAvailability(availability: any, inStock: any): string {
    // If availability is already a string, return it
    if (typeof availability === 'string') {
      return availability;
    }
    
    // If in_stock is explicitly true/false, use that
    if (typeof inStock === 'boolean') {
      return inStock ? 'In Stock' : 'Out of Stock';
    }
    
    // If in_stock is a string, check for common patterns
    if (typeof inStock === 'string') {
      const lowerStock = inStock.toLowerCase();
      if (lowerStock.includes('in stock') || lowerStock.includes('available') || lowerStock === 'true') {
        return 'In Stock';
      }
      if (lowerStock.includes('out of stock') || lowerStock.includes('unavailable') || lowerStock === 'false') {
        return 'Out of Stock';
      }
    }
    
    // Default to In Stock if we have a price (likely available)
    return 'In Stock';
  }

  /**
   * Get available platforms for a given country
   */
  getAvailablePlatforms(countryCode: string = 'us'): string[] {
    const platforms: Record<string, string[]> = {
      us: ['amazon_search', 'walmart_search', 'target_search', 'bestbuy_search'],
      ca: ['amazon_search'],
      uk: ['amazon_search'],
      de: ['amazon_search'],
      fr: ['amazon_search'],
      it: ['amazon_search'],
      es: ['amazon_search'],
      jp: ['amazon_search'],
    };

    return platforms[countryCode.toLowerCase()] || ['amazon_search'];
  }

  /**
   * Validate if a platform is supported
   */
  isPlatformSupported(platform: string, countryCode: string = 'us'): boolean {
    const availablePlatforms = this.getAvailablePlatforms(countryCode);
    return availablePlatforms.includes(platform);
  }
}

export const unwrangleService = UnwrangleService.getInstance();
