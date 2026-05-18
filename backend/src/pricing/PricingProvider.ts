import type { NormalizedPriceOffer, PricingSearchContext } from './types';

/**
 * Implement this interface and register your provider in registry.ts to add a new price source.
 */
export interface PricingProvider {
  /** Stable id, e.g. "hasdata", "kroger_api" */
  readonly id: string;
  readonly displayName: string;
  isAvailable(): boolean | Promise<boolean>;
  searchItem(
    ctx: PricingSearchContext,
    itemQuery: string
  ): Promise<NormalizedPriceOffer[]>;
}
