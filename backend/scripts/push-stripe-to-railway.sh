#!/usr/bin/env bash
# Push live Stripe keys from backend/.env onto the production Railway service.
#
# Usage:
#   railway login
#   # or: export RAILWAY_TOKEN="project-token-from-railway-dashboard"
#   ./backend/scripts/push-stripe-to-railway.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${STRIPE_ENV_FILE:-$ROOT/backend/.env}"
RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-407fa40d-6608-4441-905c-f3fab0182421}"
API_SERVICE="${RAILWAY_API_SERVICE:-strugglingwithaddiction-production}"
ENV_NAME="${RAILWAY_ENVIRONMENT:-production}"

die() { echo "error: $*" >&2; exit 1; }

command -v railway >/dev/null || die "Install: npm install -g @railway/cli"
[[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE"

if [[ -n "${RAILWAY_TOKEN:-}" ]]; then
  export RAILWAY_TOKEN
elif ! railway whoami >/dev/null 2>&1; then
  die "Run: railway login   OR: export RAILWAY_TOKEN=<project-token>"
fi

# Load only STRIPE_* from .env (no export of unrelated secrets).
eval "$(
  python3 - "$ENV_FILE" <<'PY'
import shlex, sys
path = sys.argv[1]
wanted = {
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_MONTHLY",
    "STRIPE_PRICE_YEARLY",
    "STRIPE_PRICE_VERIFIED_BADGE",
    "STRIPE_PRICE_FEATURED_PLACEMENT",
    "STRIPE_MODE",
}
for raw in open(path, encoding="utf-8"):
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key in wanted:
        print(f"{key}={shlex.quote(value)}")
PY
)"

[[ -n "${STRIPE_SECRET_KEY:-}" ]] || die "STRIPE_SECRET_KEY is empty in $ENV_FILE"
[[ -n "${STRIPE_WEBHOOK_SECRET:-}" ]] || die "STRIPE_WEBHOOK_SECRET is empty in $ENV_FILE"

STRIPE_MODE="${STRIPE_MODE:-live}"
STRIPE_PRICE_MONTHLY="${STRIPE_PRICE_MONTHLY:-price_1UDycl7916C3OAmE5bi5arRn}"
STRIPE_PRICE_YEARLY="${STRIPE_PRICE_YEARLY:-price_1UDycm7916C3OAmEozHX6ini}"
STRIPE_PRICE_VERIFIED_BADGE="${STRIPE_PRICE_VERIFIED_BADGE:-price_1UDycw7916C3OAmEQICZf0D6}"
STRIPE_PRICE_FEATURED_PLACEMENT="${STRIPE_PRICE_FEATURED_PLACEMENT:-price_1UDycw7916C3OAmEgDDwytP9}"

echo "Setting Stripe variables on ${API_SERVICE} (${ENV_NAME})…"
railway variable set \
  "STRIPE_MODE=${STRIPE_MODE}" \
  "STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}" \
  "STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}" \
  "STRIPE_PRICE_MONTHLY=${STRIPE_PRICE_MONTHLY}" \
  "STRIPE_PRICE_YEARLY=${STRIPE_PRICE_YEARLY}" \
  "STRIPE_PRICE_VERIFIED_BADGE=${STRIPE_PRICE_VERIFIED_BADGE}" \
  "STRIPE_PRICE_FEATURED_PLACEMENT=${STRIPE_PRICE_FEATURED_PLACEMENT}" \
  --project "$RAILWAY_PROJECT_ID" \
  --service "$API_SERVICE" \
  --environment "$ENV_NAME"

echo "Stripe live catalog is now on Railway. Redeploy if the service does not pick up new variables automatically."
echo "Check: curl -sS -X POST https://strugglingwithaddiction.com/api/billing/webhook should return 400, not 503."
