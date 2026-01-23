#!/bin/bash

# Pricewise Service Startup Script
# Starts Python service and Backend API in separate terminals

echo "🚀 Starting Pricewise Services..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo "${YELLOW}⚠️  Warning: .env file not found at project root${NC}"
    echo "   Please create .env file with your API keys"
    echo "   See ENV_SETUP_GUIDE.md for details"
    echo ""
fi

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "${YELLOW}⚠️  Port $1 is already in use${NC}"
        return 1
    fi
    return 0
}

# Check ports
echo "🔍 Checking ports..."
check_port 8000 || echo "   Python service port 8000 is busy"
check_port 3001 || echo "   Backend port 3001 is busy"
echo ""

# Start Python Service
echo "${BLUE}📦 Starting Python Service (port 8000)...${NC}"
cd services
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo "${YELLOW}⚠️  No virtual environment found. Installing dependencies globally...${NC}"
    pip install -r requirements.txt > /dev/null 2>&1 || echo "${YELLOW}⚠️  Some dependencies may need manual installation${NC}"
fi

# Start Python service in background
python product_matcher_service.py &
PYTHON_PID=$!
cd ..

# Wait a moment for Python service to start
sleep 2

# Check if Python service started
if ps -p $PYTHON_PID > /dev/null; then
    echo "${GREEN}✅ Python Service started (PID: $PYTHON_PID)${NC}"
else
    echo "${YELLOW}⚠️  Python Service may have failed to start${NC}"
fi

# Start Backend
echo "${BLUE}🔧 Starting Backend API (port 3001)...${NC}"
cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "${YELLOW}⚠️  Installing backend dependencies...${NC}"
    npm install
fi

# Start backend in background
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend started
if ps -p $BACKEND_PID > /dev/null; then
    echo "${GREEN}✅ Backend API started (PID: $BACKEND_PID)${NC}"
else
    echo "${YELLOW}⚠️  Backend API may have failed to start${NC}"
fi

echo ""
echo "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo "${GREEN}  Services Started${NC}"
echo "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "📍 Python Service: http://localhost:8000"
echo "📍 Backend API:     http://localhost:3001"
echo ""
echo "🧪 Test the services:"
echo "   curl http://localhost:8000/health"
echo "   curl http://localhost:3001/api/health"
echo ""
echo "📊 Run full test suite:"
echo "   node test-endpoints.js"
echo ""
echo "🛑 To stop services:"
echo "   kill $PYTHON_PID $BACKEND_PID"
echo "   or: pkill -f 'product_matcher_service.py'"
echo "   or: pkill -f 'ts-node-dev'"
echo ""
