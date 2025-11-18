# Pricewise Architecture

## Overview

The application is now separated into three independent modules:

1. **Frontend** - React Native/Expo app
2. **Backend API** - Express.js server managing third-party API calls
3. **Python Service** - Product matching service (already separate)

## Architecture Diagram

```
┌─────────────────┐
│   Frontend      │
│  (React Native) │
│                 │
│  - UI/UX        │
│  - User Input   │
│  - Display      │
└────────┬────────┘
         │ HTTP REST API
         │
         ▼
┌─────────────────┐
│   Backend API   │
│   (Express.js)  │
│                 │
│  - HasData API  │
│  - Unwrangle    │
│  - Orchestration│
└────────┬────────┘
         │ HTTP REST API
         │
         ▼
┌─────────────────┐
│ Python Service  │
│  (FastAPI)      │
│                 │
│  - LLM Matching │
│  - Product Logic│
│  - Priority     │
└─────────────────┘
```

## Module Details

### 1. Frontend (React Native/Expo)
**Location**: Root directory (`app/`, `components/`, `hooks/`)

**Responsibilities**:
- User interface and interactions
- Form inputs (items, location)
- Display results
- Google Places search (exception - stays as-is)

**API Calls**: 
- Calls Backend API at `http://localhost:3001/api/grocery/search`
- No direct third-party API calls

### 2. Backend API (Express.js)
**Location**: `backend/`

**Responsibilities**:
- Manage all third-party API calls
- Coordinate HasData and Unwrangle APIs
- Call Python service for product matching
- Aggregate and format results

**Services**:
- `hasDataService.ts` - HasData API integration
- `unwrangleService.ts` - Unwrangle API integration  
- `pythonMatcherService.ts` - Python service client

**Port**: 3001

### 3. Python Service (FastAPI)
**Location**: `services/product_matcher_service.py`

**Responsibilities**:
- LLM-based product component extraction
- Priority-based product matching
- Store-specific product selection

**Port**: 8000

## API Flow

1. **User searches for products** → Frontend
2. **Frontend calls Backend API** → `/api/grocery/search`
3. **Backend calls HasData API** → Get product listings
4. **Backend calls Python Service** → `/match-products-for-stores`
5. **Python Service uses LLM** → Extract brand/item/quantity
6. **Python Service matches products** → Priority-based selection
7. **Results flow back** → Backend → Frontend → User

## Testing Without Frontend

You can test the entire application by calling the backend API directly:

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

This single API call will:
1. Search HasData for products
2. Call Python service for matching
3. Return unified results

## Setup Instructions

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

### Python Service Setup
```bash
cd services
pip install -r requirements.txt
# Set OPENAI_API_KEY in .env
python product_matcher_service.py
# Or use: uvicorn product_matcher_service:app --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
npm install
# Update backend URL if needed
npm run dev
```

## Environment Variables

### Backend (.env)
```
PORT=3001
HASDATA_API_KEY=your-key
UNWRANGLE_API_KEY=your-key
OPENAI_API_KEY=your-key
PYTHON_SERVICE_URL=http://localhost:8000
```

### Python Service (.env)
```
OPENAI_API_KEY=your-key
```

## Exception: Google Places Search

Google Places search functionality remains in the frontend as-is because:
- It's working correctly
- User explicitly requested it to stay unchanged
- It's primarily for UI interaction (autocomplete, place selection)

## Benefits of This Architecture

1. **Separation of Concerns**: Each module has clear responsibilities
2. **Testability**: Can test entire app via single backend API call
3. **Scalability**: Backend can handle multiple frontends
4. **Security**: API keys stay on backend
5. **Modularity**: Easy to update/replace individual components

