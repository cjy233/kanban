#!/bin/bash
# init.sh - Environment setup for agent sessions
# Run this at the start of every session to verify the environment is working.

set -e

echo "=== Server Monitor - Environment Init ==="
echo ""

# 1. Confirm working directory
echo "[1/5] Working directory: $(pwd)"

# 2. Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
  echo "[2/5] Installing backend dependencies..."
  cd backend && npm install && cd ..
else
  echo "[2/5] Backend dependencies OK"
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "[3/5] Installing frontend dependencies..."
  cd frontend && npm install && cd ..
else
  echo "[3/5] Frontend dependencies OK"
fi

# 3. Build frontend
echo "[4/5] Building frontend..."
cd frontend && npm run build 2>&1 && cd ..

# 4. Quick backend smoke test
echo "[5/5] Smoke test..."

# Check if server is already running
ALREADY_RUNNING=false
if curl -s -o /dev/null -w "%{http_code}" http://localhost:7777/api/stats 2>/dev/null | grep -q "200"; then
  ALREADY_RUNNING=true
fi

if [ "$ALREADY_RUNNING" = "true" ]; then
  echo "  Server already running on port 7777"
  HTTP_CODE="200"
else
  cd backend
  node server.js &
  SERVER_PID=$!
  sleep 2
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:7777/api/stats 2>/dev/null || echo "000")
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
  cd ..
fi

if [ "$HTTP_CODE" = "200" ]; then
  echo "  API smoke test: PASS (HTTP $HTTP_CODE)"
else
  echo "  API smoke test: FAIL (HTTP $HTTP_CODE)"
  echo "  Check backend/server.js for errors"
fi

echo ""
echo "=== Init complete ==="
