# Finding Your Machine's IP Address

When running React Native on mobile devices or emulators, you need to use your machine's IP address instead of `localhost` to connect to backend services.

## Quick Commands

### Windows
```powershell
ipconfig | findstr IPv4
```

### Mac/Linux
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# OR
ip addr show | grep "inet " | grep -v 127.0.0.1
```

## Platform-Specific URLs

### Web (Browser)
- ✅ `http://localhost:3001` - Works fine
- ✅ `http://localhost:8000` - Works fine

### iOS Simulator
- ✅ `http://localhost:3001` - Usually works
- ✅ `http://localhost:8000` - Usually works
- ✅ `http://127.0.0.1:3001` - Alternative

### Android Emulator
- ❌ `http://localhost:3001` - **Won't work!**
- ✅ `http://10.0.2.2:3001` - **Use this!** (special alias for host)
- ✅ `http://10.0.2.2:8000` - **Use this!** (special alias for host)

### Physical Devices (iOS/Android)
- ❌ `http://localhost:3001` - **Won't work!**
- ✅ `http://YOUR_MACHINE_IP:3001` - **Use your actual IP!**
- ✅ `http://YOUR_MACHINE_IP:8000` - **Use your actual IP!**
- Example: `http://192.168.1.9:3001`

## Updating Configuration

Edit `config/api.ts`:

```typescript
export const API_CONFIG = {
  // For Android Emulator, use:
  BACKEND_URL: 'http://10.0.2.2:3001',
  PYTHON_SERVICE_URL: 'http://10.0.2.2:8000',
  
  // For Physical Devices, use your machine's IP:
  // BACKEND_URL: 'http://192.168.1.9:3001',
  // PYTHON_SERVICE_URL: 'http://192.168.1.9:8000',
  
  // For Web/iOS Simulator, localhost works:
  // BACKEND_URL: 'http://localhost:3001',
  // PYTHON_SERVICE_URL: 'http://localhost:8000',
};
```

Or use environment variables:
```bash
# .env file
EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:3001
EXPO_PUBLIC_PYTHON_SERVICE_URL=http://10.0.2.2:8000
```

## Testing Your IP Address

Once you find your IP, test it:
```bash
# Test backend
curl http://YOUR_IP:3001/api/health

# Test Python service
curl http://YOUR_IP:8000/health
```

## Common Issues

1. **Firewall blocking connections**: Make sure your firewall allows incoming connections on ports 3001 and 8000
2. **Wrong IP address**: Make sure you're using the IP address of the network interface your device is connected to (WiFi, not VPN)
3. **Services not running**: Make sure both backend and Python services are running and accessible

