#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_PID=""
PUBLIC_PID=""

cleanup() {
  if [[ -n "$API_PID" ]]; then kill "$API_PID" 2>/dev/null || true; fi
  if [[ -n "$PUBLIC_PID" ]]; then kill "$PUBLIC_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

echo "==> Local preview (production build)"
echo ""

if command -v docker >/dev/null 2>&1; then
  echo "Starting Postgres..."
  docker compose up -d postgres
  sleep 2
else
  echo "Docker not found — skipping Postgres (API may fail if DB is down)."
fi

if [[ -x backend/.venv/bin/uvicorn ]]; then
  echo "Starting API on http://127.0.0.1:8000 ..."
  (cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000) &
  API_PID=$!
  sleep 2
  if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "API ready."
  else
    echo "API not responding — directory API calls may fail; static pages still work."
  fi
else
  echo "backend/.venv missing — run README setup. Static pages will still preview."
fi

echo ""
echo "Building public site..."
npm run build

echo ""
echo "Starting preview server on http://127.0.0.1:4173"
echo "Press Ctrl+C to stop."
echo ""

npm run preview -- --host 127.0.0.1 --port 4173 &
PUBLIC_PID=$!
wait "$PUBLIC_PID"
