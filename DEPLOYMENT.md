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

### 2. Database + environment variables (CLI)

```bash
railway login
cd /path/to/strugglingwithaddiction   # repo root
railway link -s strugglingwithaddiction

# Optional: your Railway URL if you already have a domain
export PUBLIC_SITE_URL="https://strugglingwithaddiction-production.up.railway.app"

./backend/scripts/railway-setup.sh
```

The script:

- Adds **PostgreSQL** if missing
- Sets `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `JWT_SECRET`, `ENVIRONMENT=production`, CORS, bootstrap admin
- Generates a public domain if needed

### 3. Manual variable checklist

On the **API service** (not Postgres):

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference) |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ENVIRONMENT` | `production` |
| `PUBLIC_SITE_URL` | `https://your-app.up.railway.app` |
| `ADMIN_SITE_URL` | `https://your-app.up.railway.app/admin` |
| `CORS_ORIGINS` | same as both URLs above, comma-separated |
| `ADMIN_BOOTSTRAP_EMAIL` | your email |
| `ADMIN_BOOTSTRAP_PASSWORD` | strong password (first boot only) |

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

---

## Optional: Stripe, S3

| Variable | Purpose |
|----------|---------|
| `STRIPE_*` | Billing |
| `S3_*` | Upload storage (or use a Railway Volume on `/app/uploads`) |
