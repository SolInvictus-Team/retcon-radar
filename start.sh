#!/usr/bin/env bash
# ==============================================================================
# RETCON-RADAR: One-Click Startup Script
# Starts both the FastAPI backend and Vite frontend concurrently with clean exit.
# ==============================================================================

set -e

# Determine the absolute directory where this script is located
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "===================================================================="
echo "          📡 RETCON-RADAR: Real-Time Narrative Continuity Linter"
echo "===================================================================="

# 1. Pre-flight Checks
if [ ! -d "$ROOT_DIR/backend/.venv" ]; then
    echo "❌ Error: Python virtual environment not found in backend/.venv"
    echo "   Please create it: cd backend && python3 -m venv .venv && pip install -r requirements.txt"
    exit 1
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    echo "📦 node_modules not found. Running npm install in frontend/..."
    npm install --prefix "$ROOT_DIR/frontend"
fi

# 2. Free ports if previously occupied
if command -v fuser >/dev/null 2>&1; then
    fuser -k 8000/tcp 5173/tcp 2>/dev/null || true
fi

# 3. Load Environment Variables if .env exists
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env"
    set +a
elif [ -f "$ROOT_DIR/backend/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/backend/.env"
    set +a
fi

# 4. Cleanup trap on exit / Ctrl+C
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "🛑 Shutting down RETCON-RADAR..."
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    if command -v fuser >/dev/null 2>&1; then
        fuser -k 8000/tcp 5173/tcp 2>/dev/null || true
    fi
    echo "✅ All services stopped."
}
trap cleanup SIGINT SIGTERM EXIT

# 5. Start Backend API
echo "🚀 Starting Backend API on http://127.0.0.1:8000 ..."
export PYTHONPATH="$ROOT_DIR"
"$ROOT_DIR/backend/.venv/bin/uvicorn" backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait briefly for backend to initialize
for i in {1..20}; do
    if curl -s http://127.0.0.1:8000/api/projects >/dev/null 2>&1; then
        echo "✅ Backend API is ready!"
        break
    fi
    sleep 0.3
done

# 6. Start Frontend App
echo "🚀 Starting Frontend UI on http://localhost:5173 ..."
npm run dev --prefix "$ROOT_DIR/frontend" &
FRONTEND_PID=$!

echo ""
echo "===================================================================="
echo "  🎉 RETCON-RADAR is live and ready!"
echo ""
echo "  • Frontend Web UI:  http://localhost:5173"
echo "  • Backend API:      http://127.0.0.1:8000"
echo "  • API Docs:         http://127.0.0.1:8000/docs"
echo ""
echo "  Press [Ctrl+C] to stop all services."
echo "===================================================================="
echo ""

# Keep running and wait for background jobs
wait

