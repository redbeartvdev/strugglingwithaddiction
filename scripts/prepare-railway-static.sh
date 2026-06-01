#!/usr/bin/env bash
# Build frontends and copy into backend/static for backend-only Railway deploys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Building public site..."
npm ci
npm run build

echo "Building admin..."
(cd admin && npm ci && npm run build)

echo "Copying to backend/static..."
rm -rf backend/static
mkdir -p backend/static/admin
cp -r dist/* backend/static/
cp -r admin/dist/* backend/static/admin/

echo "Done. backend/static is ready for backend/Dockerfile."
