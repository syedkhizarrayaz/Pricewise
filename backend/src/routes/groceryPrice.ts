import { Router, Request, Response } from 'express';
import { hasDataService } from '../services/hasDataService';
import { pythonMatcherService } from '../services/pythonMatcherService';
import { databaseService } from '../services/databaseService';

export const groceryPriceRouter = Router();

interface GrocerySearchRequest {
  items: string[];
  address: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  nearbyStores?: string[];
}

interface StoreMatch {
  store: string;
  product?: any;
  score?: number;
  confidence_ok?: boolean;
  reason?: string;
  exact_match?: boolean;
}

interface GrocerySearchResponse {
  success: boolean;
  query: {
    items: string[];
    location: {
      address: string;
      zipCode: string;
    };
  };
  stores: {
    [storeName: string]: {
      products: any[];
      totalPrice: number;
    };
  };
  pythonMatches?: {
    store_matches: { [storeName: string]: StoreMatch };
    stores_needing_ai: string[];
  };
  processing_time_ms: number;
  error?: string;
}

/**
 * Main endpoint for grocery price search
 * This endpoint:
 * 1. Searches products using HasData API
 * 2. Matches products using Python service
 * 3. Returns unified results
 */
groceryPriceRouter.post('/search', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const body: GrocerySearchRequest = req.body;
    
    // Log incoming request for debugging
    console.log('📥 [Backend] Received request:', {
      items: body.items,
      address: body.address,
      zipCode: body.zipCode,
      hasItems: !!body.items,
      itemsIsArray: Array.isArray(body.items),
      itemsLength: body.items?.length || 0
    });
    
    // Validate input
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      console.error('❌ [Backend] Validation failed: Items array is required and cannot be empty');
      return res.status(400).json({
        success: false,
        error: 'Items array is required and cannot be empty',
        received: {
          items: body.items,
          itemsType: typeof body.items,
          itemsIsArray: Array.isArray(body.items)
        }
      });
    }

    // Validate address
    if (!body.address || body.address.trim().length === 0) {
      console.error('❌ [Backend] Validation failed: Address is required');
      return res.status(400).json({
        success: false,
        error: 'Address is required',
        received: {
          address: body.address,
          zipCode: body.zipCode
        }
      });
    }

    // Extract zip code from address if not provided
    let zipCode = body.zipCode?.trim() || '';
    if (!zipCode && body.address) {
      // Try to extract zip code from address (e.g., "Plano, TX 75023" or "Plano, TX 75023, USA")
      const zipMatch = body.address.match(/\b\d{5}(-\d{4})?\b/);
      if (zipMatch) {
        zipCode = zipMatch[0];
        console.log(`📮 [Backend] Extracted zip code from address: ${zipCode}`);
      }
    }

    // If still no zip code, return error
    if (!zipCode || zipCode.trim().length === 0) {
      console.error('❌ [Backend] Validation failed: zipCode is required and could not be extracted from address');
      return res.status(400).json({
        success: false,
        error: 'zipCode is required. Please provide zipCode or ensure address contains a valid zip code.',
        received: {
          address: body.address,
          zipCode: body.zipCode
        }
      });
    }

    // Update body with extracted zip code if needed
    if (zipCode !== body.zipCode) {
      body.zipCode = zipCode;
    }

    console.log(`🔍 [Backend] Starting grocery search:`, {
      items: body.items,
      location: `${body.address}, ${body.zipCode}`,
      stores: body.nearbyStores?.length || 0
    });

    // Check cache first (only if database is enabled)
    let cachedData = null;
    if (databaseService.isEnabled()) {
      const queryHash = databaseService.generateQueryHash(body.items, body.address, body.zipCode);
      cachedData = await databaseService.getCache(queryHash);
      
      if (cachedData) {
        console.log('✅ [Backend] Returning cached result');
        return res.json({
          success: true,
          query: {
            items: body.items,
            location: {
              address: body.address,
              zipCode: body.zipCode
            }
          },
          stores: cachedData.result.stores || {},
          cached: true,
          processing_time_ms: Date.now() - startTime
        });
      }
    }

    console.log('🔄 [Backend] No cache found, fetching fresh data');

    // Step 1: Search all items using HasData
    const allHasDataResults: { [item: string]: any[] } = {};
    
    for (const item of body.items) {
      try {
        const hasDataResult = await hasDataService.searchProduct({
          product: item,
          address: body.address,
          zipCode: body.zipCode,
          latitude: body.latitude,
          longitude: body.longitude
        });
        
        allHasDataResults[item] = hasDataResult.results;
        console.log(`✅ [Backend] HasData results for "${item}": ${hasDataResult.results.length} products`);
      } catch (error: any) {
        console.error(`❌ [Backend] Error searching for "${item}":`, error.message);
        allHasDataResults[item] = [];
      }
    }

    // Step 2: Use Python service to match products for each item
    const storeMatches: { [storeName: string]: any[] } = {};
    let pythonMatchesData: any = null;

    // Check if Python service is available
    const pythonAvailable = await pythonMatcherService.isServiceAvailable();
    
    if (pythonAvailable) {
      console.log('🤖 [Backend] Python service available, using for product matching');
      
      // Process each item through Python matcher
      for (const item of body.items) {
        const hasDataResults = allHasDataResults[item];
        
        if (hasDataResults.length === 0) {
          continue;
        }

        try {
          // Use match-products-for-stores endpoint which handles all stores at once
          const pythonResult = await pythonMatcherService.matchProductsForStores(
            item,
            hasDataResults,
            body.nearbyStores || []
          );

          if (pythonResult?.store_matches) {
            // Group products by store
            for (const [storeName, match] of Object.entries(pythonResult.store_matches)) {
              if (!storeMatches[storeName]) {
                storeMatches[storeName] = [];
              }
              
              const matchData = match as StoreMatch;
              if (matchData.product) {
                storeMatches[storeName].push({
                  item: item,
                  product: matchData.product,
                  score: matchData.score,
                  confidence_ok: matchData.confidence_ok,
                  reason: matchData.reason,
                  exact_match: matchData.exact_match !== false // Include exact_match from Python service
                });
              }
            }
          }

          // Store Python matches data for first item (or merge all)
          if (!pythonMatchesData) {
            pythonMatchesData = pythonResult;
          }
        } catch (error: any) {
          console.error(`❌ [Backend] Python matcher error for "${item}":`, error.message);
        }
      }
    } else {
      console.log('⚠️ [Backend] Python service not available, using HasData results directly');
      
      // Fallback: Group HasData results by store, selecting cheapest price per store per item
      for (const item of body.items) {
        const results = allHasDataResults[item];
        
        // Group results by store to select cheapest per store
        const storeGroups: { [storeName: string]: any[] } = {};
        for (const result of results) {
          const storeName = result.source;
          if (!storeGroups[storeName]) {
            storeGroups[storeName] = [];
          }
          storeGroups[storeName].push(result);
        }
        
        // Select cheapest product per store (matching frontend selectCheapestPricePerStore logic)
        for (const [storeName, storeResults] of Object.entries(storeGroups)) {
          // Sort by price (cheapest first) and take the first one
          const sortedResults = storeResults.sort((a, b) => {
            const priceA = a.extractedPrice || parseFloat(a.price?.replace(/[^0-9.]/g, '') || '0') || 0;
            const priceB = b.extractedPrice || parseFloat(b.price?.replace(/[^0-9.]/g, '') || '0') || 0;
            return priceA - priceB;
          });
          
          const cheapestResult = sortedResults[0];
          
          if (!storeMatches[storeName]) {
            storeMatches[storeName] = [];
          }
          storeMatches[storeName].push({
            item: item,
            product: cheapestResult,
            score: 0.5,
            confidence_ok: false,
            reason: 'hasdata_fallback',
            exact_match: false // Fallback means not exact match
          });
        }
      }
    }

    // Step 3: Calculate totals for each store
    const stores: { [storeName: string]: { products: any[]; totalPrice: number } } = {};
    
    for (const [storeName, products] of Object.entries(storeMatches)) {
      const totalPrice = products.reduce((sum, p) => {
        const price = p.product?.extractedPrice || p.product?.price || 0;
        return sum + price;
      }, 0);

      stores[storeName] = {
        products: products,
        totalPrice: totalPrice
      };
    }

    const processingTime = Date.now() - startTime;

    const response: GrocerySearchResponse = {
      success: true,
      query: {
        items: body.items,
        location: {
          address: body.address,
          zipCode: body.zipCode
        }
      },
      stores: stores,
      pythonMatches: pythonMatchesData || undefined,
      processing_time_ms: processingTime
    };

    console.log(`✅ [Backend] Search completed in ${processingTime}ms: ${Object.keys(stores).length} stores`);

    // Save to database (async, don't block response) - only if database is enabled
    if (databaseService.isEnabled()) {
      (async () => {
        try {
          const queryHash = databaseService.generateQueryHash(body.items, body.address, body.zipCode);
          
          // Save location
          const locationId = await databaseService.saveLocation({
            address: body.address,
            zipCode: body.zipCode,
            latitude: body.latitude,
            longitude: body.longitude,
            locationSource: (body.latitude && body.longitude) ? 'gps' : 'manual'
          });

          // Save query
          const queryId = await databaseService.saveQuery({
            locationId,
            items: body.items,
            queryHash
          });

          // Save nearby stores
          const nearbyStores = body.nearbyStores || Object.keys(stores);
          await databaseService.saveQueryStores(queryId, nearbyStores);

          // Prepare and save query results
          const queryResults = Object.entries(stores).map(([storeName, storeData]) => ({
            queryId,
            storeName,
            totalPrice: storeData.totalPrice,
            products: storeData.products,
            resultType: 'hasdata' as const,
            exactMatch: storeData.products.some((p: any) => p.exact_match === true) || false
          }));
          await databaseService.saveQueryResults(queryId, queryResults);

          // Save cache (24-hour TTL)
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await databaseService.saveCache({
            queryHash,
            cachedResult: response,
            nearbyStores,
            hasdataResults: allHasDataResults,
            expiresAt
          });

          console.log('💾 [Backend] Data saved to database successfully');
        } catch (dbError: any) {
          console.error('❌ [Backend] Error saving to database:', dbError.message);
          // Don't fail the request if database save fails
        }
      })();
    }

    res.json(response);

  } catch (error: any) {
    console.error('❌ [Backend] Error in grocery search:', error);
    const processingTime = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      processing_time_ms: processingTime
    });
  }
});

/**
 * Health check for grocery service
 */
groceryPriceRouter.get('/health', async (req: Request, res: Response) => {
  const pythonAvailable = await pythonMatcherService.isServiceAvailable();
  
  res.json({
    status: 'healthy',
    services: {
      hasData: 'available',
      pythonMatcher: pythonAvailable ? 'available' : 'unavailable',
      unwrangle: 'available'
    }
  });
});

