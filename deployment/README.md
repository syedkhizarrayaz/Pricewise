# Pricewise Deployment Scripts

Complete deployment solution for DigitalOcean Ubuntu servers.

## Quick Start

1. **Transfer files to server** (see `FILE_TRANSFER_GUIDE.md`)
2. **Run quick deployment:**
   ```bash
   cd /opt/pricewise
   sudo chmod +x deployment/*.sh
   sudo ./deployment/quick-deploy.sh
   ```

## Scripts Overview

### `setup-database.sh`
- Installs MySQL Server
- Creates `pricewise` database
- Creates database user
- Imports schema
- Saves credentials securely

### `setup-python-service.sh`
- Installs Python 3 and dependencies
- Creates virtual environment
- Sets up systemd service
- Starts Python service on port 8000

### `setup-node-backend.sh`
- Installs Node.js 20.x LTS
- Installs PM2 process manager
- Builds TypeScript
- Sets up PM2 ecosystem
- Starts backend on port 3001

### `quick-deploy.sh`
- Runs all setup scripts in sequence
- Checks service health
- Provides status summary

## Manual Deployment

If you prefer to run scripts individually:

```bash
# 1. Database
sudo ./deployment/setup-database.sh

# 2. Python Service
sudo ./deployment/setup-python-service.sh

# 3. Node.js Backend
sudo ./deployment/setup-node-backend.sh
```

## Documentation

- **`DIGITALOCEAN_DEPLOYMENT.md`** - Complete deployment guide
- **`FILE_TRANSFER_GUIDE.md`** - How to transfer files to server

## Service Management

### Python Service (systemd)
```bash
sudo systemctl start|stop|restart|status pricewise-python
sudo journalctl -u pricewise-python -f
```

### Node.js Backend (PM2)
```bash
pm2 start|stop|restart|status pricewise-backend
pm2 logs pricewise-backend
```

## Testing

```bash
# Python service
curl http://localhost:8000/health

# Backend
curl http://localhost:3001/api/health
```

### Cache mode (Redis first, memory fallback)

Backend caching no longer depends on MySQL:
- If `REDIS_URL` is set and reachable → Redis cache
- Else → in-memory cache

Recommended env:
```env
PRICE_CACHE_TTL_SECONDS=86400
REDIS_URL=redis://localhost:6379
```

## Troubleshooting

See `DIGITALOCEAN_DEPLOYMENT.md` for detailed troubleshooting steps.

## DigitalOcean Docker (Backend, simplified flow)

Use the dedicated backend container image:
- `deployment/digitalocean/Dockerfile`

This image runs only the Node backend (`/api/grocery/search` + `/api/grocery/compare-unified`)
with the new simplified pipeline (HasData + OpenAI selection). Python matcher/Gemini reconcile
paths are not required for this runtime flow.

Build from repo root:
```bash
docker build -f deployment/digitalocean/Dockerfile -t pricewise-backend:latest .
```

Run:
```bash
docker run -d --name pricewise-backend \
  -p 3001:3001 \
  --restart unless-stopped \
  pricewise-backend:latest
```

## Hugging Face Spaces (Docker)

For quick hosted backend testing (client + TestFlight) you can deploy a single
container that runs:
- Python matcher on internal `:8000`
- Node backend on public `:7860`

Files:
- `deployment/huggingface/Dockerfile`
- `deployment/huggingface/start.sh`

### Space setup

1. Create a new Hugging Face Space with **SDK: Docker**.
2. Copy these folders into the Space repo root:
   - `backend/`
   - `services/`
   - `deployment/huggingface/`
3. In the Space repo, place Docker artifacts at root:
   ```bash
   cp deployment/huggingface/Dockerfile .
   cp deployment/huggingface/start.sh .
   ```
4. Add Space variables/secrets:
   - `HASDATA_API_KEY` (required for live prices)
   - `UNWRANGLE_API_KEY` (optional provider)
   - `OPENAI_API_KEY` (optional OpenAI fallback/reconcile)
   - `GEMINI_API_KEY` (optional Gemini draft/reconcile)
   - `FRONTEND_URL` (optional; use your app origin or `*` for testing)
   - `ENABLE_DATABASE=false` (recommended for Space testing)

### Health check

After deployment, verify:
```bash
curl https://<your-space-subdomain>.hf.space/api/health
```

Then point `client_app_v2` to:
```env
VITE_BACKEND_URL=https://<your-space-subdomain>.hf.space
```

