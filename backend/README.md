# Pricewise Backend API

Backend service for Pricewise that manages all third-party API calls and product matching.

## Architecture

- **Backend**: Express.js API server managing third-party API calls
- **Python Service**: Separate product matcher service (already running on port 8000)
- **Frontend**: React Native app that calls this backend API

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your API keys:
```
HASDATA_API_KEY=your-key
UNWRANGLE_API_KEY=your-key
OPENAI_API_KEY=your-key
PYTHON_SERVICE_URL=http://localhost:8000
```

4. Start the server:
```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Grocery Price Search
```
POST /api/grocery/search
```

**Request Body:**
```json
{
  "items": ["Mazola Corn Oil", "whole milk"],
  "address": "123 Main St, Plano, TX 75074",
  "zipCode": "75074",
  "latitude": 33.0198,
  "longitude": -96.6989,
  "nearbyStores": ["Walmart", "Kroger", "Target"]
}
```

**Response:**
```json
{
  "success": true,
  "query": {
    "items": ["Mazola Corn Oil", "whole milk"],
    "location": {
      "address": "123 Main St, Plano, TX 75074",
      "zipCode": "75074"
    }
  },
  "stores": {
    "Walmart": {
      "products": [...],
      "totalPrice": 15.98
    },
    "Kroger": {
      "products": [...],
      "totalPrice": 16.45
    }
  },
  "pythonMatches": {
    "store_matches": {...},
    "stores_needing_ai": [...]
  },
  "processing_time_ms": 2345
}
```

## Testing Without Frontend

You can test the entire app by calling the backend API directly:

```bash
curl -X POST http://localhost:3001/api/grocery/search \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["Mazola Corn Oil"],
    "address": "Plano, TX 75074",
    "zipCode": "75074",
    "nearbyStores": ["Walmart", "Kroger"]
  }'
```

## Services

- **HasData Service**: Searches products using HasData API
- **Unwrangle Service**: Alternative product search (if needed)
- **Python Matcher Service**: Intelligent product matching (calls Python service on port 8000)

