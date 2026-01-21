# Environment Variables Setup Guide

This project uses a **single `.env` file** at the project root for all API keys and configuration. This ensures centralized management and security.

## Quick Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and add your actual API keys:**
   ```env
   HASDATA_API_KEY=your-actual-key-here
   UNWRANGLE_API_KEY=your-actual-key-here
   OPENAI_API_KEY=your-actual-key-here
   GOOGLE_PLACES_API_KEY=your-actual-key-here
   ```

3. **The `.env` file is automatically loaded by:**
   - Frontend (Expo/React Native) - Uses `EXPO_PUBLIC_*` prefixed variables
   - Backend (Node.js) - Loads from root `.env` automatically
   - Python Service - Loads from root `.env` automatically

## Environment Variables

### Required API Keys

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `HASDATA_API_KEY` | HasData API for product search | https://hasdata.com |
| `UNWRANGLE_API_KEY` | Unwrangle API for product details | https://unwrangle.com |
| `OPENAI_API_KEY` | OpenAI API for AI features | https://platform.openai.com |
| `GOOGLE_PLACES_API_KEY` | Google Places API for store discovery | https://console.cloud.google.com |

### Frontend Variables (Expo)

For Expo/React Native, variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the frontend:

```env
EXPO_PUBLIC_BACKEND_URL=http://104.248.75.168:3001
EXPO_PUBLIC_PYTHON_SERVICE_URL=http://104.248.75.168:8000
```

### Backend Variables

```env
PORT=3001
FRONTEND_URL=http://localhost:8081
NODE_ENV=development
PYTHON_SERVICE_URL=http://localhost:8000
```

### Database Variables (Optional)

```env
ENABLE_DATABASE=false
DB_HOST=your-db-host.db.ondigitalocean.com
DB_PORT=25060
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=pricewise
DB_SSL=true
```

## How It Works

### Frontend (Expo/React Native)
- Variables prefixed with `EXPO_PUBLIC_` are bundled into the app
- Access via `process.env.EXPO_PUBLIC_*`
- See `config/api.ts` for configuration

### Backend (Node.js)
- Loads `.env` from project root automatically
- Access via `process.env.*`
- See `backend/src/server.ts` for loading logic

### Python Service
- Loads `.env` from project root automatically
- Access via `os.environ.get()`
- See `services/product_matcher_service.py` for loading logic

## Security Notes

1. **Never commit `.env` to version control**
   - The `.env` file is in `.gitignore`
   - Only commit `.env.example` as a template

2. **Use different keys for development and production**
   - Create separate `.env` files for each environment
   - Use environment-specific values in production

3. **Rotate keys regularly**
   - Update API keys in `.env` when rotating credentials
   - All services will automatically pick up the new values

## Troubleshooting

### API keys not working?

1. **Check `.env` file exists at project root:**
   ```bash
   ls -la .env
   ```

2. **Verify variables are set correctly:**
   ```bash
   # Backend
   cd backend
   npm run dev
   # Should see: "✅ Loaded .env from project root"
   
   # Python Service
   cd services
   python product_matcher_service.py
   # Should see: "✅ Loaded .env from workspace root"
   ```

3. **For Expo frontend, restart the dev server:**
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart
   npm run dev
   ```

4. **Check for typos in variable names:**
   - Variable names are case-sensitive
   - No spaces around the `=` sign
   - No quotes needed (unless value contains spaces)

### Variables not accessible in frontend?

- Ensure variables are prefixed with `EXPO_PUBLIC_`
- Restart Expo dev server after changing `.env`
- Check `config/api.ts` for correct variable names

## Migration from Old Setup

If you previously had API keys in:
- `config/api.ts` (hardcoded) → Now uses `.env`
- `backend/.env` → Now uses root `.env`
- `services/.env` → Now uses root `.env`

**Action required:** Copy your API keys to the root `.env` file.
