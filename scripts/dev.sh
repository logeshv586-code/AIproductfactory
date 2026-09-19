#!/bin/bash
# AI Product Factory - Local Development Startup Script (Linux/macOS)

set -e

# Resolve repository root dynamically relative to script location
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=================================================="
echo "      AI Product Factory - Local Dev Server       "
echo "=================================================="
echo "Repository root: ${REPO_ROOT}"

# Check for npm
if ! command -v npm >/dev/null 2>&1; then
  echo "[AI Product Factory] Error: 'npm' is required but not found in PATH." >&2
  exit 1
fi

# Locate Python executable
PYTHON_BIN=""
if [ -f "${REPO_ROOT}/.venv/bin/python" ]; then
  PYTHON_BIN="${REPO_ROOT}/.venv/bin/python"
elif [ -f "${REPO_ROOT}/venv/bin/python" ]; then
  PYTHON_BIN="${REPO_ROOT}/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "[AI Product Factory] Error: Python 3 executable not found." >&2
  echo "Please set up a Python virtual environment at .venv or install Python 3." >&2
  exit 1
fi

# Verify Python backend directory exists
if [ ! -f "${REPO_ROOT}/python-backend/runtime_entry.py" ]; then
  echo "[AI Product Factory] Error: Could not find python-backend/runtime_entry.py in ${REPO_ROOT}." >&2
  exit 1
fi

# Set default ports if not set
export PYTHON_BACKEND_PORT="${PYTHON_BACKEND_PORT:-8001}"
export PORT="${PORT:-3000}"

echo "[AI Product Factory] Using Python: ${PYTHON_BIN}"
echo "[AI Product Factory] Starting Python backend on port ${PYTHON_BACKEND_PORT}..."
echo "[AI Product Factory] Starting Next.js Studio on port ${PORT}..."
echo "=================================================="
echo "Studio Frontend : http://localhost:${PORT}"
echo "Python Backend  : http://localhost:${PYTHON_BACKEND_PORT}"
echo "=================================================="
echo "Press Ctrl+C to stop both servers."
echo ""

# Start Python backend
(cd "${REPO_ROOT}/python-backend" && "${PYTHON_BIN}" runtime_entry.py) &
PY_PID=$!

# Start Next.js frontend
(cd "${REPO_ROOT}" && npm run dev) &
NX_PID=$!

# Cleanup handler on exit or interrupt
cleanup() {
  echo ""
  echo "[AI Product Factory] Shutting down development servers..."
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

# Wait for background jobs
wait "${PY_PID}" "${NX_PID}" 2>/dev/null || true
