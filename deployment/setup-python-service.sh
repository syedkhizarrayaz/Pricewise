#!/bin/bash
# Python Service Deployment Script for DigitalOcean
# This script sets up the Python FastAPI service as a systemd service

set -e  # Exit on error

echo "🚀 Starting Python Service Deployment..."

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

# Install Python and pip if not already installed
echo "📦 Installing Python and dependencies..."
apt-get update -y
apt-get install -y python3 python3-pip python3-venv

# Create project directory structure
echo "📁 Creating project directory structure..."
mkdir -p "$PROJECT_DIR/services"
mkdir -p "$PROJECT_DIR/logs"

# Copy Python service files
echo "📋 Copying Python service files..."
if [ -d "services" ]; then
    cp -r services/* "$PROJECT_DIR/services/"
else
    echo "❌ Services directory not found. Please run from project root."
    exit 1
fi

# Create virtual environment
echo "🐍 Creating Python virtual environment..."
cd "$PROJECT_DIR/services"
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f "$PROJECT_DIR/services/.env" ]; then
    echo "📝 Creating .env file..."
    read -p "Enter OpenAI API Key: " OPENAI_KEY
    cat > "$PROJECT_DIR/services/.env" <<EOF
OPENAI_API_KEY=$OPENAI_KEY
EOF
    chmod 600 "$PROJECT_DIR/services/.env"
fi

# Create systemd service file
echo "⚙️ Creating systemd service..."
cat > /etc/systemd/system/pricewise-python.service <<EOF
[Unit]
Description=Pricewise Python Product Matcher Service
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_DIR/services
Environment="PATH=$PROJECT_DIR/services/venv/bin"
ExecStart=$PROJECT_DIR/services/venv/bin/uvicorn product_matcher_service:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
StandardOutput=append:$PROJECT_DIR/logs/python-service.log
StandardError=append:$PROJECT_DIR/logs/python-service-error.log

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown -R "$SERVICE_USER:$SERVICE_USER" "$PROJECT_DIR"
chmod +x "$PROJECT_DIR/services/product_matcher_service.py"

# Reload systemd and start service
echo "🔄 Reloading systemd and starting service..."
systemctl daemon-reload
systemctl enable pricewise-python
systemctl start pricewise-python

# Wait a moment and check status
sleep 2
if systemctl is-active --quiet pricewise-python; then
    echo "✅ Python service started successfully!"
    echo "📊 Service status:"
    systemctl status pricewise-python --no-pager -l
else
    echo "❌ Service failed to start. Check logs:"
    echo "   journalctl -u pricewise-python -n 50"
    exit 1
fi

echo ""
echo "✅ Python service deployment complete!"
echo ""
echo "Useful commands:"
echo "  Start:   systemctl start pricewise-python"
echo "  Stop:    systemctl stop pricewise-python"
echo "  Restart: systemctl restart pricewise-python"
echo "  Status:  systemctl status pricewise-python"
echo "  Logs:    journalctl -u pricewise-python -f"
echo "  Logs:    tail -f $PROJECT_DIR/logs/python-service.log"

