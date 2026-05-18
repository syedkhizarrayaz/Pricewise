export interface Product {
  id: string;
  name: string;
  price: number;
  storeId: string;
  storeName: string;
  imageUrl?: string;
  link?: string;
  matchConfidence?: number; // 0 to 1
  /** Live pricing vs Gemini gap-fill (UI: "approx.") */
  priceSource?: 'live' | 'gemini_estimate';
}

export interface Store {
  id: string;
  name: string;
  address: string;
  distance?: number;
  rating?: number;
  isOpen?: boolean;
  location: {
    lat: number;
    lng: number;
  };
  phone?: string;
  website?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: string[];
  createdAt: number;
  updatedAt: number;
  userId: string;
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
