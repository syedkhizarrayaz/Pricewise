# Frontend-Backend Migration Guide

## Summary

The frontend has been updated to use the backend API instead of calling third-party services directly.

## What Changed

### ✅ Updated Files
- `services/groceryPriceService.ts` - Now calls backend API first, falls back to direct calls if backend unavailable
- `services/backendApiService.ts` - Client service for backend API
- `config/api.ts` - Added `BACKEND_URL` configuration

### ✅ What Stayed the Same (As Requested)
- **Google Places Search** - Remains in frontend, unchanged (working correctly)

## Flow

1. **User searches** → Frontend calls `groceryPriceService.fetchGroceryPrices()`
2. **Google Places** → Still called from frontend (unchanged)
3. **Backend API** → Called for product search and matching
4. **Fallback** → If backend unavailable, falls back to direct service calls

## Configuration

### Option 1: Update config/api.ts
```typescript
export const API_CONFIG = {
  BACKEND_URL: 'http://192.168.1.9:3001', // Use your machine's IP
  // ... other config
};
```

### Option 2: Use Environment Variable
Create `.env` file in project root:
```
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.9:3001
```

**Note**: For React Native, you **must** use your machine's IP address instead of `localhost`.

## Testing

### With Backend (Recommended)
1. Start backend: `cd backend && npm run dev`
2. Start Python service: `cd services && python product_matcher_service.py`
3. Frontend will automatically use backend API

### Without Backend (Fallback)
If backend is not running, frontend will automatically fall back to direct service calls (old behavior).

## Verification

Check logs in frontend:
- `📡 [GroceryPrice] Using backend API for product search` = Using backend ✅
- `⚠️ [GroceryPrice] Backend API not available` = Fallback mode

## Benefits

✅ **Single API Call** - Backend handles all third-party API calls
✅ **Better Organization** - Clear separation of concerns
✅ **Testable** - Can test entire app via backend API
✅ **Backward Compatible** - Falls back to old method if backend unavailable

