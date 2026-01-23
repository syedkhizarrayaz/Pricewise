# Pricewise Service Startup Script (PowerShell)
# Starts Python service and Backend API

Write-Host "🚀 Starting Pricewise Services..." -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found at project root" -ForegroundColor Yellow
    Write-Host "   Please create .env file with your API keys"
    Write-Host "   See ENV_SETUP_GUIDE.md for details"
    Write-Host ""
}

# Function to check if port is in use
function Test-Port {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $connection
}

# Check ports
Write-Host "🔍 Checking ports..." -ForegroundColor Blue
if (Test-Port -Port 8000) {
    Write-Host "⚠️  Port 8000 is already in use" -ForegroundColor Yellow
}
if (Test-Port -Port 3001) {
    Write-Host "⚠️  Port 3001 is already in use" -ForegroundColor Yellow
}
Write-Host ""

# Start Python Service
Write-Host "📦 Starting Python Service (port 8000)..." -ForegroundColor Blue
Set-Location services

# Check if virtual environment exists
if (-not (Test-Path "venv") -and -not (Test-Path ".venv")) {
    Write-Host "⚠️  No virtual environment found. Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt 2>&1 | Out-Null
}

# Start Python service
$pythonJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    Set-Location services
    python product_matcher_service.py
}

Set-Location ..

# Wait a moment
Start-Sleep -Seconds 2

Write-Host "✅ Python Service started (Job ID: $($pythonJob.Id))" -ForegroundColor Green

# Start Backend
Write-Host "🔧 Starting Backend API (port 3001)..." -ForegroundColor Blue
Set-Location backend

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  Installing backend dependencies..." -ForegroundColor Yellow
    npm install
}

# Start backend
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    Set-Location backend
    npm run dev
}

Set-Location ..

# Wait a moment
Start-Sleep -Seconds 3

Write-Host "✅ Backend API started (Job ID: $($backendJob.Id))" -ForegroundColor Green

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Services Started" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Python Service: http://localhost:8000" -ForegroundColor Cyan
Write-Host "📍 Backend API:     http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "🧪 Test the services:" -ForegroundColor Yellow
Write-Host "   curl http://localhost:8000/health"
Write-Host "   curl http://localhost:3001/api/health"
Write-Host ""
Write-Host "📊 Run full test suite:" -ForegroundColor Yellow
Write-Host "   node test-endpoints.js"
Write-Host ""
Write-Host "🛑 To stop services:" -ForegroundColor Red
Write-Host "   Stop-Job $($pythonJob.Id), $($backendJob.Id)"
Write-Host "   Remove-Job $($pythonJob.Id), $($backendJob.Id)"
Write-Host ""

# Store job IDs for later
$global:PricewiseJobs = @($pythonJob.Id, $backendJob.Id)
Write-Host "💡 Job IDs stored in `$global:PricewiseJobs" -ForegroundColor Gray
