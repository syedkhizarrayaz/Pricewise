/**
 * Normalized offer shape — compatible with HasData / Python matcher expectations.
 * Extra fields are safe for JSON; consumers can ignore unknown keys.
 */
export interface NormalizedPriceOffer {
  position: number;
  title: string;
  productId?: string;
  productLink?: string;
  price: string;
  extractedPrice: number;
  source: string;
  reviews?: number;
  rating?: number;
  delivery?: string;
  extensions?: string[];
  thumbnail?: string;
  /** Provider that produced this row (for debugging / analytics) */
  providerId: string;
  fetchedAt: string;
}

export interface PricingSearchContext {
  address: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  nearbyStores?: string[];
}
