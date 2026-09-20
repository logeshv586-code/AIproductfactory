#!/bin/bash
# AI Product Factory - Startup Script

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "      AI Product Factory - Production Server      "
echo "=================================================="
echo "Repository root: ${REPO_ROOT}"

# Locate Python executable
PYTHON_BIN=""
if [ -f "${REPO_ROOT}/.venv/bin/python" ]; then
  PYTHON_BIN="${REPO_ROOT}/.venv/bin/python"
elif [ -f "${REPO_ROOT}/venv/bin/python" ]; then
  PYTHON_BIN="${REPO_ROOT}/venv/bin/python"
elif [ -f "${REPO_ROOT}/.venv/Scripts/python.exe" ]; then
  PYTHON_BIN="${REPO_ROOT}/.venv/Scripts/python.exe"
elif [ -f "${REPO_ROOT}/venv/Scripts/python.exe" ]; then
  PYTHON_BIN="${REPO_ROOT}/venv/Scripts/python.exe"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "[AI Product Factory] Error: Python executable not found." >&2
  echo "Please set up a Python virtual environment at .venv or install Python 3." >&2
  exit 1
fi

# Verify Python backend directory and entry point exist
if [ ! -f "${REPO_ROOT}/python-backend/runtime_entry.py" ]; then
  echo "[AI Product Factory] Error: Could not find python-backend/runtime_entry.py in ${REPO_ROOT}." >&2
  exit 1
fi

# Ensure standalone build exists
if [ ! -f "${REPO_ROOT}/.next/standalone/server.js" ]; then
  echo "[AI Product Factory] Production standalone build not found. Running build..."
  (cd "${REPO_ROOT}" && npm run build)
fi

export PYTHON_BACKEND_PORT="${PYTHON_BACKEND_PORT:-8001}"
export PORT="${PORT:-3000}"

# Start Python backend using runtime_entry.py
cd "${REPO_ROOT}/python-backend"
"${PYTHON_BIN}" runtime_entry.py &
PY_PID=$!
echo "Python backend started (PID: $PY_PID) on port ${PYTHON_BACKEND_PORT}"

# Wait for Python backend to be ready
for i in $(seq 1 15); do
  if curl -s "http://localhost:${PYTHON_BACKEND_PORT}/health" > /dev/null 2>&1; then
    echo "Python backend is ready!"
    break
  fi
  sleep 1
done

# Start Next.js production server
cd "${REPO_ROOT}"
NODE_ENV=production PORT="${PORT}" node .next/standalone/server.js &
NX_PID=$!
echo "Next.js server started (PID: $NX_PID) on port ${PORT}"

# Wait for Next.js to be ready
for i in $(seq 1 15); do
  if curl -s -o /dev/null "http://localhost:${PORT}/" 2>/dev/null; then
    echo "Next.js is ready!"
    break
  fi
  sleep 1
done

echo ""
echo "=== AI Product Factory ==="
echo "Frontend: http://localhost:${PORT}"
echo "Python Backend: http://localhost:${PYTHON_BACKEND_PORT}"
echo "=========================="
echo "Press Ctrl+C to stop both servers."
echo ""

# Cleanup handler on exit or interrupt
cleanup() {
  echo ""
  echo "[AI Product Factory] Shutting down servers..."
  if [ -n "${PY_PID}" ] && kill -0 "${PY_PID}" 2>/dev/null; then
    kill "${PY_PID}" 2>/dev/null || true
  fi
  if [ -n "${NX_PID}" ] && kill -0 "${NX_PID}" 2>/dev/null; then
    kill "${NX_PID}" 2>/dev/null || true
  fi
  wait "${PY_PID}" "${NX_PID}" 2>/dev/null || true
  echo "[AI Product Factory] All servers stopped."
}

trap cleanup SIGINT SIGTERM EXIT

# Keep script running
wait "${PY_PID}" "${NX_PID}" 2>/dev/null || true
