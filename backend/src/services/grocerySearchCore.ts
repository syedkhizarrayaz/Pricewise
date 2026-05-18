import { pythonMatcherService } from './pythonMatcherService';
import { fetchMergedPricingByItem } from '../pricing/pricingOrchestrator';
import type { NormalizedPriceOffer } from '../pricing/types';

export interface GrocerySearchCoreRequest {
  items: string[];
  address: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  nearbyStores?: string[];
}

export interface StoreMatch {
  store: string;
  product?: any;
  score?: number;
  confidence_ok?: boolean;
  reason?: string;
  exact_match?: boolean;
}

function toMatcherPayload(o: NormalizedPriceOffer): Record<string, unknown> {
  return {
    position: o.position,
    title: o.title,
    productId: o.productId ?? '',
    productLink: o.productLink ?? '',
    price: o.price,
    extractedPrice: o.extractedPrice,
    source: o.source,
    reviews: o.reviews,
    rating: o.rating,
    delivery: o.delivery,
    extensions: o.extensions,
    thumbnail: o.thumbnail,
    providerId: o.providerId,
    fetchedAt: o.fetchedAt,
  };
}

export interface GrocerySearchCoreResult {
  stores: {
    [storeName: string]: {
      products: any[];
      totalPrice: number;
    };
  };
  allHasDataResults: { [item: string]: any[] };
  providersUsed: string[];
  pythonMatchesData: any | null;
}

/**
 * HasData / provider merge + Python matcher (or fallback) — no HTTP cache layer.
 */
function mergeHasDataFallback(
  items: string[],
  allHasDataResults: { [item: string]: any[] },
  storeMatches: { [storeName: string]: any[] }
): void {
  for (const item of items) {
    const results = allHasDataResults[item];
    const storeGroups: { [storeName: string]: any[] } = {};
    for (const result of results) {
      const storeName = result.source;
      if (!storeGroups[storeName]) storeGroups[storeName] = [];
      storeGroups[storeName].push(result);
    }

    for (const [storeName, storeResults] of Object.entries(storeGroups)) {
      const sortedResults = storeResults.sort((a, b) => {
        const priceA = a.extractedPrice || parseFloat(String(a.price || '').replace(/[^0-9.]/g, '') || '0') || 0;
        const priceB = b.extractedPrice || parseFloat(String(b.price || '').replace(/[^0-9.]/g, '') || '0') || 0;
        return priceA - priceB;
      });
      const cheapestResult = sortedResults[0];
      if (!storeMatches[storeName]) storeMatches[storeName] = [];
      storeMatches[storeName].push({
        item,
        product: cheapestResult,
        score: 0.5,
        confidence_ok: false,
        reason: 'hasdata_fallback',
        exact_match: false,
      });
    }
  }
}

export async function runGroceryPriceSearchCore(body: GrocerySearchCoreRequest): Promise<GrocerySearchCoreResult> {
  const nearbyStores = body.nearbyStores;

  const pricingCtx = {
    address: body.address,
    zipCode: body.zipCode,
    latitude: body.latitude,
    longitude: body.longitude,
    nearbyStores,
  };

  const { byItem: mergedByItem, providersUsed } = await fetchMergedPricingByItem(pricingCtx, body.items);

  const allHasDataResults: { [item: string]: any[] } = {};
  for (const item of body.items) {
    const rows = mergedByItem[item] || [];
    allHasDataResults[item] = rows.map(toMatcherPayload);
  }

  const storeMatches: { [storeName: string]: any[] } = {};
  let pythonMatchesData: any = null;

  const pythonAvailable = await pythonMatcherService.isServiceAvailable();

  if (pythonAvailable) {
    for (const item of body.items) {
      const hasDataResults = allHasDataResults[item];
      if (hasDataResults.length === 0) continue;

      try {
        const pythonResult = await pythonMatcherService.matchProductsForStores(
          item,
          hasDataResults,
          body.nearbyStores || []
        );

        if (pythonResult?.store_matches) {
          for (const [storeName, match] of Object.entries(pythonResult.store_matches)) {
            if (!storeMatches[storeName]) storeMatches[storeName] = [];
            const matchData = match as StoreMatch;
            if (matchData.product) {
              storeMatches[storeName].push({
                item,
                product: matchData.product,
                score: matchData.score,
                confidence_ok: matchData.confidence_ok,
                reason: matchData.reason,
                exact_match: matchData.exact_match !== false,
              });
            }
          }
        }
        if (!pythonMatchesData) pythonMatchesData = pythonResult;
      } catch (e: any) {
        console.error(`❌ [GroceryCore] Python matcher error for "${item}":`, e.message);
      }
    }
  } else {
    mergeHasDataFallback(body.items, allHasDataResults, storeMatches);
  }

  /** Python matcher needs nearby store names; empty list yields no matches — use live offers anyway. */
  if (Object.keys(storeMatches).length === 0) {
    console.log(
      'ℹ️ [GroceryCore] No per-store matches (empty nearbyStores or matcher miss); using HasData cheapest-per-store fallback'
    );
    mergeHasDataFallback(body.items, allHasDataResults, storeMatches);
  }

  const stores: GrocerySearchCoreResult['stores'] = {};
  for (const [storeName, products] of Object.entries(storeMatches)) {
    const totalPrice = products.reduce((sum, p) => {
      const price = p.product?.extractedPrice || p.product?.price || 0;
      return sum + Number(price) || 0;
    }, 0);
    stores[storeName] = { products, totalPrice };
  }

  return { stores, allHasDataResults, providersUsed, pythonMatchesData };
}
