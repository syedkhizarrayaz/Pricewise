import { Router, Request, Response } from 'express';
import { databaseService } from '../services/databaseService';
import { pythonMatcherService } from '../services/pythonMatcherService';
import { runGroceryPriceSearchCore } from '../services/grocerySearchCore';
import { mapCoreStoresToComparisonResults } from '../services/groceryCompareMapper';
import {
  generateGeminiDraftComparison,
  isGeminiBasketConfigured,
} from '../services/geminiBasketService';
import { reconcileGeminiAndBackendPricing } from '../services/geminiReconcileService';
import { normalizeGrocerySearchBody } from '../utils/groceryRequestNormalize';
import type { ComparisonResult } from '../types/comparison';

export const groceryPriceRouter = Router();

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
  pricingProvidersUsed?: string[];
  cached?: boolean;
  pythonMatches?: {
    store_matches: { [storeName: string]: StoreMatch };
    stores_needing_ai: string[];
  };
  processing_time_ms: number;
  error?: string;
}

/**
 * Legacy mobile search: cache + provider merge + Python matcher.
 */
groceryPriceRouter.post('/search', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const normalized = normalizeGrocerySearchBody(req.body);
    if (!normalized.ok) {
      return res.status(normalized.status).json(normalized.json);
    }
    const body = normalized.body;

    console.log('📥 [Backend] Received request:', {
      items: body.items,
      address: body.address,
      zipCode: body.zipCode,
      itemsLength: body.items?.length || 0,
    });

    console.log(`🔍 [Backend] Starting grocery search:`, {
      items: body.items,
      location: `${body.address}, ${body.zipCode}`,
      stores: body.nearbyStores?.length || 0,
    });

    const nearbyStores = body.nearbyStores;

    if (databaseService.isEnabled()) {
      const queryHash = databaseService.generateQueryHash(
        body.items,
        body.address,
        body.zipCode,
        nearbyStores
      );
      const cachedData = await databaseService.getCache(queryHash);

      if (cachedData) {
        console.log('✅ [Backend] Returning cached result');
        return res.json({
          success: true,
          query: {
            items: body.items,
            location: { address: body.address, zipCode: body.zipCode },
          },
          stores: cachedData.result.stores || {},
          cached: true,
          processing_time_ms: Date.now() - startTime,
        });
      }
    }

    console.log('🔄 [Backend] No cache found, fetching fresh data');

    const core = await runGroceryPriceSearchCore(body);
    const { stores, allHasDataResults, providersUsed, pythonMatchesData } = core;

    const processingTime = Date.now() - startTime;

    const response: GrocerySearchResponse = {
      success: true,
      query: {
        items: body.items,
        location: { address: body.address, zipCode: body.zipCode },
      },
      stores,
      pricingProvidersUsed: providersUsed.length ? providersUsed : undefined,
      pythonMatches: pythonMatchesData || undefined,
      processing_time_ms: processingTime,
    };

    console.log(`✅ [Backend] Search completed in ${processingTime}ms: ${Object.keys(stores).length} stores`);

    if (databaseService.isEnabled()) {
      (async () => {
        try {
          const queryHash = databaseService.generateQueryHash(
            body.items,
            body.address,
            body.zipCode,
            nearbyStores
          );

          const locationId = await databaseService.saveLocation({
            address: body.address,
            zipCode: body.zipCode,
            latitude: body.latitude,
            longitude: body.longitude,
            locationSource: body.latitude && body.longitude ? 'gps' : 'manual',
          });

          const queryId = await databaseService.saveQuery({
            locationId,
            items: body.items,
            queryHash,
          });

          const storesForDb = body.nearbyStores || Object.keys(stores);
          await databaseService.saveQueryStores(queryId, storesForDb);

          const queryResults = Object.entries(stores).map(([storeName, storeData]) => ({
            queryId,
            storeName,
            totalPrice: storeData.totalPrice,
            products: storeData.products,
            resultType: 'hasdata' as const,
            exactMatch: storeData.products.some((p: any) => p.exact_match === true) || false,
          }));
          await databaseService.saveQueryResults(queryId, queryResults);

          const ttlMs = databaseService.getPriceCacheTtlMs();
          const expiresAt = new Date(Date.now() + ttlMs);
          await databaseService.saveCache({
            queryHash,
            cachedResult: response,
            nearbyStores: storesForDb,
            hasdataResults: allHasDataResults,
            expiresAt,
          });

          console.log('💾 [Backend] Data saved to database successfully');
        } catch (dbError: any) {
          console.error('❌ [Backend] Error saving to database:', dbError.message);
        }
      })();
    }

    res.json(response);
  } catch (error: any) {
    console.error('❌ [Backend] Error in grocery search:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      processing_time_ms: Date.now() - startTime,
    });
  }
});

