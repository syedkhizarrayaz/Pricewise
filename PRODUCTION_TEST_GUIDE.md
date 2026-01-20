# Production Testing Guide

## Server Information

- **Server IP**: `104.248.75.168`
- **Backend API**: `http://104.248.75.168:3001`
- **Python Service**: `http://104.248.75.168:8000`

## Configuration Updated

The application has been configured to use the production server:

- ✅ `config/api.ts` - Updated with production URLs
- ✅ Backend service will use: `http://104.248.75.168:3001`
- ✅ Python service will use: `http://104.248.75.168:8000`

## Testing Steps

### 1. Verify Server is Running

```bash
# Test Backend Health
curl http://104.248.75.168:3001/api/health

# Test Python Service Health
curl http://104.248.75.168:8000/health
```

Expected responses:
- Backend: `{"status":"healthy","python_service":"connected","database":"connected"}`
- Python: `{"status":"healthy"}`

### 2. Test from Frontend

1. **Start the Expo app:**
   ```bash
   npx expo start
   ```

2. **Test on device/emulator:**
   - The app will automatically connect to the production server
   - Try searching for products
   - Check console logs for connection status

3. **Check console logs:**
   - Look for: `🔗 [BackendAPI] Using backend URL from config: http://104.248.75.168:3001`
   - Look for: `🔗 [PythonMatcher] Using Python service URL from config: http://104.248.75.168:8000`

### 3. Test Full Search Flow

1. Open the app
2. Enter a location (e.g., "Plano, TX 75074")
3. Enter items to search (e.g., "Mazola Corn Oil")
4. Tap search
5. Verify results are returned from the production server

### 4. Test with cURL (Optional)

```bash
curl -X POST http://104.248.75.168:3001/api/grocery/search \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["Mazola Corn Oil"],
    "address": "Plano, TX 75074",
    "zipCode": "75074",
    "nearbyStores": ["Walmart", "Kroger"]
  }'
```

## Troubleshooting

### Connection Issues

If you see connection errors:

1. **Check firewall:**
   ```bash
   # On server, verify ports are open
   sudo ufw status
   ```

2. **Check services are running:**
   ```bash
   # SSH into server
   ssh root@104.248.75.168
   
   # Check Python service
   sudo systemctl status pricewise-python
   
   # Check Backend service
   pm2 status
   ```

3. **Check logs:**
   ```bash
   # Python service logs
   sudo journalctl -u pricewise-python -n 50
   
   # Backend logs
   pm2 logs pricewise-backend --lines 50
   ```

### Network Errors

If you see "Network request failed":

1. Verify the server IP is correct: `104.248.75.168`
2. Check if ports 3001 and 8000 are accessible from your network
3. Try accessing the health endpoints in a browser:
   - http://104.248.75.168:3001/api/health
   - http://104.248.75.168:8000/health

### SSL/HTTPS Issues

If you need HTTPS (recommended for production):

1. Set up Nginx reverse proxy (see `deployment/DIGITALOCEAN_DEPLOYMENT.md`)
2. Configure SSL with Let's Encrypt
3. Update `config/api.ts` to use `https://` instead of `http://`

## Next Steps: APK Build

Once testing is complete:

1. ✅ Verify all features work with production server
2. ✅ Test on physical device
3. ✅ Test on Android emulator
4. ✅ Test on iOS simulator (if applicable)
5. ✅ Generate APK build

## Environment Variables (Optional)

If you want to override the URLs via environment variables:

```bash
# In your .env file or Expo config
EXPO_PUBLIC_BACKEND_URL=http://104.248.75.168:3001
EXPO_PUBLIC_PYTHON_SERVICE_URL=http://104.248.75.168:8000
```

This will override the config file values.

