#!/usr/bin/env bash
# Provision Railway Postgres + API env vars for production.
# Prerequisite: railway login && railway link (from backend/)
set -euo pipefail

cd "$(dirname "$0")/.."

API_SERVICE="${RAILWAY_API_SERVICE:-strugglingwithaddiction}"
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

require_cli() {
  command -v railway >/dev/null || die "Install Railway CLI: npm install -g @railway/cli"
  railway whoami >/dev/null 2>&1 || die "Not logged in. Run: railway login"
  railway status >/dev/null 2>&1 || die "Not linked. Run: railway link -s ${API_SERVICE}"
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
    sleep 15
  fi
}

build_cors() {
  if [[ -n "${CORS_ORIGINS:-}" ]]; then
    echo "$CORS_ORIGINS"
    return
  fi
  if [[ -z "$PUBLIC_SITE_URL" || -z "$ADMIN_SITE_URL" ]]; then
    die "Set PUBLIC_SITE_URL and ADMIN_SITE_URL, or set CORS_ORIGINS directly."
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

ensure_domain() {
  if railway domain --service "$API_SERVICE" --json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('domain') or d.get('url') or '')" 2>/dev/null | grep -q .; then
    echo "Domain already configured for ${API_SERVICE}."
    railway domain --service "$API_SERVICE" 2>/dev/null || true
    return
  fi
  echo "Generating Railway domain for ${API_SERVICE}..."
  railway domain --service "$API_SERVICE"
}

print_next_steps() {
  cat <<EOF

Done. Next steps:
  1. Confirm API health: curl https://YOUR-SERVICE.up.railway.app/health
  2. GitHub Actions secrets (repo → Settings → Secrets):
       RAILWAY_TOKEN  = project token (Railway → Project → Settings → Tokens)
       RAILWAY_SERVICE_ID = ${API_SERVICE}
  3. GitHub variable: VITE_API_URL = your Railway API URL
  4. Redeploy API: railway redeploy --service ${API_SERVICE}
     or push to main to run the Deploy workflow

EOF
}

main() {
  require_cli
  ensure_postgres
  set_api_variables
  ensure_domain
  print_next_steps
}

main "$@"
