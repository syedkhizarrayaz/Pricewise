/**
 * ARCHIVE ONLY — previous `POST /compare-unified` implementation. Not imported anywhere.
 * Replaced by `runSimplifiedGroceryPipeline` in `services/simplifiedGroceryPipeline.ts`.
 *
 * Former route flow (removed from `groceryPrice.ts`):
 * 1) Optional client draft when ALLOW_CLIENT_GEMINI_DRAFT, else `generateGeminiDraftComparison`
 *    (`services/geminiBasketService.ts`), else `generateOpenAIDraftWithWebSearch`
 *    (`services/openaiComparisonService.ts`).
 * 2) `runGroceryPriceSearchCore` (`services/grocerySearchCore.ts`) — HasData merge + Python matcher.
 * 3) `mapCoreStoresToComparisonResults` (`services/groceryCompareMapper.ts`).
 * 4) `reconcileGeminiAndBackendPricingWithMeta` (`services/geminiReconcileService.ts`) when draft non-empty.
 *
 * Implementation files are still in the repo (unused by this route). Git history has full source.
 *
 * Legacy `/api/grocery/search`: see `groceryPrice.search.legacy.ts`.
 */
export {};
