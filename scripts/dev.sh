#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Starting Postgres..."
docker compose up -d postgres

echo "Starting API on http://127.0.0.1:8000 ..."
(cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) &
API_PID=$!

sleep 2
if ! curl -sf http://127.0.0.1:8000/health >/dev/null; then
  echo "API failed to start. Check backend/.env and Postgres on port 5433."
  kill $API_PID 2>/dev/null || true
  exit 1
fi

echo "Starting public site on http://127.0.0.1:5173 ..."
npm run dev -- --host 127.0.0.1 --port 5173 &
PUBLIC_PID=$!

echo "Starting admin on http://127.0.0.1:5180 ..."
npm run dev --prefix admin -- --host 127.0.0.1 --port 5180 &
ADMIN_PID=$!

echo ""
echo "Ready:"
echo "  Public:  http://127.0.0.1:5173"
echo "  Admin:   http://127.0.0.1:5180/login  (admin@example.com / changeme123)"
echo "  API:     http://127.0.0.1:8000/docs"
echo ""
echo "Press Ctrl+C to stop."

trap 'kill $API_PID $PUBLIC_PID $ADMIN_PID 2>/dev/null' EXIT
wait
