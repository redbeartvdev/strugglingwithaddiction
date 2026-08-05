#!/usr/bin/env bash
# Watchdog: restart SWA Vite if ports drop.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/Users/dlvenida/.local/node/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

while true; do
  need=0
  curl -sf --max-time 1 http://127.0.0.1:5317/ >/dev/null 2>&1 || need=1
  curl -sf --max-time 1 http://127.0.0.1:5180/ >/dev/null 2>&1 || need=1
  if [[ $need -eq 1 ]]; then
    bash "$ROOT/scripts/start-local-frontends.sh" >/tmp/swa-vite-watchdog.log 2>&1 || true
  fi
  sleep 8
done
