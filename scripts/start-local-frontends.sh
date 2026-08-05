#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
docker start swa-local-postgres swa-local-api 2>/dev/null || true
docker compose -f docker-compose.frontends.yml up -d
echo "Admin login: http://127.0.0.1:5180/swa-login/"
echo "Public:      http://127.0.0.1:5317/"
echo "API:         http://127.0.0.1:8317/"
