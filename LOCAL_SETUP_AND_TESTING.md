# Local Setup and API Testing Guide

Complete guide to start the Pricewise system locally and test all APIs.

## Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**
- **API Keys** (HasData, Unwrangle, OpenAI, Google Places)

## Step 1: Environment Setup

### 1.1 Create `.env` File

Create a `.env` file at the project root (if it doesn't exist):

```bash
# Copy from example (if available)
cp .env.example .env
```

### 1.2 Add Your API Keys

Edit `.env` and add your API keys:

```env
# API Keys (Required)
HASDATA_API_KEY=your-hasdata-key-here
UNWRANGLE_API_KEY=your-unwrangle-key-here
OPENAI_API_KEY=your-openai-key-here
GOOGLE_PLACES_API_KEY=your-google-places-key-here

# Service URLs (Local)
EXPO_PUBLIC_BACKEND_URL=http://localhost:3001
EXPO_PUBLIC_PYTHON_SERVICE_URL=http://localhost:8000
PYTHON_SERVICE_URL=http://localhost:8000
PORT=3001

# Database (Optional - set to false if not using)
ENABLE_DATABASE=false
```

## Step 2: Install Dependencies

### 2.1 Backend Dependencies

```bash
cd backend
npm install
```

### 2.2 Python Service Dependencies

```bash
cd services
pip install -r requirements.txt
```

If `requirements.txt` doesn't exist, install manually:

```bash
pip install fastapi uvicorn python-dotenv openai
```

## Step 3: Start the Services

You need to start **3 services** in separate terminal windows:

### 3.1 Terminal 1: Python Service

```bash
cd services
python product_matcher_service.py
```

**Expected Output:**
```
✅ Loaded .env from workspace root
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Verify it's running:**
- Open browser: http://localhost:8000/health
- Should return: `{"status":"healthy"}`

### 3.2 Terminal 2: Backend API

```bash
cd backend
npm run dev
```

**Expected Output:**
```
✅ Loaded .env from project root
🚀 Backend server running on port 3001
📡 Python service URL: http://localhost:8000
```

**Verify it's running:**
- Open browser: http://localhost:3001/api/health
- Should return: `{"status":"ok","timestamp":"..."}`

### 3.3 Terminal 3: Frontend (Optional - for full testing)

```bash
# From project root
npm start
# or
npx expo start
```

## Step 4: Test the APIs

### 4.1 Quick Manual Tests

#### Test Python Service Health
```bash
curl http://localhost:8000/health
```

#### Test Backend Health
```bash
curl http://localhost:3001/api/health
```

#### Test Backend Grocery Search
```bash
curl -X POST http://localhost:3001/api/grocery/search \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["whole milk", "bread"],
    "address": "123 Main St, Plano, TX 75074",
    "zipCode": "75074",
    "latitude": 33.0198,
    "longitude": -96.6989,
    "nearbyStores": ["Walmart", "Kroger"]
  }'
```

### 4.2 Automated Test Script

Use the comprehensive test script:

```bash
# Test with default URLs (localhost)
node test-endpoints.js

# Test with custom backend URL
node test-endpoints.js http://localhost:3001

# Test with both custom URLs
node test-endpoints.js http://localhost:3001 http://localhost:8000

# Test external servers
node test-endpoints.js http://104.248.75.168:3001 http://104.248.75.168:8000
```

**What the test script does:**
- ✅ Tests all backend endpoints (health, grocery search, analytics)
- ✅ Tests all Python service endpoints (health, match-products, etc.)
- ✅ Tests integration between backend and Python service
- ✅ Validates request/response formats
- ✅ Shows colored output with pass/fail status

### 4.3 Test Results Interpretation

**Successful Test Output:**
```
✓ PASSED (123ms)
Status: 200
```

**Failed Test Output:**
```
✗ FAILED (5000ms)
Error: Request timeout
```

## Step 5: Verify System Flow

### 5.1 Complete Flow Test

1. **Frontend** → Calls Backend API
2. **Backend** → Calls HasData API
3. **Backend** → Calls Python Service for matching
4. **Backend** → Returns aggregated results

### 5.2 Test End-to-End

```bash
# Full integration test
curl -X POST http://localhost:3001/api/grocery/search \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["milk"],
    "address": "Plano, TX 75074",
    "zipCode": "75074"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "query": {
    "items": ["milk"],
    "location": {
      "address": "Plano, TX 75074",
      "zipCode": "75074"
    }
  },
  "stores": {
    "Walmart": {
      "products": [...],
      "totalPrice": 2.57
    }
  },
  "pythonMatches": {
    "store_matches": {...}
  },
  "processing_time_ms": 1234
}
```

## Troubleshooting

### Python Service Won't Start

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**
```bash
cd services
pip install fastapi uvicorn python-dotenv
```

**Error:** `Port 8000 already in use`

**Solution:**
- Find and kill the process: `lsof -ti:8000 | xargs kill`
- Or change port in `.env`: `PYTHON_SERVICE_URL=http://localhost:8001`

### Backend Won't Start

**Error:** `Cannot find module 'dotenv'`

**Solution:**
```bash
cd backend
npm install
```

**Error:** `Port 3001 already in use`

**Solution:**
- Find and kill the process: `lsof -ti:3001 | xargs kill`
- Or change port in `.env`: `PORT=3002`

### API Keys Not Working

**Error:** `HASDATA_API_KEY not found`

**Solution:**
1. Check `.env` file exists at project root
2. Verify variable name is correct (no typos)
3. Restart the service after changing `.env`
4. Check backend logs: Should see "✅ Loaded .env from project root"

### Python Service Not Found

**Error:** `Python service not available`

**Solution:**
1. Verify Python service is running: `curl http://localhost:8000/health`
2. Check `PYTHON_SERVICE_URL` in `.env` matches Python service port
3. Check firewall/network settings

### Test Script Fails

**Error:** `ECONNREFUSED`

**Solution:**
- Ensure both services are running
- Check URLs are correct
- Verify ports are not blocked

## Quick Reference

### Service URLs (Local)
- **Backend API:** http://localhost:3001
- **Python Service:** http://localhost:8000
- **Backend Health:** http://localhost:3001/api/health
- **Python Health:** http://localhost:8000/health

### Key Endpoints

**Backend:**
- `GET /api/health` - Health check
- `POST /api/grocery/search` - Main grocery search
- `GET /api/analytics` - Analytics data

**Python Service:**
- `GET /health` - Health check
- `POST /match-products` - Match single product
- `POST /match-products-for-stores` - Match for multiple stores

### Commands Cheat Sheet

```bash
# Start Python Service
cd services && python product_matcher_service.py

# Start Backend
cd backend && npm run dev

# Run Tests
node test-endpoints.js

# Check if services are running
curl http://localhost:8000/health
curl http://localhost:3001/api/health
```

## Next Steps

Once local testing is successful:

1. ✅ Test with real API keys
2. ✅ Verify all endpoints work
3. ✅ Test with frontend app
4. ✅ Deploy to production servers

## Support

If you encounter issues:
1. Check service logs for error messages
2. Verify `.env` file configuration
3. Ensure all dependencies are installed
4. Check network/firewall settings
5. Review the troubleshooting section above
