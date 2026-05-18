# API Endpoint Testing Guide

This guide explains how to test all endpoints in the Pricewise application.

## Test Scripts

Two test scripts are provided:

1. **`test-endpoints.js`** - Node.js version (recommended)
   - More detailed output
   - Better error handling
   - JSON response parsing
   - Color-coded output

2. **`test-endpoints.sh`** - Bash version
   - Simple curl-based tests
   - Works on Unix-like systems
   - Lightweight

## Quick Start

### Node.js Version (Recommended)

```bash
# Install Node.js if not already installed
# Then run:

# Test local servers (default)
node test-endpoints.js

# Test with custom backend URL
node test-endpoints.js http://localhost:3001

# Test external servers
node test-endpoints.js http://104.248.75.168:3001 http://104.248.75.168:8000

# Test specific environment
node test-endpoints.js http://your-backend-url:3001 http://your-python-url:8000
```

### Bash Version

```bash
# Make executable (first time only)
chmod +x test-endpoints.sh

# Test local servers (default)
./test-endpoints.sh

# Test with custom URLs
./test-endpoints.sh http://104.248.75.168:3001 http://104.248.75.168:8000
```

## Architecture

```
Frontend (Expo/React Native)
    ↓
Backend (Node.js/Express) - Port 3001
    ↓
Python Service (FastAPI) - Port 8000
```

### Frontend → Backend Communication

The frontend only communicates with the backend. The backend handles all third-party API calls and communicates with the Python service.

## Endpoints Tested

### Backend Endpoints (Node.js)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint - API info |
| `/api/health` | GET | Health check with database status |
| `/api/grocery/health` | GET | Grocery service health |
| `/api/grocery/search` | POST | Main grocery price search |
| `/api/analytics` | GET | Get analytics data |
| `/api/analytics/queries` | GET | Get query statistics |
| `/api/analytics/clean-cache` | POST | Clean expired cache |

### Python Service Endpoints (FastAPI)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/match-products` | POST | Match products from HasData results |
| `/match-products-for-stores` | POST | Match products for multiple stores |
| `/match-multiple-products` | POST | Batch match multiple products |

## Example Test Output

```
╔═══════════════════════════════════════════════════════════╗
║         Pricewise API Endpoint Test Suite                ║
╚═══════════════════════════════════════════════════════════╝

Configuration:
  Backend URL: http://localhost:3001
  Python URL:  http://localhost:8000

═══════════════════════════════════════════════════════
  BACKEND API TESTS (http://localhost:3001)
═══════════════════════════════════════════════════════

Testing: Root Endpoint
URL: http://localhost:3001/
✓ PASSED (45ms)
Status: 200

Testing: Health Check
URL: http://localhost:3001/api/health
✓ PASSED (12ms)
Status: 200

...

═══════════════════════════════════════════════════════
  TEST SUMMARY
═══════════════════════════════════════════════════════

Passed: 12
Failed: 0
Skipped: 0
Total: 12
```

## Manual Testing

### Using curl

#### Backend Health Check
```bash
curl http://localhost:3001/api/health
```

#### Grocery Search
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

#### Python Service Health
```bash
curl http://localhost:8000/health
```

#### Python Match Products
```bash
curl -X POST http://localhost:8000/match-products \
  -H "Content-Type: application/json" \
  -d '{
    "query": "whole milk 1 gallon",
    "hasdata_results": [
      {
        "position": 1,
        "title": "Great Value Whole Milk 1 gal",
        "extractedPrice": 2.57,
        "source": "Walmart"
      }
    ]
  }'
```

### Using Postman

1. Import the collection (create from examples above)
2. Set environment variables:
   - `backend_url`: `http://localhost:3001`
   - `python_url`: `http://localhost:8000`
3. Run the collection

## Testing Different Environments

### Local Development
```bash
node test-endpoints.js http://localhost:3001 http://localhost:8000
```

### Staging/Production
```bash
node test-endpoints.js http://104.248.75.168:3001 http://104.248.75.168:8000
```

### Mixed (Local Backend, Remote Python)
```bash
node test-endpoints.js http://localhost:3001 http://104.248.75.168:8000
```

## Troubleshooting

### Connection Refused
- Ensure backend is running: `cd backend && npm run dev`
- Ensure Python service is running: `cd services && python product_matcher_service.py`
- Check ports are not in use: `netstat -an | grep -E '3001|8000'`

### Timeout Errors
- Check firewall settings
- Verify network connectivity
- Increase timeout in test script if needed

### Authentication Errors
- Verify API keys are set in `.env` file
- Check backend logs for API key validation errors

### Python Service Not Available
- The backend will fallback to HasData results only
- Check Python service logs
- Verify Python service URL in backend `.env`

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Test API Endpoints
  run: |
    node test-endpoints.js http://localhost:3001 http://localhost:8000
```

## Next Steps

1. **Streamline Frontend**: Update frontend to only call backend endpoints
2. **Remove Direct Python Calls**: Frontend should not call Python service directly
3. **Add Authentication**: Add API key or token authentication
4. **Rate Limiting**: Add rate limiting to prevent abuse
5. **Monitoring**: Add endpoint monitoring and alerting
