import { Store, GroceryItem, Product, StoreSearchResult, ProductSearchResult, RealTimePriceData } from '@/types';
// Old API imports removed - using Unwrangle and GPT services instead

// Enhanced store service with mock data (using Unwrangle and GPT services for real data)
export const findNearbyStores = async (
  latitude: number,
  longitude: number,
  radius: number = 5
): Promise<Store[]> => {
  // Return mock data for now
  return getMockStores(latitude, longitude, radius);
};

export const findStoresByZipCode = async (
  zipCode: string,
  radius: number = 5
): Promise<Store[]> => {
  // Return mock data for now
  return getMockStoresByZipCode(zipCode, radius);
};

export const searchStores = async (
  query: string,
  latitude: number,
  longitude: number,
  radius: number = 10
): Promise<StoreSearchResult> => {
  // Return mock data for now
  const stores = getMockStores(latitude, longitude, radius);
  return {
    stores: stores.filter(store => store.name.toLowerCase().includes(query.toLowerCase())),
    totalCount: stores.length,
    searchRadius: radius,
    location: { latitude, longitude }
  };
};

export const getStoreDetails = async (storeId: string): Promise<Store | null> => {
  // Return mock data for now
  const stores = getMockStores(40.7128, -74.0060, 5);
  return stores.find(store => store.id === storeId) || null;
};

export const getRealTimePrices = async (
  itemIds: string[],
  storeIds: string[]
): Promise<RealTimePriceData[]> => {
  // Return mock data for now
  return [];
};

export const searchGroceryItems = async (
  items: string[],
  location?: string
): Promise<GroceryItem[]> => {
  // Return mock data for now
  return getMockGroceryItems(items);
};

export const searchProducts = async (
  query: string,
  filters?: any,
  location?: string
): Promise<ProductSearchResult> => {
  // Return mock data for now
  const products = getMockProducts(query);
  return {
    products,
    totalCount: products.length,
    searchQuery: query,
    filters
  };
};

export const getProductDetails = async (productId: string): Promise<Product | null> => {
  // Return mock data for now
  const products = getMockProducts('');
  return products.find(product => product.id === productId) || null;
};

export const getPriceAlerts = async (productIds: string[]): Promise<any[]> => {
  // Return mock data for now
  return [];
};

export const analyzeShoppingList = async (
  items: string[],
  budget: number,
  location: string
): Promise<any> => {
  // Return mock data for now
  return {
    suggestions: [],
    estimatedTotal: 0,
    potentialSavings: 0,
    budgetStatus: 'within',
    recommendations: []
  };
};

export const extractItemsFromImage = async (imageBase64: string): Promise<string[]> => {
  // Return mock data for now
  return [];
};

export const getStoreDirections = (store: Store, userLocation?: string) => {
  if (userLocation) {
    // Include both starting point and destination
    const url = `https://www.google.com/maps/dir/${encodeURIComponent(userLocation)}/${encodeURIComponent(store.address)}`;
    return url;
  } else {
    // Fallback to destination only (old behavior)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}&destination_place_id=${store.name}`;
    return url;
  }
};

// Helper functions removed - using Unwrangle and GPT services instead

