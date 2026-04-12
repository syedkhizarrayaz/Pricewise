import type { PricingProvider } from '../PricingProvider';
import type { NormalizedPriceOffer, PricingSearchContext } from '../types';

/**
 * Template for adding a new pricing API (Kroger, Instacart partner, Datasembly, etc.):
 * 1. Copy this file, rename the class export and `id`.
 * 2. Implement searchItem() to call your HTTP client and map rows to NormalizedPriceOffer.
 * 3. Import and append your instance in registry.ts `allRegisteredProviders`.
 *
 * Set EXAMPLE_PRICING_PROVIDER=true to register this stub (returns no rows).
 */
export const customExamplePricingProvider: PricingProvider = {
  id: 'example_custom',
  displayName: 'Example custom API (stub)',

  isAvailable(): boolean {
    return process.env.EXAMPLE_PRICING_PROVIDER === 'true';
  },

  async searchItem(_ctx: PricingSearchContext, _itemQuery: string): Promise<NormalizedPriceOffer[]> {
    const fetchedAt = new Date().toISOString();
    // Replace with real HTTP call + mapping, e.g.:
    // const rows = await myClient.search(_ctx.zipCode, _itemQuery);
    // return rows.map((r, i) => ({ ...mapRow(r), position: i + 1, providerId: this.id, fetchedAt }));
    return [];
  },
};
