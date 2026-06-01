# Railway PostgreSQL setup

Project: **407fa40d-6608-4441-905c-f3fab0182421**  
API service: **strugglingwithaddiction-production**  
URL: https://strugglingwithaddiction-production.up.railway.app

The API must **not** use `localhost` for the database on Railway. It needs a **referenced** `DATABASE_URL` from a Railway Postgres service.

---

## Option A — One command (CLI)

```bash
railway login
cd /path/to/strugglingwithaddiction
./backend/scripts/railway-provision.sh
```

Or with a **project token** (Railway → Project → **Settings** → **Tokens**):

```bash
export RAILWAY_TOKEN="your-project-token"
./backend/scripts/railway-provision.sh
```

This script:

1. Adds **PostgreSQL** to the project (if missing)
2. Sets on **strugglingwithaddiction-production**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (or your Postgres service name)
   - `ENVIRONMENT` = `production`
   - `JWT_SECRET`, `CORS_ORIGINS`, `PUBLIC_SITE_URL`, `ADMIN_SITE_URL`
   - `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`
3. Triggers a **redeploy**

---

## Option B — Railway dashboard

### 1. Add PostgreSQL

1. Open https://railway.com/project/407fa40d-6608-4441-905c-f3fab0182421  
2. Click **+ New** → **Database** → **Add PostgreSQL**  
3. Wait until the Postgres service shows **Active** (note its name, usually **Postgres**)

### 2. Connect the API to Postgres

1. Click **strugglingwithaddiction-production** (your web service, not Postgres)  
2. Open **Variables**  
3. Click **+ New Variable** → **Add Reference**  
4. Select the **Postgres** service → variable **`DATABASE_URL`**  
5. Confirm the API now shows something like:  
   `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`

### 3. Set other required variables

On **strugglingwithaddiction-production** → **Variables** → **RAW** editor or add one by one:

| Variable | Value |
|----------|--------|
| `ENVIRONMENT` | `production` |
| `JWT_SECRET` | Run locally: `openssl rand -hex 32` |
| `PUBLIC_SITE_URL` | `https://strugglingwithaddiction-production.up.railway.app` |
| `ADMIN_SITE_URL` | `https://strugglingwithaddiction-production.up.railway.app/admin` |
| `CORS_ORIGINS` | `https://strugglingwithaddiction-production.up.railway.app,https://strugglingwithaddiction-production.up.railway.app/admin` |
| `ADMIN_BOOTSTRAP_EMAIL` | Your email |
| `ADMIN_BOOTSTRAP_PASSWORD` | Strong password (used only when no admin exists) |

Do **not** set `DATABASE_URL` to `localhost` or copy from `backend/.env`.

### 4. Redeploy

**strugglingwithaddiction-production** → **Deployments** → **Redeploy** (latest deployment).

### 5. Verify

```bash
curl https://strugglingwithaddiction-production.up.railway.app/health
```

Expected:

```json
{"status":"ok","database":"connected"}
```

On first successful boot the API creates tables and an admin user (from bootstrap variables).

### Import site content (blog, categories, authors)

After Postgres is connected, **redeploy** so the API imports `src/data/*.json` automatically when the posts table is empty.

Manual import (CLI):

```bash
railway login
cd backend
railway link --project 407fa40d-6608-4441-905c-f3fab0182421 -s strugglingwithaddiction-production
railway run --service strugglingwithaddiction-production python scripts/seed_all.py
```

Or from repo root after push (data is bundled in the Docker image at `/app/seed-data`).

Verify posts: `curl "https://strugglingwithaddiction-production.up.railway.app/api/posts?limit=3"`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `{"detail":"Not Found"}` at `/` (API works at `/api/*`) | API-only image — no `static/index.html`. **Recommended:** Railway → service → Settings → **Root Directory** empty, **Config file** `/railway.toml`, redeploy (uses repo-root [`Dockerfile`](../Dockerfile)). **Or:** run `./scripts/prepare-railway-static.sh`, then `cd backend && railway up` (static must not be in [`backend/.dockerignore`](../backend/.dockerignore)). |
| `"database":"unavailable"` | `DATABASE_URL` not referenced from Postgres, or redeploy not done |
| App crashes on deploy | `ENVIRONMENT=production` but `DATABASE_URL` still localhost — add Postgres reference |
| Postgres service not named `Postgres` | Use `${{YourPostgresServiceName.DATABASE_URL}}` or set `RAILWAY_POSTGRES_SERVICE` when running the script |
| Tables empty after connect | Normal on first connect — API runs migrations on startup; check deploy logs |

---

## What the app does with the database

On startup (background thread):

- Creates tables (`Base.metadata.create_all`)
- Runs lightweight migrations (`db_migrate.py`)
- Seeds admin user (if none), plans, sample rehab centers

All of this requires a working `DATABASE_URL` pointing at Railway Postgres.
