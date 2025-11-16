#!/bin/bash
# Quick Deployment Script - Runs all setup scripts in sequence
# Usage: sudo ./deployment/quick-deploy.sh

set -e  # Exit on error

echo "🚀 Starting Quick Deployment for Pricewise on DigitalOcean..."
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Get project directory
read -p "Enter project directory (default: /opt/pricewise): " PROJECT_DIR
PROJECT_DIR=${PROJECT_DIR:-/opt/pricewise}

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Project directory not found: $PROJECT_DIR"
    echo "Please clone or copy your project files first."
    exit 1
fi

cd "$PROJECT_DIR"

echo ""
echo "📋 Deployment Steps:"
echo "1. Setup MySQL Database"
echo "2. Deploy Python Service"
echo "3. Deploy Node.js Backend"
echo ""

read -p "Continue with deployment? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Step 1: Database Setup
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Step 1/3: Setting up MySQL Database"
echo "═══════════════════════════════════════════════════════════"
if [ -f "deployment/setup-database.sh" ]; then
    chmod +x deployment/setup-database.sh
    ./deployment/setup-database.sh
else
    echo "⚠️ Database setup script not found. Skipping..."
fi

# Step 2: Python Service
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Step 2/3: Deploying Python Service"
echo "═══════════════════════════════════════════════════════════"
if [ -f "deployment/setup-python-service.sh" ]; then
    chmod +x deployment/setup-python-service.sh
    ./deployment/setup-python-service.sh
else
    echo "⚠️ Python service setup script not found. Skipping..."
fi

# Step 3: Node.js Backend
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Step 3/3: Deploying Node.js Backend"
echo "═══════════════════════════════════════════════════════════"
if [ -f "deployment/setup-node-backend.sh" ]; then
    chmod +x deployment/setup-node-backend.sh
    ./deployment/setup-node-backend.sh
else
    echo "⚠️ Backend setup script not found. Skipping..."
fi

# Final Status Check
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Deployment Complete! Checking Services..."
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check Python service
echo "🐍 Python Service:"
if systemctl is-active --quiet pricewise-python; then
    echo "  ✅ Running"
    curl -s http://localhost:8000/health > /dev/null && echo "  ✅ Health check passed" || echo "  ⚠️ Health check failed"
else
    echo "  ❌ Not running"
fi

# Check Backend service
echo ""
echo "🚀 Node.js Backend:"
if pm2 list | grep -q "pricewise-backend.*online"; then
    echo "  ✅ Running"
    curl -s http://localhost:3001/api/health > /dev/null && echo "  ✅ Health check passed" || echo "  ⚠️ Health check failed"
else
    echo "  ❌ Not running"
fi

# Check Database
echo ""
echo "📊 Database:"
if systemctl is-active --quiet mysql; then
    echo "  ✅ MySQL is running"
else
    echo "  ❌ MySQL is not running"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Next Steps:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Update frontend config/api.ts with server IP:"
echo "   BACKEND_URL: 'http://YOUR_SERVER_IP:3001'"
echo "   PYTHON_SERVICE_URL: 'http://YOUR_SERVER_IP:8000'"
echo ""
echo "2. Test the services:"
echo "   curl http://localhost:8000/health"
echo "   curl http://localhost:3001/api/health"
echo ""
echo "3. View logs if needed:"
echo "   sudo journalctl -u pricewise-python -f"
echo "   pm2 logs pricewise-backend"
echo ""
echo "✅ Deployment complete!"

