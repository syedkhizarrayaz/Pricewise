import type { NormalizedPriceOffer } from './types';

/**
 * Dedupe offers that represent the same listing (same store + similar title),
 * keeping the lowest positive price when duplicates exist.
 */
export function mergePriceOffers(offers: NormalizedPriceOffer[]): NormalizedPriceOffer[] {
  const map = new Map<string, NormalizedPriceOffer>();

  for (const o of offers) {
    const store = (o.source || 'unknown').toLowerCase().trim();
    const titleKey = (o.title || '').toLowerCase().trim().slice(0, 160);
    const key = `${store}|${titleKey}`;

    const existing = map.get(key);
    const price = Number(o.extractedPrice);
    const existingPrice = existing ? Number(existing.extractedPrice) : Infinity;

    if (!existing || (price > 0 && price < existingPrice)) {
      map.set(key, o);
    }
  }

  return [...map.values()]
    .sort((a, b) => (a.extractedPrice || 0) - (b.extractedPrice || 0))
    .map((o, i) => ({ ...o, position: i + 1 }));
}
