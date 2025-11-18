# Backend API Testing Guide

## Testing the Grocery Search Endpoint

### Endpoint
```
POST http://localhost:3001/api/grocery/search
```

### Request Body Format

#### Basic Request (with address and zipCode)
```json
{
  "items": ["mazola corn oil"],
  "address": "Plano, TX 75023, USA",
  "zipCode": "75023",
  "nearbyStores": ["Kroger", "Walmart", "ALDI", "Tom Thumb"]
}
```

#### With Latitude and Longitude
```json
{
  "items": ["mazola corn oil"],
  "address": "Plano, TX 75023, USA",
  "zipCode": "75023",
  "latitude": 33.0198,
  "longitude": -96.6989,
  "nearbyStores": ["Kroger", "Walmart", "ALDI", "Tom Thumb"]
}
```

### Example Test Using cURL

#### Basic Test (Address only)
```bash
curl -X POST http://localhost:3001/api/grocery/search \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["mazola corn oil"],
    "address": "Plano, TX 75023, USA",
    "zipCode": "75023",
    "nearbyStores": ["Kroger", "Walmart", "ALDI"]
  }'
```

#### Test with Latitude/Longitude
```bash
curl -X POST http://localhost:3001/api/grocery/search \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["mazola corn oil"],
    "address": "Plano, TX 75023, USA",
    "zipCode": "75023",
    "latitude": 33.0198,
    "longitude": -96.6989,
    "nearbyStores": ["Kroger", "Walmart", "ALDI", "Tom Thumb"]
  }'
```

### Example Test Using Postman

1. **Method**: POST
2. **URL**: `http://localhost:3001/api/grocery/search`
3. **Headers**:
   - `Content-Type: application/json`
4. **Body** (raw JSON):
```json
{
  "items": ["mazola corn oil", "whole milk 1 gallon"],
  "address": "Plano, TX 75023, USA",
  "zipCode": "75023",
  "latitude": 33.0198,
  "longitude": -96.6989,
  "nearbyStores": [
    "Kroger",
    "Walmart",
    "Walmart Neighborhood Market",
    "ALDI",
    "Tom Thumb",
    "H-E-B",
    "Target"
  ]
}
```

### Example Test Using JavaScript/Fetch

```javascript
const testBackendAPI = async () => {
  const response = await fetch('http://localhost:3001/api/grocery/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: ['mazola corn oil'],
      address: 'Plano, TX 75023, USA',
      zipCode: '75023',
      latitude: 33.0198,
      longitude: -96.6989,
      nearbyStores: ['Kroger', 'Walmart', 'ALDI', 'Tom Thumb']
    })
  });

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
};

testBackendAPI();
```

### Example Test Using Python (requests)

```python
import requests
import json

url = "http://localhost:3001/api/grocery/search"

payload = {
    "items": ["mazola corn oil"],
    "address": "Plano, TX 75023, USA",
    "zipCode": "75023",
    "latitude": 33.0198,
    "longitude": -96.6989,
    "nearbyStores": ["Kroger", "Walmart", "ALDI", "Tom Thumb"]
}

headers = {
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
print(json.dumps(response.json(), indent=2))
```

### Expected Response Format

```json
{
  "success": true,
  "query": {
    "items": ["mazola corn oil"],
    "location": {
      "address": "Plano, TX 75023, USA",
      "zipCode": "75023"
    }
  },
  "stores": {
    "Walmart": {
      "products": [
        {
          "item": "mazola corn oil",
          "product": {
            "title": "Mazola Corn Oil 40 fl oz",
            "extractedPrice": 4.98,
            "source": "Walmart",
            "thumbnail": "...",
            "productLink": "..."
          },
          "exact_match": true
        }
      ],
      "totalPrice": 4.98
    },
    "Kroger": {
      "products": [...],
      "totalPrice": 5.29
    }
  },
  "pythonMatches": {
    "store_matches": {...},
    "stores_needing_ai": []
  },
  "processing_time_ms": 1234
}
```

### Common Locations for Testing

#### Plano, TX
- **Latitude**: 33.0198
- **Longitude**: -96.6989
- **Zip Code**: 75023
- **Address**: "Plano, TX 75023, USA"

#### Dallas, TX
- **Latitude**: 32.7767
- **Longitude**: -96.7970
- **Zip Code**: 75201
- **Address**: "Dallas, TX 75201, USA"

#### Austin, TX
- **Latitude**: 30.2672
- **Longitude**: -97.7431
- **Zip Code**: 78701
- **Address**: "Austin, TX 78701, USA"

### Testing Tips

1. **Start with a single item** to see the response structure
2. **Add multiple items** to test batch processing
3. **Test with and without lat/long** to see if results differ
4. **Test with different store lists** to see fuzzy matching
5. **Check the logs** in the backend terminal to see the processing flow

### Troubleshooting

- **404 Error**: Make sure the backend server is running on port 3001
- **400 Error**: Check that all required fields (items, address, zipCode) are provided
- **500 Error**: Check backend logs for Python service availability
- **No results**: Verify the HasData API key is set and the location is valid

