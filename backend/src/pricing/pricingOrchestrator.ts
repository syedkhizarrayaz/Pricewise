import type { NormalizedPriceOffer, PricingSearchContext } from './types';
import { mergePriceOffers } from './mergeOffers';
import { getActivePricingProviders } from './registry';

export interface MergedPricingResult {
  /** Raw merged offers per list item (store + title deduped, cheapest kept) */
  byItem: Record<string, NormalizedPriceOffer[]>;
  /** Provider ids that were invoked for this request */
  providersUsed: string[];
}

/**
 * Fetches pricing for each grocery line item from all active providers in parallel,
 * then merges rows suitable for the Python matcher / existing response shape.
 */
export async function fetchMergedPricingByItem(
  ctx: PricingSearchContext,
  items: string[]
): Promise<MergedPricingResult> {
  const providers = await getActivePricingProviders();
  const providersUsed = providers.map((p) => p.id);

  if (providers.length === 0) {
    console.warn('⚠️ [Pricing] No pricing providers available — check API keys and PRICING_PROVIDERS');
    const empty: Record<string, NormalizedPriceOffer[]> = {};
    for (const item of items) empty[item] = [];
    return { byItem: empty, providersUsed: [] };
  }

  const byItem: Record<string, NormalizedPriceOffer[]> = {};

  for (const item of items) {
    const settled = await Promise.allSettled(providers.map((p) => p.searchItem(ctx, item)));
    const chunks: NormalizedPriceOffer[] = [];

    for (let i = 0; i < settled.length; i++) {
      const res = settled[i];
      const pid = providers[i].id;
      if (res.status === 'fulfilled') {
        chunks.push(...res.value);
      } else {
        console.error(`❌ [Pricing] Provider "${pid}" failed for item "${item}":`, res.reason);
      }
    }

    byItem[item] = mergePriceOffers(chunks);
  }

  return { byItem, providersUsed };
}
