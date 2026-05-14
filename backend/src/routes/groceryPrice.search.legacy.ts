/**
 * ARCHIVE ONLY — previous `POST /api/grocery/search` implementation.
 * Not imported anywhere.
 *
 * Former flow:
 * - `cacheService.makeQueryHash('search', ...)`
 * - `runGroceryPriceSearchCore` → provider merge (`pricingOrchestrator`) + Python matcher
 *   (`services/grocerySearchCore.ts`).
 *
 * Replaced by `runSimplifiedGroceryPipeline` + `comparisonResultsToLegacySearchStores`
 * so `/search` and `/compare-unified` share the same pipeline.
 *
 * Git history retains full source if needed.
 */
export {};
