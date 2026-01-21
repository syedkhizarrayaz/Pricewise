import axios from 'axios';

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
}

export interface UnwrangleSearchResult {
  products: UnwrangleProduct[];
  totalCount: number;
  searchQuery: string;
  platform: string;
}

export class UnwrangleService {
  private readonly API_KEY = process.env.UNWRANGLE_API_KEY || '';
  private readonly BASE_URL = 'https://data.unwrangle.com/api/getter/';
  
  constructor() {
    if (!this.API_KEY) {
      console.warn('⚠️ [Unwrangle] UNWRANGLE_API_KEY not found in environment variables. Please set it in the .env file at project root.');
    }
  }

  async searchProducts(
    query: string,
    platform: string = 'amazon_search',
    countryCode: string = 'us'
  ): Promise<UnwrangleSearchResult> {
    try {
      const params = new URLSearchParams({
        platform,
        search: query,
        country_code: countryCode,
        api_key: this.API_KEY,
      });

      const url = `${this.BASE_URL}?${params.toString()}`;
      const response = await axios.get(url, { timeout: 10000 });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const products = this.transformSearchResults(response.data, platform);
      
      return {
        products,
        totalCount: products.length,
        searchQuery: query,
        platform,
      };
    } catch (error: any) {
      console.error('❌ [Unwrangle] Error searching products:', error.message);
      throw error;
    }
  }

  async searchProductsMultiPlatform(
    query: string,
    platforms: string[] = ['amazon_search', 'walmart_search', 'target_search'],
    countryCode: string = 'us'
  ): Promise<UnwrangleSearchResult[]> {
    const results = await Promise.allSettled(
      platforms.map(platform => this.searchProducts(query, platform, countryCode))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<UnwrangleSearchResult> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  private transformSearchResults(data: any, platform: string): UnwrangleProduct[] {
    let productsArray: any[] = [];
    
    if (Array.isArray(data)) {
      productsArray = data;
    } else if (data?.results && Array.isArray(data.results)) {
      productsArray = data.results;
    } else if (data?.data && Array.isArray(data.data)) {
      productsArray = data.data;
    } else {
      return [];
    }

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
      reviewCount: this.parseReviewCount(item.review_count || item.reviews),
      availability: item.availability || 'In Stock',
    }));
  }

  private parsePrice(price: any): number {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      const cleaned = price.replace(/[$,€£¥]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private parseRating(rating: any): number | undefined {
    if (typeof rating === 'number') return rating;
    if (typeof rating === 'string') {
      const parsed = parseFloat(rating);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  private parseReviewCount(reviewCount: any): number | undefined {
    if (typeof reviewCount === 'number') return reviewCount;
    if (typeof reviewCount === 'string') {
      const cleaned = reviewCount.replace(/[^\d]/g, '');
      const parsed = parseInt(cleaned, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }
}

export const unwrangleService = new UnwrangleService();

