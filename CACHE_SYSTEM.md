# Caching System Documentation

## Overview

The caching system provides:
- **24-hour TTL cache** for API results (reduces API calls)
- **Permanent statistics storage** for user queries and locations (for analytics)
- **Automatic cache invalidation** after 24 hours
- **Location source tracking** (GPS vs Manual)

## Features

### 1. Cache Storage (24-hour TTL)

Cached results are stored with:
- Query items
- Location (address, zipCode, latitude, longitude)
- Nearby stores
- HasData results
- Final processed results

**Cache Key**: Generated from normalized items + location + coordinates

**TTL**: 24 hours from timestamp

### 2. Statistics Storage (Permanent)

Query statistics are stored permanently with:
- Query details (items, location, coordinates)
- Location source (GPS or Manual)
- Nearby stores list
- Result count
- Timestamp

Used for analytics and understanding user behavior.

## Usage

### Automatic Caching

The caching is automatically integrated into `groceryPriceService.fetchGroceryPrices()`:

```typescript
// Cache is checked first
const cachedResult = await cacheService.getCachedResult(cacheKey);
if (cachedResult) {
  return cachedResult; // Return cached result
}

// If no cache, fetch fresh data
// ... fetch data ...

// Cache the result
await cacheService.setCachedResult(cacheKey, result, nearbyStores, hasDataResults);

// Save statistics
await cacheService.saveQueryStatistics(cacheKey, nearbyStores, resultCount, locationSource);
```

### Manual Cache Management

```typescript
import { cacheService } from '@/services/cacheService';

// Get cached result
const cached = await cacheService.getCachedResult({
  items: ['mazola corn oil'],
  address: 'Plano, TX 75023, USA',
  zipCode: '75023',
  latitude: 33.0198,
  longitude: -96.6989
});

// Clear expired cache
await cacheService.clearExpiredCache();

// Clear all cache (keeps statistics)
await cacheService.clearAllCache();

// Get cache statistics
const stats = await cacheService.getCacheStats();
console.log(stats);
// {
//   totalCached: 5,
//   totalStats: 120,
//   oldestCache: 1234567890,
//   newestCache: 1234567890
// }

// Get all query statistics
const allStats = await cacheService.getAllStatistics();
console.log(allStats);
```

## Cache Key Generation

Cache keys are generated from:
1. **Items**: Sorted, lowercase, joined with `|`
2. **Location**: `address_lowercase_zipCode`
3. **Coordinates**: `_lat_long` (if provided)

Example:
- Items: `["mazola corn oil", "milk"]` → `mazola corn oil|milk`
- Location: `"Plano, TX 75023, USA"` + `"75023"` → `plano, tx 75023, usa_75023`
- Coordinates: `33.0198, -96.6989` → `_33.0198_-96.6989`

Final key: `@pricewise_cache:mazola corn oil|milk_plano, tx 75023, usa_75023_33.0198_-96.6989`

## Storage Structure

### Cache Entry
```typescript
{
  result: GroceryPriceComparison,
  timestamp: number,
  query: CacheKey,
  nearbyStores: string[],
  hasDataResults?: any
}
```

### Statistics Entry
```typescript
{
  query: CacheKey,
  timestamp: number,
  locationSource: 'gps' | 'manual',
  nearbyStores: string[],
  resultCount: number
}
```

## Benefits

1. **Reduced API Calls**: Same query + location within 24 hours returns cached result
2. **Faster Response**: Cached results return immediately
3. **Cost Savings**: Reduces HasData API and OpenAI API calls
4. **Analytics**: Permanent storage of user queries for future analysis
5. **Better UX**: Faster load times for repeated searches

## Cache Invalidation

- **Automatic**: Cache entries older than 24 hours are automatically invalidated
- **Manual**: Can clear all cache or specific entries
- **Statistics**: Never expire (permanent storage)

## Storage Location

Uses React Native's `AsyncStorage`:
- **Platform**: Works on iOS, Android, and Web
- **Persistence**: Data persists across app restarts
- **Limits**: ~10MB storage limit (plenty for our use case)

## Testing

To test the cache system:

1. **First Request**: Should fetch from API and cache result
2. **Second Request (within 24h)**: Should return cached result immediately
3. **After 24 hours**: Should fetch fresh data and update cache

Check logs for:
- `✅ [Cache] Cache hit!` - Cache was used
- `💾 [Cache] Result cached successfully` - Result was cached
- `📊 [Cache] Query statistics saved` - Statistics were saved

