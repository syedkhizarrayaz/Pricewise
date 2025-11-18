import { useState, useCallback } from 'react';
import { unwrangleService, UnwrangleProduct, UnwrangleSearchResult, UnwrangleProductDetail } from '@/services/unwrangleService';

interface UseUnwrangleSearchState {
  products: UnwrangleProduct[];
  searchResults: UnwrangleSearchResult[];
  productDetails: UnwrangleProductDetail | null;
  loading: boolean;
  error: string | null;
}

export function useUnwrangleSearch() {
  const [state, setState] = useState<UseUnwrangleSearchState>({
    products: [],
    searchResults: [],
    productDetails: null,
    loading: false,
    error: null,
  });

  const searchProducts = useCallback(async (
    query: string,
    platforms: string[] = ['amazon_search', 'walmart_search', 'target_search'],
    countryCode: string = 'us'
  ): Promise<UnwrangleProduct[]> => {
    console.log('🔍 [DEBUG] useUnwrangleSearch.searchProducts called:', {
      query,
      platforms,
      countryCode
    });
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('🔍 [DEBUG] Calling unwrangleService.searchProductsMultiPlatform...');
      const results = await unwrangleService.searchProductsMultiPlatform(query, platforms, countryCode);
      console.log('🔍 [DEBUG] Unwrangle API response:', {
        resultsCount: results.length,
        platforms: results.map(r => r.platform),
        totalProducts: results.reduce((sum, r) => sum + r.products.length, 0)
      });
      
      const allProducts: UnwrangleProduct[] = [];
      
      results.forEach(result => {
        console.log(`🔍 [DEBUG] Platform ${result.platform}:`, {
          productsCount: result.products.length,
          firstProduct: result.products[0] ? {
            title: result.products[0].title,
            price: result.products[0].price,
            platform: result.products[0].platform
          } : null
        });
        allProducts.push(...result.products);
      });
      
      console.log('🔍 [DEBUG] Total products found:', allProducts.length);
      
      setState(prev => ({ 
        ...prev, 
        products: allProducts,
        searchResults: results,
        loading: false 
      }));
      
      return allProducts;
    } catch (error) {
      console.error('🔍 [DEBUG] Error in searchProducts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to search products';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        loading: false 
      }));
      throw error;
    }
  }, []);

  const getProductDetails = useCallback(async (
    productUrl: string
  ): Promise<UnwrangleProductDetail> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const details = await unwrangleService.getProductDetails(productUrl);
      
      setState(prev => ({ 
        ...prev, 
        productDetails: details,
        loading: false 
      }));
      
      return details;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get product details';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        loading: false 
      }));
      throw error;
    }
  }, []);

  const searchSinglePlatform = useCallback(async (
    query: string,
    platform: string = 'amazon_search',
    countryCode: string = 'us'
  ): Promise<UnwrangleSearchResult> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await unwrangleService.searchProducts(query, platform, countryCode);
      
      setState(prev => ({ 
        ...prev, 
        products: result.products,
        searchResults: [result],
        loading: false 
      }));
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search products';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        loading: false 
      }));
      throw error;
    }
  }, []);

  const getAvailablePlatforms = useCallback((countryCode: string = 'us'): string[] => {
    return unwrangleService.getAvailablePlatforms(countryCode);
  }, []);

  const isPlatformSupported = useCallback((platform: string, countryCode: string = 'us'): boolean => {
    return unwrangleService.isPlatformSupported(platform, countryCode);
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      products: [],
      searchResults: [],
      productDetails: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    searchProducts,
    getProductDetails,
    searchSinglePlatform,
    getAvailablePlatforms,
    isPlatformSupported,
    clearError,
    reset,
  };
}
