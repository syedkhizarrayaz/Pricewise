# Backend API Testing Guide - GPS Location

## Testing with GPS Coordinates (Latitude/Longitude)

When users use GPS to provide location, the app passes `latitude` and `longitude` to the backend API.

### Endpoint
```
POST http://localhost:3001/api/grocery/search
```

### Request Body Format with GPS

```json
{
  "items": ["mazola corn oil"],
  "address": "Plano, TX 75023, USA",
  "zipCode": "75023",
  "latitude": 33.0198,
  "longitude": -96.6989,
  "nearbyStores": ["Kroger", "Walmart", "ALDI"]
}
```

### How GPS Location is Used

1. **Frontend**: When user enables GPS, `useLocation()` hook gets coordinates
2. **Location Data**: `{ latitude, longitude, address, zipCode, city, state }`
3. **Backend API**: Receives `latitude` and `longitude` in request body
4. **Google Places API**: Uses coordinates to find nearby stores more accurately

### Example Test with GPS Coordinates

#### Using cURL
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

#### Using Postman
1. **Method**: POST
2. **URL**: `http://localhost:3001/api/grocery/search`
3. **Headers**: `Content-Type: application/json`
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
    "Walmart Neighborhood Market",
    "ALDI",
    "Tom Thumb",
    "H-E-B"
  ]
}
```

### Common GPS Coordinates for Testing

#### Plano, TX
```json
{
  "latitude": 33.0198,
  "longitude": -96.6989,
  "address": "Plano, TX 75023, USA",
  "zipCode": "75023"
}
```

#### Dallas, TX
```json
{
  "latitude": 32.7767,
  "longitude": -96.7970,
  "address": "Dallas, TX 75201, USA",
  "zipCode": "75201"
}
```

#### Austin, TX
```json
{
  "latitude": 30.2672,
  "longitude": -97.7431,
  "address": "Austin, TX 78701, USA",
  "zipCode": "78701"
}
```

#### Houston, TX
```json
{
  "latitude": 29.7604,
  "longitude": -95.3698,
  "address": "Houston, TX 77002, USA",
  "zipCode": "77002"
}
```

### Testing GPS vs Manual Location

To test the difference between GPS and manual location:

1. **GPS Location**: Include `latitude` and `longitude` in the request
2. **Manual Location**: Omit `latitude` and `longitude` (or set to `null`)

The backend will use coordinates for more accurate store discovery when available.

### Response Format

The response format remains the same whether using GPS or manual location:

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
      "products": [...],
      "totalPrice": 4.98
    }
  },
  "processing_time_ms": 1234
}
```

### Notes

- GPS coordinates are optional but improve accuracy
- If GPS is not provided, backend uses address/zipCode only
- Google Places API uses coordinates for better nearby store discovery
- Store results are the same format regardless of location source

