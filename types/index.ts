export interface Store {
  id: string;
  name: string;
  address: string;
  distance: number;
  latitude: number;
  longitude: number;
  priceScore: number;
  rating: number;
  isOpen: boolean;
  zipCode?: string;
  phone?: string;
  website?: string;
  hours?: {
    [key: string]: string;
  };
  services?: string[];
  lastUpdated?: Date;
}

export interface GroceryItem {
  id: string;
  name: string;
  category: string;
  brand?: string;
  prices: {
    storeId: string;
    storeName: string;
    price: number;
    unit: string;
    onSale: boolean;
    salePrice?: number;
    lastUpdated?: Date;
  }[];
  priceHistory?: {
    date: Date;
    price: number;
    storeId: string;
  }[];
  nutritionalInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

export interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  currentPrice: number;
  unit: string;
  onSale: boolean;
  salePrice?: number;
  priceHistory: number[];
  stores: string[];
  imageUrl?: string;
  barcode?: string;
  nutritionalInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
  };
  allergens?: string[];
  organic?: boolean;
  glutenFree?: boolean;
  lastUpdated?: Date;
}

export interface GroceryList {
  id: string;
  name: string;
  items: string[];
  createdAt: Date;
  estimatedTotal?: number;
  budget?: number;
  priority?: 'low' | 'medium' | 'high';
  status?: 'draft' | 'active' | 'completed';
  storePreferences?: string[];
  aiSuggestions?: AISuggestion[];
}

export interface AISuggestion {
  type: 'substitution' | 'budget_optimization' | 'healthier_alternative' | 'deal_alert';
  originalItem?: string;
  suggestedItem?: string;
  reason: string;
  estimatedSavings?: number;
  confidence: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  zipCode?: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: 'google' | 'apple' | 'email';
  totalSavings: number;
  monthlySavings: number;
  joinedAt: Date;
  priceComparisons: number;
  averageSavingsPercent: number;
  preferences?: {
    dietaryRestrictions?: string[];
    preferredStores?: string[];
    budgetAlerts?: boolean;
    priceAlerts?: boolean;
    location?: Location;
  };
  shoppingHistory?: ShoppingTrip[];
}

export interface ShoppingTrip {
  id: string;
  date: Date;
  storeId: string;
  storeName: string;
  items: ShoppingItem[];
  totalSpent: number;
  totalSaved: number;
  savingsPercent: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  unit: string;
  category: string;
}

export interface PriceAlert {
  id: string;
  productId: string;
  productName: string;
  targetPrice: number;
  currentPrice: number;
  storeId: string;
  storeName: string;
  isActive: boolean;
  createdAt: Date;
  triggeredAt?: Date;
}

export interface StoreSearchResult {
  stores: Store[];
  totalCount: number;
  searchRadius: number;
  location: Location;
}

export interface ProductSearchResult {
  products: Product[];
  totalCount: number;
  searchQuery: string;
  filters?: {
    category?: string[];
    brand?: string[];
    priceRange?: {
      min: number;
      max: number;
    };
    onSale?: boolean;
  };
}

export interface AIAnalysisResult {
  suggestions: AISuggestion[];
  estimatedTotal: number;
  potentialSavings: number;
  budgetStatus: 'under' | 'over' | 'within';
  recommendations: string[];
}

export interface RealTimePriceData {
  productId: string;
  storeId: string;
  currentPrice: number;
  originalPrice?: number;
  onSale: boolean;
  lastUpdated: Date;
  priceTrend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

export interface StoreDetails extends Store {
  departments: string[];
  services: string[];
  paymentMethods: string[];
  accessibility: {
    wheelchairAccessible: boolean;
    parkingAvailable: boolean;
    deliveryAvailable: boolean;
    pickupAvailable: boolean;
  };
  ratings: {
    overall: number;
    cleanliness: number;
    service: number;
    prices: number;
    selection: number;
  };
  popularItems: string[];
  deals: Deal[];
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  discountPercent: number;
  originalPrice: number;
  salePrice: number;
  validUntil: Date;
  terms: string[];
  category: string;
  storeId: string;
}

export interface SearchFilters {
  category?: string[];
  brand?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  onSale?: boolean;
  organic?: boolean;
  glutenFree?: boolean;
  store?: string[];
  rating?: number;
  distance?: number;
}

export interface NotificationSettings {
  priceAlerts: boolean;
  dealAlerts: boolean;
  budgetAlerts: boolean;
  newStores: boolean;
  weeklySavings: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
}