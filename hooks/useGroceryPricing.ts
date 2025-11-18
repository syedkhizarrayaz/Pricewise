import { useState, useEffect, useCallback } from 'react';
import { groceryPriceService } from '@/services/groceryPriceService';
import { Location, Store, GroceryItem, RealTimePriceData } from '@/types';

interface UseGroceryPricingState {
  stores: Store[];
  prices: RealTimePriceData[];
  items: GroceryItem[];
  bestPrices: { [itemId: string]: { storeId: string; price: number; storeName: string } };
  totalSavings: number;
  searchRadius: number;
  loading: boolean;
  error: string | null;
}

export function useGroceryPricing() {
  const [state, setState] = useState<UseGroceryPricingState>({
    stores: [],
    prices: [],
    items: [],
    bestPrices: {},
    totalSavings: 0,
    searchRadius: 0,
    loading: false,
    error: null,
  });

  const searchStores = useCallback(async (
    location: Location,
    startRadius: number = 5
  ): Promise<{ stores: Store[]; finalRadius: number }> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await groceryPriceService.getNearbyStoresWithExpandingRadius(location, startRadius);
      setState(prev => ({ 
        ...prev, 
        stores: result.stores, 
        searchRadius: result.finalRadius,
        loading: false 
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search stores';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        loading: false 
      }));
      throw error;
    }
  }, []);

  const getPriceComparison = useCallback(async (
    items: string[],
    location: Location
  ): Promise<{
    items: GroceryItem[];
    bestPrices: { [itemId: string]: { storeId: string; price: number; storeName: string } };
    totalSavings: number;
  }> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await groceryPriceService.getPriceComparison(items, location);
      setState(prev => ({ 
        ...prev, 
        items: result.items,
        bestPrices: result.bestPrices,
        totalSavings: result.totalSavings,
        loading: false 
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get price comparison';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        loading: false 
      }));
      throw error;
    }
  }, []);

  const getGroceryPricingData = useCallback(async (
    items: string[],
    location: Location
  ): Promise<{
    stores: Store[];
    prices: RealTimePriceData[];
    searchRadius: number;
    location: Location;
  }> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await groceryPriceService.getGroceryPricingData(items, location);
      setState(prev => ({ 
        ...prev, 
        stores: result.stores,
        prices: result.prices,
        searchRadius: result.searchRadius,
        loading: false 
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get grocery pricing data';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        loading: false 
      }));
      throw error;
    }
  }, []);

  const getRealTimePrices = useCallback(async (
    items: string[],
    stores: Store[],
    location: Location
  ): Promise<RealTimePriceData[]> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const prices = await groceryPriceService.getRealTimePrices(items, stores, location);
      setState(prev => ({ 
        ...prev, 
        prices,
        loading: false 
      }));
      return prices;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get real-time prices';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        loading: false 
      }));
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      stores: [],
      prices: [],
      items: [],
      bestPrices: {},
      totalSavings: 0,
      searchRadius: 0,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    searchStores,
    getPriceComparison,
    getGroceryPricingData,
    getRealTimePrices,
    clearError,
    reset,
  };
}
