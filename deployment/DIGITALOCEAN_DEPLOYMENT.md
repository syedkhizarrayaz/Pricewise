# DigitalOcean Deployment Guide

Complete guide for deploying Pricewise on a DigitalOcean Ubuntu server.

## Prerequisites

- DigitalOcean Ubuntu 22.04 LTS droplet (or similar)
- Root or sudo access
- Domain name (optional, for SSL)
- API keys ready:
  - HasData API Key
  - Unwrangle API Key
  - OpenAI API Key
  - Google Places API Key (for frontend)

## Server Setup

### 1. Initial Server Configuration

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install essential tools
sudo apt-get install -y curl wget git build-essential

# Set timezone (optional)
sudo timedatectl set-timezone America/New_York
```

### 2. Firewall Configuration

```bash
# Allow SSH (if not already configured)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS (for future nginx setup)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow backend API port
sudo ufw allow 3001/tcp

# Allow Python service port
sudo ufw allow 8000/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

## Deployment Steps

### Step 1: Clone Repository

```bash
# Navigate to opt directory
cd /opt

# Clone your repository (replace with your repo URL)
git clone <your-repository-url> pricewise
cd pricewise

# Or if you're uploading files manually, create the directory:
# mkdir -p /opt/pricewise
# Upload your files to /opt/pricewise
```

### Step 2: Setup MySQL Database

```bash
# Make script executable
chmod +x deployment/setup-database.sh

# Run database setup
sudo ./deployment/setup-database.sh
```

The script will:
- Install MySQL Server
- Create the `pricewise` database
- Create a database user
- Import the schema from `backend/database/schema.sql`
- Save credentials to `/root/pricewise-db-credentials.txt`

**Note:** Make sure to save the database credentials shown at the end!

### Step 3: Deploy Python Service

```bash
# Make script executable
chmod +x deployment/setup-python-service.sh

# Run Python service deployment
sudo ./deployment/setup-python-service.sh
```

The script will:
- Install Python 3 and pip
- Create a virtual environment
- Install Python dependencies
- Create a systemd service
- Start the service on port 8000

**Verify Python service:**
```bash
# Check service status
sudo systemctl status pricewise-python

# Test the health endpoint
curl http://localhost:8000/health
```

### Step 4: Deploy Node.js Backend

```bash
# Make script executable
chmod +x deployment/setup-node-backend.sh

# Run backend deployment
sudo ./deployment/setup-node-backend.sh
```

The script will:
- Install Node.js 20.x LTS
- Install PM2 process manager
- Install backend dependencies
- Build TypeScript
- Create PM2 ecosystem file
- Start the service on port 3001

**Verify backend:**
```bash
# Check PM2 status
pm2 status

# Test the health endpoint
curl http://localhost:3001/api/health
```

## Configuration

### Environment Variables

#### Python Service (`/opt/pricewise/services/.env`)

```env
OPENAI_API_KEY=your-openai-api-key-here
```

#### Node.js Backend (`/opt/pricewise/backend/.env`)

```env
# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:8081

# Database Configuration
ENABLE_DATABASE=true
DB_HOST=localhost
DB_PORT=3306
DB_USER=pricewise_user
DB_PASSWORD=your-db-password
DB_NAME=pricewise
DB_SSL=false

# API Keys
HASDATA_API_KEY=your-hasdata-api-key
UNWRANGLE_API_KEY=your-unwrangle-api-key
OPENAI_API_KEY=your-openai-api-key

# Service URLs
PYTHON_SERVICE_URL=http://localhost:8000
```

### Update Frontend Configuration

Update your frontend `config/api.ts` to point to your DigitalOcean server:

```typescript
export const API_CONFIG = {
  BACKEND_URL: 'http://YOUR_SERVER_IP:3001',
  PYTHON_SERVICE_URL: 'http://YOUR_SERVER_IP:8000',
  // ... other config
};
```

Or use environment variables:
```bash
EXPO_PUBLIC_BACKEND_URL=http://YOUR_SERVER_IP:3001
EXPO_PUBLIC_PYTHON_SERVICE_URL=http://YOUR_SERVER_IP:8000
```

## Service Management

### Python Service (systemd)

