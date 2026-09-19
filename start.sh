#!/bin/bash
# AI Product Builder Engine - Startup Script

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start Python backend
cd "${REPO_ROOT}/python-backend"
export PATH="$HOME/.local/bin:$PATH"
PYTHON_BACKEND_PORT=8001 python3 main.py &
PY_PID=$!
echo "Python backend started (PID: $PY_PID) on port 8001"

# Wait for Python backend to be ready
for i in $(seq 1 10); do
  if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "Python backend is ready!"
    break
  fi
  sleep 1
done

# Start Next.js production server
cd "${REPO_ROOT}"
NODE_ENV=production node .next/standalone/server.js &
NX_PID=$!
echo "Next.js server started (PID: $NX_PID) on port 3000"

# Wait for Next.js to be ready
for i in $(seq 1 10); do
  if curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
    echo "Next.js is ready!"
    break
  fi
  sleep 1
done

echo ""
echo "=== AI Product Builder Engine ==="
echo "Frontend: http://localhost:3000"
echo "Python Backend: http://localhost:8001"
echo "================================="

# Keep script running
wait
