#!/usr/bin/env bash
# Import categories, authors, posts, rehab centers, and bootstrap admin into Railway Postgres.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-407fa40d-6608-4441-905c-f3fab0182421}"
API_SERVICE="${RAILWAY_API_SERVICE:-strugglingwithaddiction-production}"
ENV_NAME="${RAILWAY_ENVIRONMENT:-production}"

die() { echo "error: $*" >&2; exit 1; }

if [[ ! -f "$ROOT/src/data/posts.json" ]]; then
  die "Missing src/data/posts.json. Run: node scripts/extract-posts.mjs"
fi

command -v railway >/dev/null || die "Install: npm install -g @railway/cli"

if [[ -n "${RAILWAY_TOKEN:-}" ]]; then
  export RAILWAY_TOKEN
elif ! railway whoami >/dev/null 2>&1; then
  die "Run: railway login   OR: export RAILWAY_TOKEN=<project-token>"
fi

if ! railway status >/dev/null 2>&1; then
  railway link --project "$RAILWAY_PROJECT_ID" --service "$API_SERVICE" --environment "$ENV_NAME"
fi

echo "Seeding production database (uses Railway DATABASE_URL from linked service)..."
cd "$ROOT/backend"
railway run python scripts/seed_all.py

echo ""
echo "Verify:"
echo "  curl https://strugglingwithaddiction-production.up.railway.app/api/posts?limit=3"
echo "  curl https://strugglingwithaddiction-production.up.railway.app/api/rehab-centers"
