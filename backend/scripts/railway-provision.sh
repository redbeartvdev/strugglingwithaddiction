#!/usr/bin/env bash
# Full Railway setup: PostgreSQL + DATABASE_URL + production env + optional redeploy.
#
# Usage:
#   railway login
#   export RAILWAY_TOKEN="..."   # optional; project token from Railway → Project → Settings → Tokens
#   ./backend/scripts/railway-provision.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-407fa40d-6608-4441-905c-f3fab0182421}"
API_SERVICE="${RAILWAY_API_SERVICE:-strugglingwithaddiction-production}"
ENV_NAME="${RAILWAY_ENVIRONMENT:-production}"
POSTGRES_SERVICE="${RAILWAY_POSTGRES_SERVICE:-}"

PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-https://strugglingwithaddiction-production.up.railway.app}"
ADMIN_SITE_URL="${ADMIN_SITE_URL:-}"
ADMIN_BOOTSTRAP_EMAIL="${ADMIN_BOOTSTRAP_EMAIL:-admin@example.com}"
ADMIN_BOOTSTRAP_PASSWORD="${ADMIN_BOOTSTRAP_PASSWORD:-}"
REDEPLOY="${RAILWAY_REDEPLOY:-1}"

die() { echo "error: $*" >&2; exit 1; }

ensure_auth() {
  command -v railway >/dev/null || die "Install: npm install -g @railway/cli"
  if [[ -n "${RAILWAY_TOKEN:-}" ]]; then
    export RAILWAY_TOKEN
  elif ! railway whoami >/dev/null 2>&1; then
    die "Run: railway login   OR: export RAILWAY_TOKEN=<project-token>"
  fi
}

ensure_linked() {
  if railway status >/dev/null 2>&1; then
    return
  fi
  echo "Linking project ${RAILWAY_PROJECT_ID} → service ${API_SERVICE}..."
  railway link --project "$RAILWAY_PROJECT_ID" --service "$API_SERVICE" --environment "$ENV_NAME"
}

detect_postgres_service_name() {
  railway environment config --json 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(1)
for svc in (data.get('services') or {}).values():
    image = ((svc.get('source') or {}).get('image') or '').lower()
    if 'postgres' not in image:
        continue
    name = (svc.get('name') or svc.get('serviceName') or '').strip()
    if name:
        print(name)
        sys.exit(0)
print('Postgres')
" 2>/dev/null || echo "Postgres"
}

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

ensure_postgres() {
  if has_postgres; then
    echo "PostgreSQL already in project."
  else
    echo "Creating PostgreSQL database..."
    railway add --database postgres
    echo "Waiting for Postgres to finish deploying..."
    sleep 30
  fi
  if [[ -z "$POSTGRES_SERVICE" ]]; then
    POSTGRES_SERVICE="$(detect_postgres_service_name)"
  fi
  echo "Postgres service name for references: ${POSTGRES_SERVICE}"
}

set_production_variables() {
  local jwt_secret cors
  jwt_secret="$(openssl rand -hex 32)"
  PUBLIC_SITE_URL="${PUBLIC_SITE_URL%/}"
  ADMIN_SITE_URL="${ADMIN_SITE_URL:-${PUBLIC_SITE_URL}/admin}"
  ADMIN_SITE_URL="${ADMIN_SITE_URL%/}"
  cors="${CORS_ORIGINS:-${PUBLIC_SITE_URL},${ADMIN_SITE_URL}}"

  if [[ -z "$ADMIN_BOOTSTRAP_PASSWORD" ]]; then
    ADMIN_BOOTSTRAP_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
    echo ""
    echo "=== Save this admin password (first boot only) ==="
    echo "  ${ADMIN_BOOTSTRAP_PASSWORD}"
    echo ""
  fi

  echo "Setting variables on ${API_SERVICE}..."
  railway variable set \
    "DATABASE_URL=\${{${POSTGRES_SERVICE}.DATABASE_URL}}" \
    "JWT_SECRET=${jwt_secret}" \
    "ENVIRONMENT=production" \
    "CORS_ORIGINS=${cors}" \
    "PUBLIC_SITE_URL=${PUBLIC_SITE_URL}" \
    "ADMIN_SITE_URL=${ADMIN_SITE_URL}" \
    "ADMIN_BOOTSTRAP_EMAIL=${ADMIN_BOOTSTRAP_EMAIL}" \
    "ADMIN_BOOTSTRAP_PASSWORD=${ADMIN_BOOTSTRAP_PASSWORD}" \
    --service "$API_SERVICE" \
    --environment "$ENV_NAME"
}

maybe_redeploy() {
  if [[ "$REDEPLOY" != "1" ]]; then
    echo "Skipping redeploy (RAILWAY_REDEPLOY=0)."
    return
  fi
  echo "Redeploying ${API_SERVICE}..."
  railway redeploy --service "$API_SERVICE" --yes 2>/dev/null || railway redeploy --service "$API_SERVICE" 2>/dev/null || {
    echo "Redeploy via CLI failed — click Redeploy in Railway dashboard."
  }
}

main() {
  ensure_auth
  ensure_linked
  ensure_postgres
  set_production_variables
  maybe_redeploy
  cat <<EOF

Provision complete.

  Project:  https://railway.com/project/${RAILWAY_PROJECT_ID}
  Health:   ${PUBLIC_SITE_URL}/health
  Site:     ${PUBLIC_SITE_URL}/
  Admin:    ${ADMIN_SITE_URL}/

Expect: {"status":"ok","database":"connected"}

EOF
}

main "$@"
