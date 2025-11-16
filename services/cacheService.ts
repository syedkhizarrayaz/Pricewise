/**
 * Cache Service for Grocery Price Results
 * 
 * Features:
 * - 24-hour TTL for cached results
 * - Persistent storage of queries and locations (for statistics)
 * - Automatic cache invalidation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheKey {
  items: string[];
  address: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}

export interface CachedResult {
  result: any;
  timestamp: number;
  query: CacheKey;
  nearbyStores: string[];
  hasDataResults?: any;
}

export interface QueryStatistics {
  query: CacheKey;
  timestamp: number;
  locationSource: 'gps' | 'manual';
  nearbyStores: string[];
  resultCount: number;
}

class CacheService {
  private readonly CACHE_PREFIX = '@pricewise_cache:';
  private readonly STATS_PREFIX = '@pricewise_stats:';
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Generate a cache key from query parameters
   */
  private generateCacheKey(key: CacheKey): string {
    const itemsKey = key.items.sort().join('|').toLowerCase();
    const locationKey = `${key.address.toLowerCase()}_${key.zipCode}`;
    const coordsKey = key.latitude && key.longitude 
      ? `_${key.latitude.toFixed(4)}_${key.longitude.toFixed(4)}` 
      : '';
    
    return `${this.CACHE_PREFIX}${itemsKey}_${locationKey}${coordsKey}`;
  }

  /**
   * Generate a statistics key (unique per query)
   */
  private generateStatsKey(): string {
    return `${this.STATS_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if cached result is still valid (within TTL)
   */
  private isCacheValid(cached: CachedResult): boolean {
    const age = Date.now() - cached.timestamp;
    return age < this.CACHE_TTL;
  }

  /**
   * Get cached result if available and valid
   */
  async getCachedResult(key: CacheKey): Promise<any | null> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        console.log('📦 [Cache] No cached result found');
        return null;
      }

      const cached: CachedResult = JSON.parse(cachedData);
      
      if (!this.isCacheValid(cached)) {
        console.log('📦 [Cache] Cached result expired, removing...');
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      const ageHours = ((Date.now() - cached.timestamp) / (1000 * 60 * 60)).toFixed(2);
      console.log(`✅ [Cache] Cache hit! Result is ${ageHours} hours old`);
      return cached.result;
    } catch (error) {
      console.error('❌ [Cache] Error getting cached result:', error);
      return null;
    }
  }

  /**
   * Store result in cache
   */
  async setCachedResult(
    key: CacheKey,
    result: any,
    nearbyStores: string[],
    hasDataResults?: any
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const cached: CachedResult = {
        result,
        timestamp: Date.now(),
        query: key,
        nearbyStores,
        hasDataResults
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cached));
      console.log('💾 [Cache] Result cached successfully');
    } catch (error) {
      console.error('❌ [Cache] Error caching result:', error);
    }
  }

  /**
   * Store query statistics (permanent storage for analytics)
   */
  async saveQueryStatistics(
    key: CacheKey,
    nearbyStores: string[],
    resultCount: number,
    locationSource: 'gps' | 'manual'
  ): Promise<void> {
    try {
      const statsKey = this.generateStatsKey();
      const stats: QueryStatistics = {
        query: key,
        timestamp: Date.now(),
        locationSource,
        nearbyStores,
        resultCount
      };

      await AsyncStorage.setItem(statsKey, JSON.stringify(stats));
      console.log('📊 [Cache] Query statistics saved');
    } catch (error) {
      console.error('❌ [Cache] Error saving statistics:', error);
    }
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      let cleared = 0;
      for (const key of cacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const cached: CachedResult = JSON.parse(data);
          if (!this.isCacheValid(cached)) {
            await AsyncStorage.removeItem(key);
            cleared++;
          }
        }
      }

      if (cleared > 0) {
        console.log(`🧹 [Cache] Cleared ${cleared} expired cache entries`);
      }
    } catch (error) {
      console.error('❌ [Cache] Error clearing expired cache:', error);
    }
  }

  /**
   * Get all query statistics (for analytics)
   */
  async getAllStatistics(): Promise<QueryStatistics[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const statsKeys = keys.filter(key => key.startsWith(this.STATS_PREFIX));
      
      const stats: QueryStatistics[] = [];
      for (const key of statsKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          stats.push(JSON.parse(data));
        }
      }

      return stats.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('❌ [Cache] Error getting statistics:', error);
      return [];
    }
  }

  /**
   * Clear all cache (but keep statistics)
   */
  async clearAllCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      for (const key of cacheKeys) {
        await AsyncStorage.removeItem(key);
      }

      console.log(`🧹 [Cache] Cleared all cache entries (${cacheKeys.length} entries)`);
    } catch (error) {
      console.error('❌ [Cache] Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalCached: number;
    totalStats: number;
    oldestCache: number | null;
    newestCache: number | null;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      const statsKeys = keys.filter(key => key.startsWith(this.STATS_PREFIX));

      let oldestTimestamp: number | null = null;
      let newestTimestamp: number | null = null;

      for (const key of cacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const cached: CachedResult = JSON.parse(data);
          if (!oldestTimestamp || cached.timestamp < oldestTimestamp) {
            oldestTimestamp = cached.timestamp;
          }
          if (!newestTimestamp || cached.timestamp > newestTimestamp) {
            newestTimestamp = cached.timestamp;
          }
        }
      }

      return {
        totalCached: cacheKeys.length,
        totalStats: statsKeys.length,
        oldestCache: oldestTimestamp,
        newestCache: newestTimestamp
      };
    } catch (error) {
      console.error('❌ [Cache] Error getting cache stats:', error);
      return {
        totalCached: 0,
        totalStats: 0,
        oldestCache: null,
        newestCache: null
      };
    }
  }
}

export const cacheService = new CacheService();