```bash
# Start
sudo systemctl start pricewise-python

# Stop
sudo systemctl stop pricewise-python

# Restart
sudo systemctl restart pricewise-python

# Status
sudo systemctl status pricewise-python

# View logs
sudo journalctl -u pricewise-python -f
# Or
tail -f /opt/pricewise/logs/python-service.log
```

### Node.js Backend (PM2)

```bash
# Start
pm2 start pricewise-backend

# Stop
pm2 stop pricewise-backend

# Restart
pm2 restart pricewise-backend

# Status
pm2 status

# View logs
pm2 logs pricewise-backend
# Or
tail -f /opt/pricewise/logs/backend-out.log

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot (if not already done)
pm2 startup systemd
```

## Testing

### Test Python Service

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status":"healthy"}
```

### Test Backend API

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "python_service": "connected",
  "database": "connected"
}
```

### Test Full Search Endpoint

```bash
curl -X POST http://localhost:3001/api/grocery/search \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["Mazola Corn Oil"],
    "address": "Plano, TX 75074",
    "zipCode": "75074",
    "nearbyStores": ["Walmart", "Kroger"]
  }'
```

## Optional: Nginx Reverse Proxy

For production, set up Nginx as a reverse proxy:

### Install Nginx

```bash
sudo apt-get install -y nginx
```

### Configure Nginx

Create `/etc/nginx/sites-available/pricewise`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Python Service (if needed externally)
    location /python {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/pricewise /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Optional: SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

## Monitoring

### Check Service Health

```bash
# Python service
curl http://localhost:8000/health

# Backend
curl http://localhost:3001/api/health
```

### View Logs

```bash
# Python service logs
sudo journalctl -u pricewise-python -n 100

# Backend logs
pm2 logs pricewise-backend --lines 100
```

### Database Status

```bash
# Connect to MySQL
mysql -u pricewise_user -p pricewise

# Check tables
SHOW TABLES;

# Check cache entries
SELECT COUNT(*) FROM query_cache;

# Check recent queries
SELECT * FROM user_queries ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

### Python Service Not Starting

```bash
# Check logs
sudo journalctl -u pricewise-python -n 50

# Check if port is in use
sudo netstat -tulpn | grep 8000

# Verify virtual environment
ls -la /opt/pricewise/services/venv
```

### Backend Not Starting

```bash
# Check PM2 logs
pm2 logs pricewise-backend

# Check if port is in use
sudo netstat -tulpn | grep 3001

# Verify build
ls -la /opt/pricewise/backend/dist
```

### Database Connection Issues

```bash
# Test database connection
mysql -u pricewise_user -p pricewise -e "SELECT 1;"

# Check MySQL status
sudo systemctl status mysql

# Check database credentials in .env
cat /opt/pricewise/backend/.env | grep DB_
```

### Port Already in Use

```bash
# Find process using port
sudo lsof -i :3001
sudo lsof -i :8000

# Kill process if needed
sudo kill -9 <PID>
```

## Backup

### Database Backup

```bash
# Create backup script
cat > /opt/pricewise/backup-db.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/pricewise/backups"
mkdir -p $BACKUP_DIR
mysqldump -u pricewise_user -p'YOUR_PASSWORD' pricewise > $BACKUP_DIR/pricewise_$(date +%Y%m%d_%H%M%S).sql
# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
EOF

chmod +x /opt/pricewise/backup-db.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/pricewise/backup-db.sh") | crontab -
```

## Security Checklist

- [ ] Firewall configured (UFW)
- [ ] Database user has limited privileges
- [ ] API keys stored in .env files (not in code)
- [ ] .env files have restricted permissions (600)
- [ ] Services running as non-root user
- [ ] SSL certificate installed (if using domain)
- [ ] Regular backups configured
- [ ] Logs monitored regularly

## Next Steps

1. Update frontend to use production server URLs
2. Set up monitoring (e.g., PM2 monitoring, log aggregation)
3. Configure automatic backups
4. Set up SSL certificates
5. Configure domain DNS records
6. Test all endpoints from external network

## Support

For issues, check:
- Service logs (see Monitoring section)
- Database connection status
- Firewall rules
- Port availability
- Environment variables

