# Deployment guide — Railway

Everything runs on **one Railway service**: FastAPI API, public website, and admin CMS (`/admin`).

```
Browser → https://your-app.up.railway.app
            ├── /              public site (React)
            ├── /admin         admin CMS (React)
            ├── /api/*         API
            └── /health        health check
```

PostgreSQL is a separate Railway database service in the same project.

---

## One-time Railway setup

### 1. Service settings

In Railway → API service → **Settings**:

| Setting | Value |
|---------|--------|
| **Root Directory** | *(empty — repo root)* **or** `backend` (both supported; see below) |
| **Config file** | `/railway.toml` (repo root, full site) **or** `/backend/railway.toml` (API + prebuilt static) |
| **Start command** | `/bin/sh /app/start.sh` |

**Build failed with `"/admin": not found`?** Root Directory was `backend` but Docker used the monolith file. Use either:

- **Option A (recommended):** Root Directory = empty, Config = `/railway.toml` → builds from [`Dockerfile`](Dockerfile) at repo root.
- **Option B:** Root Directory = `backend`, Config = `/backend/railway.toml` → GitHub Actions runs `prepare-railway-static.sh` then deploys [`backend/Dockerfile`](backend/Dockerfile).

### 2. PostgreSQL + database connection

**Full guide (dashboard + CLI):** [docs/RAILWAY-POSTGRES.md](docs/RAILWAY-POSTGRES.md)

**One command** (after `railway login` or `export RAILWAY_TOKEN=...`):

```bash
cd /path/to/strugglingwithaddiction
./backend/scripts/railway-provision.sh
```

This adds **PostgreSQL**, wires `DATABASE_URL=${{Postgres.DATABASE_URL}}`, sets production env vars, and redeploys.

Manual link:

```bash
railway link --project 407fa40d-6608-4441-905c-f3fab0182421 -s strugglingwithaddiction-production
```

### 3. Manual variable checklist

On the **API service** (not Postgres):

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference) |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ENVIRONMENT` | `production` |
| `PUBLIC_SITE_URL` | `https://strugglingwithaddiction.com` |
| `ADMIN_SITE_URL` | `https://strugglingwithaddiction.com/admin` |
| `CORS_ORIGINS` | same as both URLs above, comma-separated |
| `ADMIN_BOOTSTRAP_EMAIL` | your email |
| `ADMIN_BOOTSTRAP_PASSWORD` | strong password (first boot only) |
| `STRIPE_MODE` | `live` |
| `STRIPE_SECRET_KEY` | `sk_live_…` or `rk_live_…` from Stripe account `acct_1UDvsr7916C3OAmE` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` for `https://strugglingwithaddiction.com/api/billing/webhook` |
| `STRIPE_PRICE_MONTHLY` | `price_1UDycl7916C3OAmE5bi5arRn` |
| `STRIPE_PRICE_YEARLY` | `price_1UDycm7916C3OAmEozHX6ini` |
| `STRIPE_PRICE_VERIFIED_BADGE` | `price_1UDycw7916C3OAmEQICZf0D6` |
| `STRIPE_PRICE_FEATURED_PLACEMENT` | `price_1UDycw7916C3OAmEgDDwytP9` |

### 4. GitHub Actions (auto-deploy)

**Secrets:** `RAILWAY_TOKEN` (project token), `RAILWAY_SERVICE_ID` (service name or UUID)

Every push to **`main`** runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

---

## Verify

```bash
curl https://your-app.up.railway.app/health
# {"status":"ok","database":"connected"}

open https://your-app.up.railway.app/
open https://your-app.up.railway.app/admin
```

`{"detail":"Not Found"}` on `/` means the **API-only image** without frontends — redeploy after a successful monolith build, or use Option A above.

---

## Local development

```bash
docker compose up -d postgres
npm run dev:api          # API :8000
npm run dev              # public :5173
npm run dev:admin        # admin :5180 → use /admin/ when testing production base path
```

---

## Troubleshooting

### `502 Bad Gateway`

Ensure `DATABASE_URL` is linked to Postgres, start command is `/bin/sh /app/start.sh`, and **Root Directory** is `.` (repo root).

### `database: unavailable` on `/health`

Link Postgres `DATABASE_URL` to the API service and redeploy.

### Admin 404

Rebuild with repo-root Docker context so `static/admin/index.html` exists in the image.

### Root URL shows `{"detail":"Not Found"}`

The API is up but the React site was not baked into the image (`register_static_site` skips routes when `static/index.html` is missing).

1. **Recommended:** Railway → service → **Root Directory** = *(empty)*, **Config file** = `/railway.toml` → redeploy.
2. **Alternative:** From your machine (after `railway login`):

   ```bash
   ./scripts/prepare-railway-static.sh
   cd backend && railway up --service <your-api-service>
   ```

   `backend/.dockerignore` must **not** list `static` (otherwise Docker drops the built site).

---

## Optional: Stripe, S3

| Variable | Purpose |
|----------|---------|
| `STRIPE_*` | Billing — live catalog on Stripe account `acct_1UDvsr7916C3OAmE` (see checklist above) |
| `S3_*` | Upload storage (or use a Railway Volume on `/app/uploads`) |

Push local `backend/.env` Stripe keys to Railway (needs project access or `RAILWAY_TOKEN`):

```bash
./backend/scripts/push-stripe-to-railway.sh
```

After deploy, `POST /api/billing/webhook` must return `400` (bad signature), not `503` (`Webhook not configured`).

In Stripe Dashboard → **Settings → Customer emails**, turn on **Successful payments** so cardholders get receipts.
