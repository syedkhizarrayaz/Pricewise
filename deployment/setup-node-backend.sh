#!/bin/bash
# Node.js Backend Deployment Script for DigitalOcean
# This script sets up the Node.js Express backend as a systemd service

set -e  # Exit on error

echo "🚀 Starting Node.js Backend Deployment..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Get project directory
read -p "Enter project directory (default: /opt/pricewise): " PROJECT_DIR
PROJECT_DIR=${PROJECT_DIR:-/opt/pricewise}

# Get service user
read -p "Enter service user (default: pricewise): " SERVICE_USER
SERVICE_USER=${SERVICE_USER:-pricewise}

# Create service user if it doesn't exist
if ! id "$SERVICE_USER" &>/dev/null; then
    echo "👤 Creating service user: $SERVICE_USER"
    useradd -r -s /bin/bash -d "$PROJECT_DIR" "$SERVICE_USER" || true
fi

# Install Node.js (using NodeSource repository for latest LTS)
echo "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install PM2 globally (process manager)
echo "📦 Installing PM2..."
npm install -g pm2

# Create project directory structure
echo "📁 Creating project directory structure..."
mkdir -p "$PROJECT_DIR/backend"
mkdir -p "$PROJECT_DIR/logs"

# Copy backend files
echo "📋 Copying backend files..."
if [ -d "backend" ]; then
    cp -r backend/* "$PROJECT_DIR/backend/"
else
    echo "❌ Backend directory not found. Please run from project root."
    exit 1
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd "$PROJECT_DIR/backend"
npm install --production

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Create .env file if it doesn't exist
if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
    echo "📝 Creating .env file..."
    read -p "Enter backend port (default: 3001): " BACKEND_PORT
    BACKEND_PORT=${BACKEND_PORT:-3001}
    
    read -p "Enter HasData API Key: " HASDATA_KEY
    read -p "Enter Unwrangle API Key: " UNWRANGLE_KEY
    read -p "Enter OpenAI API Key: " OPENAI_KEY
    
    read -p "Enter Python Service URL (default: http://localhost:8000): " PYTHON_URL
    PYTHON_URL=${PYTHON_URL:-http://localhost:8000}
    
    read -p "Enable database? (true/false, default: true): " ENABLE_DB
    ENABLE_DB=${ENABLE_DB:-true}
    
    if [ "$ENABLE_DB" = "true" ]; then
        read -p "Enter database host (default: localhost): " DB_HOST
        DB_HOST=${DB_HOST:-localhost}
        
        read -p "Enter database port (default: 3306): " DB_PORT
        DB_PORT=${DB_PORT:-3306}
        
        read -p "Enter database name: " DB_NAME
        read -p "Enter database user: " DB_USER
        read -sp "Enter database password: " DB_PASSWORD
        echo ""
        
        read -p "Use SSL for database? (true/false, default: false): " DB_SSL
        DB_SSL=${DB_SSL:-false}
    fi
    
    cat > "$PROJECT_DIR/backend/.env" <<EOF
# Server Configuration
PORT=$BACKEND_PORT
FRONTEND_URL=http://localhost:8081

# Database Configuration
ENABLE_DATABASE=$ENABLE_DB
EOF

    if [ "$ENABLE_DB" = "true" ]; then
        cat >> "$PROJECT_DIR/backend/.env" <<EOF
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
DB_SSL=$DB_SSL
EOF
    fi
    
    cat >> "$PROJECT_DIR/backend/.env" <<EOF

# API Keys
HASDATA_API_KEY=$HASDATA_KEY
UNWRANGLE_API_KEY=$UNWRANGLE_KEY
OPENAI_API_KEY=$OPENAI_KEY

# Service URLs
PYTHON_SERVICE_URL=$PYTHON_URL
EOF
    
    chmod 600 "$PROJECT_DIR/backend/.env"
    echo "✅ .env file created!"
fi

# Create PM2 ecosystem file
echo "⚙️ Creating PM2 ecosystem file..."
cat > "$PROJECT_DIR/backend/ecosystem.config.js" <<EOF
module.exports = {
  apps: [{
    name: 'pricewise-backend',
    script: './dist/server.js',
    cwd: '$PROJECT_DIR/backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: $BACKEND_PORT
    },
    error_file: '$PROJECT_DIR/logs/backend-error.log',
    out_file: '$PROJECT_DIR/logs/backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    instance_var: 'INSTANCE_ID'
  }]
};
EOF

# Set permissions
chown -R "$SERVICE_USER:$SERVICE_USER" "$PROJECT_DIR"

# Start with PM2
echo "🔄 Starting backend with PM2..."
cd "$PROJECT_DIR/backend"
sudo -u "$SERVICE_USER" pm2 start ecosystem.config.js
sudo -u "$SERVICE_USER" pm2 save
sudo -u "$SERVICE_USER" pm2 startup systemd -u "$SERVICE_USER" --hp /home/$SERVICE_USER

# Wait a moment and check status
sleep 2
if sudo -u "$SERVICE_USER" pm2 list | grep -q "pricewise-backend.*online"; then
    echo "✅ Backend service started successfully!"
    echo "📊 Service status:"
    sudo -u "$SERVICE_USER" pm2 status
else
    echo "❌ Service failed to start. Check logs:"
    echo "   pm2 logs pricewise-backend"
    exit 1
fi

echo ""
echo "✅ Node.js backend deployment complete!"
echo ""
echo "Useful commands:"
echo "  Start:   pm2 start pricewise-backend"
echo "  Stop:    pm2 stop pricewise-backend"
echo "  Restart: pm2 restart pricewise-backend"
echo "  Status:  pm2 status"
echo "  Logs:    pm2 logs pricewise-backend"
echo "  Logs:    tail -f $PROJECT_DIR/logs/backend-out.log"

