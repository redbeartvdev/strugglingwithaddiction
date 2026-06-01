#!/usr/bin/env bash
# Add Railway Postgres and wire DATABASE_URL to the API service.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

API_SERVICE="${RAILWAY_API_SERVICE:-strugglingwithaddiction-production}"
POSTGRES_SERVICE="${RAILWAY_POSTGRES_SERVICE:-Postgres}"
ENV_NAME="${RAILWAY_ENVIRONMENT:-production}"

die() { echo "error: $*" >&2; exit 1; }

command -v railway >/dev/null || die "Install CLI: npm install -g @railway/cli"
railway whoami >/dev/null 2>&1 || die "Run: railway login"
railway status >/dev/null 2>&1 || die "From repo root run: railway link -s ${API_SERVICE}"

has_postgres() {
  railway environment config --json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for svc in (data.get('services') or {}).values():
    if 'postgres' in ((svc.get('source') or {}).get('image') or '').lower():
        sys.exit(0)
sys.exit(1)
" || return 1
}

if has_postgres; then
  echo "PostgreSQL already in project."
else
  echo "Creating PostgreSQL..."
  railway add --database postgres
  echo "Waiting for Postgres..."
  sleep 25
fi

echo "Linking DATABASE_URL on ${API_SERVICE}..."
railway variable set \
  "DATABASE_URL=\${{${POSTGRES_SERVICE}.DATABASE_URL}}" \
  "ENVIRONMENT=production" \
  --service "$API_SERVICE" \
  --environment "$ENV_NAME"

echo ""
echo "Done. Redeploy the API service, then check:"
echo "  curl https://strugglingwithaddiction-production.up.railway.app/health"
echo "  (expect database: connected)"
