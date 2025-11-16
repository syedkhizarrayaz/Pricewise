import { useState, useCallback } from 'react';
import { groceryPriceService, GroceryPriceComparison } from '@/services/groceryPriceService';

export const useGroceryPrices = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GroceryPriceComparison | null>(null);

  const fetchPrices = useCallback(async (
    items: string[],
    address: string,
    zipCode: string,
    useMockData: boolean = false,
    latitude?: number,
    longitude?: number
  ) => {
    console.log('🛒 [useGroceryPrices] Starting price fetch:', {
      items,
      address,
      zipCode,
      useMockData
    });

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let comparison: GroceryPriceComparison;

      if (useMockData) {
        console.log('🛒 [useGroceryPrices] Using mock data');
        comparison = groceryPriceService.getMockGroceryPrices(items, address, zipCode);
      } else {
        console.log('🛒 [useGroceryPrices] Fetching real prices from HasData API');
        comparison = await groceryPriceService.fetchGroceryPrices(items, address, zipCode, latitude, longitude);
      }

      console.log('🛒 [useGroceryPrices] Price comparison completed:', {
        storesCount: comparison.stores.length,
        cheapestStore: comparison.cheapestStore,
        totalSavings: comparison.totalSavings
      });

      setResult(comparison);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('🛒 [useGroceryPrices] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResult(null);
  }, []);

  return {
    loading,
    error,
    result,
    fetchPrices,
    clearError,
    clearResult,
    reset
  };
};