// Mock data functions for fallback
const getMockStores = (latitude: number, longitude: number, radius: number): Store[] => {
  const stores = [
    {
      id: '1',
      name: 'Kroger',
      address: '123 Main St, City, State',
      distance: 2.1,
      latitude: latitude + 0.01,
      longitude: longitude + 0.01,
      priceScore: 8.5,
      rating: 4.2,
      isOpen: true,
      zipCode: '12345',
      phone: '(555) 123-4567',
      website: 'https://kroger.com',
      hours: {
        'Monday': '6:00 AM - 11:00 PM',
        'Tuesday': '6:00 AM - 11:00 PM',
        'Wednesday': '6:00 AM - 11:00 PM',
        'Thursday': '6:00 AM - 11:00 PM',
        'Friday': '6:00 AM - 11:00 PM',
        'Saturday': '6:00 AM - 11:00 PM',
        'Sunday': '6:00 AM - 11:00 PM'
      },
      services: ['Delivery', 'Pickup', 'Pharmacy', 'Fuel'],
      lastUpdated: new Date()
    },
    {
      id: '2',
      name: 'Walmart Supercenter',
      address: '456 Oak Ave, City, State',
      distance: 3.4,
      latitude: latitude + 0.02,
      longitude: longitude - 0.01,
      priceScore: 9.2,
      rating: 3.8,
      isOpen: true,
      zipCode: '12345',
      phone: '(555) 234-5678',
      website: 'https://walmart.com',
      hours: {
        'Monday': '6:00 AM - 12:00 AM',
        'Tuesday': '6:00 AM - 12:00 AM',
        'Wednesday': '6:00 AM - 12:00 AM',
        'Thursday': '6:00 AM - 12:00 AM',
        'Friday': '6:00 AM - 12:00 AM',
        'Saturday': '6:00 AM - 12:00 AM',
        'Sunday': '6:00 AM - 12:00 AM'
      },
      services: ['Delivery', 'Pickup', 'Pharmacy', 'Auto Care'],
      lastUpdated: new Date()
    },
    {
      id: '3',
      name: 'Target',
      address: '789 Pine Rd, City, State',
      distance: 4.7,
      latitude: latitude - 0.01,
      longitude: longitude + 0.02,
      priceScore: 7.8,
      rating: 4.5,
      isOpen: true,
      zipCode: '12345',
      phone: '(555) 345-6789',
      website: 'https://target.com',
      hours: {
        'Monday': '7:00 AM - 10:00 PM',
        'Tuesday': '7:00 AM - 10:00 PM',
        'Wednesday': '7:00 AM - 10:00 PM',
        'Thursday': '7:00 AM - 10:00 PM',
        'Friday': '7:00 AM - 10:00 PM',
        'Saturday': '7:00 AM - 10:00 PM',
        'Sunday': '7:00 AM - 10:00 PM'
      },
      services: ['Delivery', 'Pickup', 'Pharmacy'],
      lastUpdated: new Date()
    }
  ];
  
  return stores.filter(store => store.distance <= radius);
};

const getMockStoresByZipCode = (zipCode: string, radius: number): Store[] => {
  return getMockStores(40.7128, -74.0060, radius).map(store => ({
    ...store,
    zipCode
  }));
};

const getMockGroceryItems = (items: string[]): GroceryItem[] => {
  return items.map((item, index) => ({
    id: `item_${index}`,
    name: item,
    category: 'General',
    prices: [
      {
        storeId: '1',
        storeName: 'Kroger',
        price: Math.random() * 5 + 1,
        unit: 'unit',
        onSale: Math.random() > 0.7,
        salePrice: Math.random() > 0.7 ? Math.random() * 4 + 0.5 : undefined,
        lastUpdated: new Date()
      },
      {
        storeId: '2',
        storeName: 'Walmart',
        price: Math.random() * 5 + 1,
        unit: 'unit',
        onSale: Math.random() > 0.7,
        salePrice: Math.random() > 0.7 ? Math.random() * 4 + 0.5 : undefined,
        lastUpdated: new Date()
      },
      {
        storeId: '3',
        storeName: 'Target',
        price: Math.random() * 5 + 1,
        unit: 'unit',
        onSale: Math.random() > 0.7,
        salePrice: Math.random() > 0.7 ? Math.random() * 4 + 0.5 : undefined,
        lastUpdated: new Date()
      }
    ]
  }));
};

const getMockProducts = (query: string): Product[] => {
  const products = [
    {
      id: '1',
      name: 'Organic Bananas',
      category: 'Produce',
      brand: 'Organic Valley',
      currentPrice: 1.99,
      unit: 'lb',
      onSale: false,
      priceHistory: [2.19, 2.09, 1.99],
      stores: ['Kroger', 'Walmart', 'Target'],
      imageUrl: 'https://example.com/bananas.jpg',
      barcode: '123456789',
      nutritionalInfo: {
        calories: 89,
        protein: 1.1,
        carbs: 23,
        fat: 0.3,
        fiber: 2.6,
        sugar: 12
      },
      allergens: [],
      organic: true,
      glutenFree: true,
      lastUpdated: new Date()
    },
    {
      id: '2',
      name: 'Whole Milk',
      category: 'Dairy',
      brand: 'Horizon',
      currentPrice: 3.49,
      unit: 'gallon',
      onSale: true,
      salePrice: 2.99,
      priceHistory: [3.79, 3.59, 3.49],
      stores: ['Kroger', 'Walmart', 'Target'],
      imageUrl: 'https://example.com/milk.jpg',
      barcode: '987654321',
      nutritionalInfo: {
        calories: 149,
        protein: 8,
        carbs: 12,
        fat: 8,
        fiber: 0,
        sugar: 12
      },
      allergens: ['Milk'],
      organic: true,
      glutenFree: true,
      lastUpdated: new Date()
    }
  ];
  
  return products.filter(product => 
    product.name.toLowerCase().includes(query.toLowerCase())
  );
};