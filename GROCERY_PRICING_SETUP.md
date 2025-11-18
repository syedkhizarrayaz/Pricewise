# Grocery Pricing Backend Setup Guide

This guide will help you set up the real-time grocery pricing functionality for the Pricewise app using Unwrangle API and GPT-powered store discovery.

## Features Implemented

### 1. Location-Based Store Discovery (GPT-Powered)
- Get postal code from user's location
- Use GPT to find nearby grocery stores based on coordinates
- Automatically expand search radius (starting from 5 miles) until stores are found
- Goal: Find nearest 5 stores, minimum 1 store acceptable
- Fallback to default top USA stores if no stores found

### 2. Real-Time Product Search (Unwrangle API)
- Search products across multiple platforms (Amazon, Walmart, Target, etc.)
- Get detailed product information and pricing
- Product images, descriptions, ratings, and availability
- Multi-platform price comparison

### 3. Smart Search Algorithm
- Expanding radius search (5 → 7.5 → 11.25 → 16.875 → 25.3 → 38 → 50 miles)
- GPT-powered store discovery with location analysis
- Distance calculation using Haversine formula
- Price scoring based on store type and ratings

## Setup Instructions

### 1. API Keys Configuration

Update the API keys in `config/api.ts`:

```typescript
export const API_CONFIG = {
  // Get from Unwrangle
  UNWRANGLE_API_KEY: 'your-actual-unwrangle-api-key',
  
  // Get from OpenAI
  OPENAI_API_KEY: 'your-actual-openai-api-key',
  
  // Your backend API URL
  API_BASE_URL: 'https://your-api-domain.com',
  
  // ... other config
};
```

### 2. Unwrangle API Setup

1. Go to [Unwrangle](https://unwrangle.com/)
2. Create an account and get your API key
3. The app uses Unwrangle for:
   - Product search across multiple platforms
   - Product details and pricing
   - Real-time availability information

### 3. OpenAI API Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account and add billing information
3. Generate an API key
4. The app uses GPT-4 for store discovery and location analysis

### 4. Environment Variables (Optional)

You can also set API keys as environment variables:

```bash
# .env file
UNWRANGLE_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
```

Then update `config/api.ts` to read from environment:

```typescript
export const API_CONFIG = {
  UNWRANGLE_API_KEY: process.env.UNWRANGLE_API_KEY || 'your-unwrangle-api-key',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'your-openai-api-key',
  // ...
};
```

## Usage

### 1. Basic Store Search (GPT-Powered)

```typescript
import { groceryPriceService } from '@/services/groceryPriceService';

// Get nearby stores with expanding radius using GPT
const { stores, finalRadius } = await groceryPriceService.getNearbyStoresWithExpandingRadius(
  location, // { latitude, longitude, zipCode, city, state }
  5 // starting radius in miles
);
```

### 2. Product Search (Unwrangle)

```typescript
import { unwrangleService } from '@/services/unwrangleService';

// Search products across multiple platforms
const products = await unwrangleService.searchProductsMultiPlatform(
  'toothpaste', // search query
  ['amazon_search', 'walmart_search', 'target_search'], // platforms
  'us' // country code
);
```

### 3. Product Details (Unwrangle)

```typescript
// Get detailed product information
const productDetails = await unwrangleService.getProductDetails(
  'https://www.amazon.com/product-url'
);
```

### 4. Using the Hook

```typescript
import { useUnwrangleSearch } from '@/hooks/useUnwrangleSearch';

function ProductSearch() {
  const {
    products,
    searchResults,
    loading,
    error,
    searchProducts,
    getProductDetails
  } = useUnwrangleSearch();

  // Use the functions and state
}
```

### 5. Using the Component

The Unwrangle search is integrated into the search tab:

```typescript
// In your search screen
// Select "Unwrangle" mode to search products
```

## API Endpoints Used

### Unwrangle API
- `GET /api/getter/?platform=amazon_search&search=query&country_code=us&api_key=KEY` - Search products
- `GET /api/getter/?platform=amazon_detail&url=product_url&api_key=KEY` - Get product details

### OpenAI API
- `POST /v1/chat/completions` - GPT-powered store discovery

## Configuration Options

### Search Configuration
```typescript
SEARCH_CONFIG: {
  MAX_SEARCH_RADIUS: 50,        // Maximum search radius in miles
  MIN_STORES_REQUIRED: 1,       // Minimum stores to find
  TARGET_STORES: 5,             // Target number of stores
  DEFAULT_START_RADIUS: 5,      // Starting radius
}
```

### AI Configuration
```typescript
AI_CONFIG: {
  MODEL: 'gpt-4',               // AI model to use
  TEMPERATURE: 0.3,             // Response randomness
  MAX_TOKENS: 2000,             // Maximum response length
}
```

### Supported Platforms
```typescript
// Available platforms by country
us: ['amazon_search', 'walmart_search', 'target_search', 'bestbuy_search']
ca: ['amazon_search']
uk: ['amazon_search']
de: ['amazon_search']
fr: ['amazon_search']
it: ['amazon_search']
es: ['amazon_search']
jp: ['amazon_search']
```

## Error Handling

The system includes comprehensive error handling:

1. **API Key Validation**: Checks for missing or invalid API keys
2. **Fallback Data**: Uses realistic mock data when APIs fail
3. **Graceful Degradation**: Continues working with limited functionality
4. **User Feedback**: Clear error messages and loading states
5. **Default Stores**: Shows top USA stores if no local stores found

## Testing

### 1. Test Store Discovery
```typescript
// Test with a known location
const testLocation = {
  latitude: 40.7128,
  longitude: -74.0060,
  zipCode: '10001',
  city: 'New York',
  state: 'NY'
};

const result = await groceryPriceService.getNearbyStoresWithExpandingRadius(testLocation);
console.log('Found stores:', result.stores.length);
```

### 2. Test Product Search
```typescript
// Test Unwrangle product search
const products = await unwrangleService.searchProducts('toothpaste', 'amazon_search', 'us');
console.log('Found products:', products.length);
```

### 3. Test Product Details
```typescript
// Test product details
const details = await unwrangleService.getProductDetails('https://amazon.com/product-url');
console.log('Product details:', details.product.title);
```

## Troubleshooting

### Common Issues

1. **No stores found**: Check OpenAI API key and billing
2. **Product search errors**: Verify Unwrangle API key and billing
3. **Location errors**: Ensure location permissions are granted
4. **Network timeouts**: Check internet connection and API endpoints

### Debug Mode

Enable debug logging by setting:

```typescript
// In config/api.ts
const DEBUG_MODE = true;
```

This will log API requests, responses, and error details to the console.

## Performance Considerations

1. **API Rate Limits**: Unwrangle and OpenAI APIs have usage limits
2. **Cost Management**: Both APIs charge per request
3. **Caching**: Consider implementing response caching
4. **Batch Requests**: Group multiple items for efficiency

## Security Notes

1. **API Key Protection**: Never commit API keys to version control
2. **Request Validation**: Validate all user inputs
3. **Rate Limiting**: Implement client-side rate limiting
4. **Error Sanitization**: Don't expose sensitive error details

## Future Enhancements

1. **Price History**: Track price changes over time
2. **Deal Alerts**: Notify users of price drops
3. **Store Reviews**: Integrate user reviews and ratings
4. **Inventory Tracking**: Check item availability
5. **Multi-language Support**: Support for different languages
6. **Offline Mode**: Cache data for offline use
7. **More Platforms**: Add support for more retail platforms
8. **Advanced Filtering**: Category, brand, price range filters