/**
 * Web client v2: Gemini draft (server) + live providers + Python matcher,
 * then a reconcile pass. Returns ComparisonResult[] for the Find UI.
 *
 * Optional: send `clientGeminiDraft` (same schema) ONLY when
 * ALLOW_CLIENT_GEMINI_DRAFT=true (dev / trusted clients). Otherwise draft is server-only.
 */
groceryPriceRouter.post('/compare-unified', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const normalized = normalizeGrocerySearchBody(req.body);
    if (!normalized.ok) {
      return res.status(normalized.status).json(normalized.json);
    }
    const body = normalized.body;

    let geminiDraft: ComparisonResult[] = [];

    const allowClientDraft = process.env.ALLOW_CLIENT_GEMINI_DRAFT === 'true';
    const clientDraft = req.body?.clientGeminiDraft;
    if (allowClientDraft && Array.isArray(clientDraft) && clientDraft.length > 0) {
      geminiDraft = clientDraft as ComparisonResult[];
      console.log('ℹ️ [Backend] Using client-supplied Gemini draft (ALLOW_CLIENT_GEMINI_DRAFT=true)');
    } else if (isGeminiBasketConfigured()) {
      try {
        geminiDraft = await generateGeminiDraftComparison(
          body.items,
          `${body.address}, ${body.zipCode}`,
          body.latitude !== undefined && body.longitude !== undefined
            ? { lat: body.latitude, lng: body.longitude }
            : undefined
        );
      } catch (e: any) {
        console.error('⚠️ [Backend] Gemini draft failed (continuing with backend only):', e.message);
        geminiDraft = [];
      }
    } else {
      console.log('ℹ️ [Backend] Gemini basket skipped (no GEMINI_API_KEY)');
    }

    const core = await runGroceryPriceSearchCore(body);
    const backendComparison = mapCoreStoresToComparisonResults(core, body.items);

    const finalResults: ComparisonResult[] =
      geminiDraft.length > 0
        ? await reconcileGeminiAndBackendPricing(body.items, geminiDraft, backendComparison)
        : backendComparison;

    return res.json({
      success: true,
      results: finalResults,
      sources: {
        backendPricing: true,
        geminiDraft: geminiDraft.length > 0,
        reconciled: geminiDraft.length > 0,
        pricingProvidersUsed: core.providersUsed,
      },
      processing_time_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('❌ [Backend] compare-unified error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      processing_time_ms: Date.now() - startTime,
    });
  }
});

groceryPriceRouter.get('/health', async (req: Request, res: Response) => {
  const pythonAvailable = await pythonMatcherService.isServiceAvailable();
  const { describePricingProviders } = await import('../pricing/registry');
  const pricingProviders = await describePricingProviders();

  res.json({
    status: 'healthy',
    services: {
      pythonMatcher: pythonAvailable ? 'available' : 'unavailable',
      pricingProviders,
      geminiBasket: isGeminiBasketConfigured() ? 'configured' : 'not_configured',
    },
  });
});
