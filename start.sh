#!/bin/bash

# 1. Force the script to use the active virtual environment Python
if [ -d "./venv" ]; then
    PYTHON_EXEC="./venv/Scripts/python"
elif [ -d "./python-backend/venv" ]; then
    PYTHON_EXEC="./python-backend/venv/Scripts/python"
else
    PYTHON_EXEC="python"
fi

# 2. Map Windows Node.js and global installation paths into the environment
export PATH="$PATH:/c/Program Files/nodejs"
export PATH="$PATH:/c/Users/$USERNAME/AppData/Roaming/npm"
export PATH="$PATH:./node_modules/.bin"

# 3. Disable automated dev dependency installers that trigger network drops
export NEXT_TELEMETRY_DISABLED=1

echo "Starting Python backend..."
$PYTHON_EXEC python-backend/runtime_entry.py &
PYTHON_PID=$!
echo "Python backend started (PID: $PYTHON_PID) on port 8001"

echo "Starting Next.js server..."
# Use npx to trigger the dev server smoothly
npx next dev -p 3000 &
NODE_PID=$!
echo "Next.js server started (PID: $NODE_PID) on port 3000"

echo "=== AI Product Builder Engine ==="
echo "Frontend: http://localhost:3000"
echo "Python Backend: http://localhost:8001"
echo "================================="

# Keep script alive to monitor background processes
wait
