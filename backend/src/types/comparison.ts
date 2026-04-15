/** Aligned with client_app_v2/src/types.ts for unified API responses */
export interface Product {
  id: string;
  name: string;
  price: number;
  storeId: string;
  storeName: string;
  imageUrl?: string;
  link?: string;
  matchConfidence?: number;
}

export interface ComparisonResult {
  storeId: string;
  storeName: string;
  totalPrice: number;
  matchedItems: number;
  totalItems: number;
  currencySymbol?: string;
  currencyCode?: string;
  products: Product[];
}
