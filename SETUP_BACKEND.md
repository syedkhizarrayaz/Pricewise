# Backend Setup Guide

## Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys:
# HASDATA_API_KEY=your-key
# UNWRANGLE_API_KEY=your-key  
# OPENAI_API_KEY=your-key
# PYTHON_SERVICE_URL=http://localhost:8000

# Start backend server
npm run dev
```

Backend will run on `http://localhost:3001`

### 2. Python Service Setup

```bash
# Navigate to services directory
cd services

# Install dependencies
pip install -r requirements.txt

# Create .env file (if not exists)
echo "OPENAI_API_KEY=your-key" > .env

# Start Python service
python product_matcher_service.py
# OR
uvicorn product_matcher_service:app --host 0.0.0.0 --port 8000
```

Python service will run on `http://localhost:8000`

### 3. Test Backend API (Without Frontend)

```bash
curl -X POST http://localhost:3001/api/grocery/search \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["Mazola Corn Oil", "whole milk 1 gallon"],
    "address": "Plano, TX 75074",
    "zipCode": "75074",
    "nearbyStores": ["Walmart", "Kroger", "Target"]
  }'
```

Expected response:
```json
{
  "success": true,
  "query": {
    "items": ["Mazola Corn Oil", "whole milk 1 gallon"],
    "location": {
      "address": "Plano, TX 75074",
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
  "processing_time_ms": 2345
}
```

## Migration from Frontend Services

### Option 1: Use Backend API (Recommended)

Update your frontend code to use `backendApiService` instead of direct service calls:

```typescript
// Before (direct service calls)
import { groceryPriceService } from '@/services/groceryPriceService';
const results = await groceryPriceService.fetchGroceryPrices(items, address, zipCode);

// After (backend API)
import { backendApiService } from '@/services/backendApiService';
const results = await backendApiService.searchGroceryPrices({
  items,
  address,
  zipCode,
  nearbyStores
});
```

### Option 2: Keep Current Implementation

The frontend can continue using direct service calls if preferred. The backend is an optional layer.

## Architecture Benefits

✅ **Single API Call**: Test entire app without frontend  
✅ **Centralized API Keys**: All keys managed in backend  
✅ **Better Error Handling**: Centralized error management  
✅ **Scalability**: Backend can serve multiple frontends  
✅ **Modularity**: Easy to update/replace services  

## Ports

- **Backend API**: 3001
- **Python Service**: 8000
- **Frontend**: 8081 (default Expo port)

## Troubleshooting

### Backend not connecting to Python service
- Check `PYTHON_SERVICE_URL` in backend `.env`
- Verify Python service is running: `curl http://localhost:8000/health`

### API keys not working
- Verify keys are set in backend `.env` file
- Check backend logs for authentication errors

### Frontend can't reach backend
- For React Native: Update `EXPO_PUBLIC_BACKEND_URL` in frontend
- Use your machine's IP address instead of `localhost`
- Check backend CORS settings

## Next Steps

1. ✅ Backend API created and running
2. ✅ Python service already separate (good!)
3. ⏳ Update frontend to optionally use backend API
4. ⏳ Keep Google Places search in frontend (as requested)

