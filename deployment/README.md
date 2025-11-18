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

## Troubleshooting

See `DIGITALOCEAN_DEPLOYMENT.md` for detailed troubleshooting steps.

