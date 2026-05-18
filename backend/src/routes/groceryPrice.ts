import { Router, Request, Response } from 'express';
import { cacheService } from '../services/cacheService';
import { pythonMatcherService } from '../services/pythonMatcherService';
import type { ComparisonResult } from '../types/comparison';
import {
  runSimplifiedGroceryPipeline,
  comparisonResultsToLegacySearchStores,
} from '../services/simplifiedGroceryPipeline';
import { isGeminiBasketConfigured } from '../services/geminiBasketService';
import { isOpenAIComparisonConfigured } from '../services/openaiComparisonService';
import { normalizeGrocerySearchBody } from '../utils/groceryRequestNormalize';

export const groceryPriceRouter = Router();

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
    store_matches: { [storeName: string]: any };
    stores_needing_ai: string[];
  };
  sources?: Record<string, unknown>;
  processing_time_ms: number;
  error?: string;
}

/**
 * Same pipeline as `/compare-unified`: OpenAI item list → HasData per item (full address in `q`) →
 * OpenAI pick per store (batches of 5). Response shaped for legacy Expo `backendApiService`.
 *
 * Previous implementation archived in `groceryPrice.search.legacy.ts` + git history.
 */
groceryPriceRouter.post('/search', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const normalized = normalizeGrocerySearchBody(req.body);
    if (!normalized.ok) {
      return res.status(normalized.status).json(normalized.json);
    }
    const body = normalized.body;

    console.log('\n▶ [/search] Request:', {
      rawItemLines: body.items.length,
      address: body.address,
      zipCode: body.zipCode,
    });

    const cacheKey = cacheService.makeQueryHash(
      'search_simple_v2',
      body.items,
      body.address,
      body.zipCode,
      body.nearbyStores
    );
    const cachedResponse = await cacheService.get<GrocerySearchResponse>(cacheKey);
    if (cachedResponse) {
      console.log('✅ [/search] cache hit (search_simple_v2)');
      return res.json({
        ...cachedResponse,
        cached: true,
        processing_time_ms: Date.now() - startTime,
      });
    }

    const comparisonResults: ComparisonResult[] = await runSimplifiedGroceryPipeline({
      items: body.items,
      address: body.address,
      zipCode: body.zipCode,
      latitude: body.latitude,
      longitude: body.longitude,
    });

    const stores = comparisonResultsToLegacySearchStores(comparisonResults);

    const response: GrocerySearchResponse = {
      success: true,
      query: {
        items: body.items,
        location: { address: body.address, zipCode: body.zipCode },
      },
      stores,
      pricingProvidersUsed: ['hasdata'],
      sources: {
        pipeline: 'hasdata_per_item_openai_select',
        simplified: true,
      },
      processing_time_ms: Date.now() - startTime,
    };

    console.log(`✅ [/search] done in ${response.processing_time_ms}ms, stores=${Object.keys(stores).length}`);

    await cacheService.set(cacheKey, response);
    return res.json(response);
  } catch (error: any) {
    console.error('❌ [/search] error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      processing_time_ms: Date.now() - startTime,
    });
  }
});

/**
 * Find UI — same simplified pipeline as `/search`; returns `ComparisonResult[]` for the web client.
 *
 * Legacy Gemini + Python + reconcile: see `groceryPrice.compareUnified.legacy.ts` + git history.
 */
groceryPriceRouter.post('/compare-unified', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const normalized = normalizeGrocerySearchBody(req.body);
    if (!normalized.ok) {
      return res.status(normalized.status).json(normalized.json);
    }
    const body = normalized.body;

    const compareCacheKey = cacheService.makeQueryHash(
      'compare_unified_simple_v2',
      body.items,
      body.address,
      body.zipCode,
      body.nearbyStores
    );
    const cachedCompare = await cacheService.get<{
      success: boolean;
      results: ComparisonResult[];
      sources: Record<string, unknown>;
      processing_time_ms: number;
    }>(compareCacheKey);
    if (cachedCompare) {
      console.log('✅ [compare-unified] cache hit (simple_v2)');
      return res.json({
        ...cachedCompare,
        cached: true,
        processing_time_ms: Date.now() - startTime,
      });
    }

    console.log('\n▶ [compare-unified] Request:', {
      address: body.address,
      zipCode: body.zipCode,
      rawItemLines: body.items.length,
    });

    const results = await runSimplifiedGroceryPipeline({
      items: body.items,
      address: body.address,
      zipCode: body.zipCode,
      latitude: body.latitude,
      longitude: body.longitude,
    });

    const response = {
      success: true,
      results,
      sources: {
        pipeline: 'hasdata_per_item_openai_select',
        simplified: true,
      },
      processing_time_ms: Date.now() - startTime,
    };

    await cacheService.set(compareCacheKey, response);
    return res.json(response);
  } catch (error: any) {
    console.error('❌ [compare-unified] error:', error);
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
      openaiComparison: isOpenAIComparisonConfigured() ? 'configured' : 'not_configured',
      grocerySearch: 'simple_v2',
      compareUnifiedPipeline: 'simple_v2',
      cache: cacheService.status(),
    },
  });
});
