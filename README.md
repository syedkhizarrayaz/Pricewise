# Pricewise

A smart grocery shopping app that helps you find the best prices for your grocery items using real-time price comparison and AI-powered insights.

## Features

### 🛒 Real-Time Price Comparison
- Compare prices across multiple grocery stores
- Find the best deals on your shopping list
- Track price history and trends
- Get notified of price drops and sales

### 📍 Location-Based Store Discovery
- Automatically find nearby grocery stores
- Expanding radius search (5 → 50 miles)
- Store ratings and price scores
- Distance and availability information

### 🤖 AI-Powered Price Predictions
- Real-time price predictions using OpenAI GPT-4
- Smart shopping recommendations
- Budget optimization suggestions
- Deal alerts and savings calculations

### 📱 Modern Mobile App
- Built with React Native and Expo
- Beautiful, intuitive user interface
- Cross-platform (iOS & Android)
- Offline-capable with caching

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pricewise.git
cd pricewise
```

2. Install dependencies:
```bash
npm install
```

3. Set up API keys (see [Grocery Pricing Setup Guide](./GROCERY_PRICING_SETUP.md)):
```bash
# Copy the config template
cp config/api.ts.example config/api.ts

# Edit the config file with your API keys
nano config/api.ts
```

4. Start the development server:
```bash
npx expo start
```

5. Run on your preferred platform:
```bash
# iOS
npx expo run:ios

# Android
npx expo run:android

# Web
npx expo run:web
```

## API Setup

The app requires the following APIs for full functionality:

### Required APIs
- **Google Places API**: For store discovery and location services
- **OpenAI API**: For AI-powered price predictions

### Optional APIs
- **Your Backend API**: For additional features and data storage

See the [Grocery Pricing Setup Guide](./GROCERY_PRICING_SETUP.md) for detailed setup instructions.

## Project Structure

```
Pricewise/
├── app/                    # Expo Router app directory
│   ├── (tabs)/            # Tab-based navigation
│   ├── auth/              # Authentication screens
│   └── onboarding.tsx     # Onboarding flow
├── components/            # Reusable UI components
│   ├── GroceryPriceFinder.tsx  # Main price comparison component
│   └── AuthProvider.tsx   # Authentication context
├── hooks/                 # Custom React hooks
│   ├── useLocation.ts     # Location services
│   └── useGroceryPricing.ts # Grocery pricing logic
├── services/              # API and business logic
│   ├── api.ts            # Main API client
│   ├── groceryPriceService.ts # Grocery pricing service
│   └── storeService.ts   # Store-related services
├── config/               # Configuration files
│   └── api.ts           # API keys and settings
├── types/               # TypeScript type definitions
├── constants/           # App constants and styling
└── assets/             # Images and static assets
```

## Key Components

### GroceryPriceFinder
The main component for price comparison functionality:
- Location-based store search
- Real-time price fetching
- Price comparison across stores
- Savings calculations

### useGroceryPricing Hook
Custom hook for managing grocery pricing state:
- Store discovery with expanding radius
- Price comparison logic
- Loading and error states
- Caching and optimization

### GroceryPriceService
Backend service for grocery pricing:
- Google Places API integration
- OpenAI GPT-4 price predictions
- Fallback mock data
- Error handling and retry logic

## Usage Examples

### Basic Price Comparison
```typescript
import { useGroceryPricing } from '@/hooks/useGroceryPricing';

function PriceComparison() {
  const { getPriceComparison, items, totalSavings } = useGroceryPricing();
  
  const comparePrices = async () => {
    const result = await getPriceComparison(
      ['milk', 'bread', 'eggs'],
      userLocation
    );
    console.log('Potential savings:', result.totalSavings);
  };
}
```

### Store Discovery
```typescript
import { groceryPriceService } from '@/services/groceryPriceService';

const findStores = async () => {
  const { stores, finalRadius } = await groceryPriceService
    .getNearbyStoresWithExpandingRadius(location, 5);
  
  console.log(`Found ${stores.length} stores within ${finalRadius} miles`);
};
```

## Configuration

### API Configuration
Update `config/api.ts` with your API keys:

```typescript
export const API_CONFIG = {
  GOOGLE_PLACES_API_KEY: 'your-google-places-api-key',
  OPENAI_API_KEY: 'your-openai-api-key',
  API_BASE_URL: 'https://your-api-domain.com',
  // ... other settings
};
```

### Search Configuration
```typescript
SEARCH_CONFIG: {
  MAX_SEARCH_RADIUS: 50,        // Maximum search radius
  MIN_STORES_REQUIRED: 1,       // Minimum stores to find
  TARGET_STORES: 5,             // Target number of stores
  DEFAULT_START_RADIUS: 5,      // Starting radius
}
```

## Development

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- React Native best practices

### Testing
```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Building
```bash
# Build for production
npx expo build:ios
npx expo build:android

# Build for web
npx expo build:web
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## Troubleshooting

### Common Issues

1. **API Key Errors**: Ensure all API keys are properly configured
2. **Location Permissions**: Grant location access for store discovery
3. **Network Issues**: Check internet connection and API endpoints
4. **Build Errors**: Clear cache and reinstall dependencies

### Debug Mode
Enable debug logging in `config/api.ts`:
```typescript
const DEBUG_MODE = true;
```

## Performance

### Optimization Tips
- Implement response caching
- Use batch API requests
- Optimize images and assets
- Monitor API usage and costs

### Monitoring
- Track API response times
- Monitor error rates
- Analyze user engagement
- Optimize search algorithms

## Security

### Best Practices
- Never commit API keys to version control
- Use environment variables for sensitive data
- Implement proper input validation
- Regular security audits

### API Key Protection
- Restrict API keys to specific domains/IPs
- Monitor API usage for anomalies
- Rotate keys regularly
- Use least privilege principle

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the [documentation](./docs/)
- Review the [setup guide](./GROCERY_PRICING_SETUP.md)

## Roadmap

### Upcoming Features
- [ ] Price history tracking
- [ ] Deal alerts and notifications
- [ ] Store reviews and ratings
- [ ] Inventory tracking
- [ ] Multi-language support
- [ ] Offline mode improvements
- [ ] Social features (sharing lists)
- [ ] Barcode scanning
- [ ] Voice search
- [ ] AR store navigation

### Technical Improvements
- [ ] Performance optimization
- [ ] Advanced caching strategies
- [ ] Real-time price updates
- [ ] Machine learning price predictions
- [ ] Advanced analytics
- [ ] A/B testing framework