import type { PricingProvider } from '../PricingProvider';
import type { NormalizedPriceOffer, PricingSearchContext } from '../types';
import { hasDataService, type HasDataResult } from '../../services/hasDataService';

function toOffers(rows: HasDataResult[]): Omit<NormalizedPriceOffer, 'providerId' | 'fetchedAt'>[] {
  return rows.map((r, index) => ({
    position: index + 1,
    title: r.title,
    productId: r.productId,
    productLink: r.productLink,
    price: r.price,
    extractedPrice: r.extractedPrice,
    source: r.source,
    reviews: r.reviews,
    rating: r.rating,
    delivery: r.delivery,
    extensions: r.extensions,
    thumbnail: r.thumbnail,
  }));
}

export const hasDataPricingProvider: PricingProvider = {
  id: 'hasdata',
  displayName: 'HasData (Google Shopping)',

  isAvailable(): boolean {
    return Boolean(process.env.HASDATA_API_KEY?.trim());
  },

  async searchItem(ctx: PricingSearchContext, itemQuery: string): Promise<NormalizedPriceOffer[]> {
    const fetchedAt = new Date().toISOString();
    const { results } = await hasDataService.searchProduct({
      product: itemQuery,
      address: ctx.address,
      zipCode: ctx.zipCode,
      latitude: ctx.latitude,
      longitude: ctx.longitude,
    });

    return toOffers(results).map((o) => ({
      ...o,
      providerId: 'hasdata',
      fetchedAt,
    }));
  },
};
