import type { ComparisonResult, Product } from '../types/comparison';
import type { GrocerySearchCoreResult } from './grocerySearchCore';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store';
}

/**
 * Maps internal per-store line items to client ComparisonResult rows.
 */
export function mapCoreStoresToComparisonResults(
  core: GrocerySearchCoreResult,
  items: string[]
): ComparisonResult[] {
  const totalItems = items.length;

  return Object.entries(core.stores).map(([storeName, storeData]) => {
    const products: Product[] = storeData.products.map((row: any, idx: number) => {
      const title = row.product?.title || row.product?.name || '';
      const lineItem = row.item || '';
      const name = lineItem && title ? `${lineItem} — ${title}` : title || lineItem || 'Item';
      const price = Number(row.product?.extractedPrice ?? row.product?.price ?? 0) || 0;

      return {
        id: `${slug(storeName)}-${idx}`,
        name,
        price,
        storeId: slug(storeName),
        storeName,
        link: row.product?.productLink,
        imageUrl: row.product?.thumbnail,
        matchConfidence:
          typeof row.score === 'number' ? row.score : row.confidence_ok ? 0.8 : 0.4,
      };
    });

    return {
      storeId: slug(storeName),
      storeName,
      totalPrice: storeData.totalPrice,
      matchedItems: products.length,
      totalItems,
      currencySymbol: '$',
      currencyCode: 'USD',
      products,
    };
  });
}
