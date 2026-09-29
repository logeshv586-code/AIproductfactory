#!/bin/bash
# AI Product Factory - production startup helper
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "          AI Product Factory - Server"
echo "=================================================="

PYTHON_BIN=""
if [ -x "${REPO_ROOT}/.venv/bin/python" ]; then
  PYTHON_BIN="${REPO_ROOT}/.venv/bin/python"
elif [ -x "${REPO_ROOT}/venv/bin/python" ]; then
  PYTHON_BIN="${REPO_ROOT}/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Python executable not found." >&2
  exit 1
fi

if [ ! -f "${REPO_ROOT}/python-backend/runtime_entry.py" ]; then
  echo "python-backend/runtime_entry.py not found." >&2
  exit 1
fi

if [ ! -f "${REPO_ROOT}/.next/standalone/server.js" ]; then
  echo "Production build not found. Running npm run build..."
  (cd "${REPO_ROOT}" && npm run build)
fi

export PYTHON_BACKEND_PORT="${PYTHON_BACKEND_PORT:-8001}"
export PORT="${PORT:-3000}"

cleanup() {
  echo ""
  echo "Stopping AI Product Factory..."
  [ -n "${PY_PID:-}" ] && kill "${PY_PID}" 2>/dev/null || true
  [ -n "${NEXT_PID:-}" ] && kill "${NEXT_PID}" 2>/dev/null || true
  wait "${PY_PID:-}" "${NEXT_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(
  cd "${REPO_ROOT}/python-backend"
  PYTHON_BACKEND_PORT="${PYTHON_BACKEND_PORT}" "${PYTHON_BIN}" runtime_entry.py
) &
PY_PID=$!

for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PYTHON_BACKEND_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

(
  cd "${REPO_ROOT}"
  PORT="${PORT}" node .next/standalone/server.js
) &
NEXT_PID=$!

echo "Studio:  http://127.0.0.1:${PORT}"
echo "Backend: http://127.0.0.1:${PYTHON_BACKEND_PORT}"
echo "Press Ctrl+C to stop."

wait "${PY_PID}" "${NEXT_PID}"
