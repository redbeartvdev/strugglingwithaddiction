#!/usr/bin/env bash
# Provision Railway Postgres + production env for the monolith service.
# Run from repo root after: railway login && railway link -s <api-service>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-407fa40d-6608-4441-905c-f3fab0182421}"
API_SERVICE="${RAILWAY_API_SERVICE:-strugglingwithaddiction-production}"
POSTGRES_SERVICE="${RAILWAY_POSTGRES_SERVICE:-Postgres}"
ENV_NAME="${RAILWAY_ENVIRONMENT:-production}"

PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-}"
ADMIN_SITE_URL="${ADMIN_SITE_URL:-}"
ADMIN_BOOTSTRAP_EMAIL="${ADMIN_BOOTSTRAP_EMAIL:-admin@example.com}"
ADMIN_BOOTSTRAP_PASSWORD="${ADMIN_BOOTSTRAP_PASSWORD:-}"

die() {
  echo "error: $*" >&2
  exit 1
}

ensure_linked() {
  if railway status >/dev/null 2>&1; then
    return
  fi
  echo "Linking project ${RAILWAY_PROJECT_ID} (service ${API_SERVICE})..."
  railway link --project "$RAILWAY_PROJECT_ID" --service "$API_SERVICE" --environment "$ENV_NAME"
}

require_cli() {
  command -v railway >/dev/null || die "Install Railway CLI: npm install -g @railway/cli"
  if [[ -n "${RAILWAY_TOKEN:-}" ]]; then
    export RAILWAY_TOKEN
  elif ! railway whoami >/dev/null 2>&1; then
    die "Not logged in. Run: railway login (or export RAILWAY_TOKEN=project-token)"
  fi
  ensure_linked
}

has_postgres() {
  railway environment config --json 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(1)
for svc in (data.get('services') or {}).values():
    image = ((svc.get('source') or {}).get('image') or '').lower()
    if 'postgres' in image:
        sys.exit(0)
sys.exit(1)
" || return 1
}

ensure_postgres() {
  if has_postgres; then
    echo "PostgreSQL already exists in this project."
  else
    echo "Adding PostgreSQL..."
    railway add --database postgres
    echo "Waiting for Postgres to deploy..."
    sleep 20
  fi
}

read_service_url() {
  railway domain --service "$API_SERVICE" --json 2>/dev/null | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(1)
for key in ('domain', 'url', 'hostname'):
    v = d.get(key)
    if v:
        v = str(v).strip()
        if not v.startswith('http'):
            v = 'https://' + v.lstrip('/')
        print(v.rstrip('/'))
        sys.exit(0)
# CLI sometimes returns a list
if isinstance(d, list) and d:
    v = d[0].get('domain') or d[0].get('url')
    if v:
        v = str(v).strip()
        if not v.startswith('http'):
            v = 'https://' + v.lstrip('/')
        print(v.rstrip('/'))
" 2>/dev/null || true
}

ensure_domain() {
  local url
  url="$(read_service_url)"
  if [[ -n "$url" ]]; then
    echo "Service URL: $url"
    return
  fi
  echo "Generating Railway domain for ${API_SERVICE}..."
  railway domain --service "$API_SERVICE"
  sleep 3
  url="$(read_service_url)"
  [[ -n "$url" ]] || die "Could not read service URL. Set PUBLIC_SITE_URL manually."
  echo "Service URL: $url"
}

resolve_urls() {
  if [[ -z "$PUBLIC_SITE_URL" ]]; then
    PUBLIC_SITE_URL="$(read_service_url)"
  fi
  [[ -n "$PUBLIC_SITE_URL" ]] || die "Set PUBLIC_SITE_URL or generate a Railway domain first."
  PUBLIC_SITE_URL="${PUBLIC_SITE_URL%/}"
  if [[ -z "$ADMIN_SITE_URL" ]]; then
    ADMIN_SITE_URL="${PUBLIC_SITE_URL}/admin"
  fi
  ADMIN_SITE_URL="${ADMIN_SITE_URL%/}"
}

build_cors() {
  if [[ -n "${CORS_ORIGINS:-}" ]]; then
    echo "$CORS_ORIGINS"
    return
  fi
  echo "${PUBLIC_SITE_URL},${ADMIN_SITE_URL}"
}

set_api_variables() {
  local jwt_secret cors
  jwt_secret="$(openssl rand -hex 32)"
  cors="$(build_cors)"

  if [[ -z "$ADMIN_BOOTSTRAP_PASSWORD" ]]; then
    ADMIN_BOOTSTRAP_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
    echo ""
    echo "Generated ADMIN_BOOTSTRAP_PASSWORD (save this — used only on first boot):"
    echo "  ${ADMIN_BOOTSTRAP_PASSWORD}"
    echo ""
  fi

  echo "Setting variables on service: ${API_SERVICE}"
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

print_next_steps() {
  cat <<EOF

Done.

  Public site:  ${PUBLIC_SITE_URL}/
  Admin CMS:    ${ADMIN_SITE_URL}/
  Health:       ${PUBLIC_SITE_URL}/health

Railway dashboard:
  - Root Directory must be "." (repo root), Dockerfile: backend/Dockerfile
  - Redeploy after changing Root Directory

GitHub Actions secrets:
  RAILWAY_TOKEN, RAILWAY_SERVICE_ID=${API_SERVICE}

EOF
}

main() {
  require_cli
  ensure_postgres
  ensure_domain
  resolve_urls
  set_api_variables
  print_next_steps
}

main "$@"
