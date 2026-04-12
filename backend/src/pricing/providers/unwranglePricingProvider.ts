import type { PricingProvider } from '../PricingProvider';
import type { NormalizedPriceOffer, PricingSearchContext } from '../types';
import { unwrangleService } from '../../services/unwrangleService';

function platformLabel(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes('walmart')) return 'Walmart';
  if (p.includes('target')) return 'Target';
  if (p.includes('amazon')) return 'Amazon';
  return platform.replace(/_search$/i, '').replace(/_/g, ' ');
}

/**
 * Optional secondary source. Enable with UNWRANGLE_API_KEY.
 * Platforms default from env UNWRANGLE_PLATFORMS (comma-separated) or amazon,walmart,target search.
 */
export const unwranglePricingProvider: PricingProvider = {
  id: 'unwrangle',
  displayName: 'Unwrangle',

  isAvailable(): boolean {
    if (process.env.UNWRANGLE_AS_PRICING_PROVIDER === 'false') return false;
    return Boolean(process.env.UNWRANGLE_API_KEY?.trim());
  },

  async searchItem(_ctx: PricingSearchContext, itemQuery: string): Promise<NormalizedPriceOffer[]> {
    const fetchedAt = new Date().toISOString();
    const raw =
      process.env.UNWRANGLE_PLATFORMS?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) || ['amazon_search', 'walmart_search', 'target_search'];

    const platformResults = await unwrangleService.searchProductsMultiPlatform(itemQuery, raw, 'us');

    const offers: NormalizedPriceOffer[] = [];
    let pos = 0;

    for (const block of platformResults) {
      const store = platformLabel(block.platform);
      for (const p of block.products) {
        pos += 1;
        offers.push({
          position: pos,
          title: p.title,
          productId: p.id,
          productLink: p.url,
          price: p.price > 0 ? `$${p.price.toFixed(2)}` : '',
          extractedPrice: p.price,
          source: store,
          reviews: p.reviewCount,
          rating: p.rating,
          thumbnail: p.image,
          providerId: 'unwrangle',
          fetchedAt,
        });
      }
    }

    return offers;
  },
};
