#!/usr/bin/env bash
set -euo pipefail

echo "Starting Pricewise Python matcher on :8000..."
python3 -m uvicorn product_matcher_service:app --host 0.0.0.0 --port 8000 --log-level info --app-dir /app/services &
PY_PID=$!

cleanup() {
  echo "Shutting down services..."
  if kill -0 "$PY_PID" 2>/dev/null; then
    kill "$PY_PID" || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting Pricewise Node backend on :${PORT:-7860}..."
cd /app/backend
node dist/server.js
