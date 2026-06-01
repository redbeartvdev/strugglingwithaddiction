# Deployment guide — Railway + Netlify

This project runs as **three separate deploys**:

1. **Backend API** + **PostgreSQL** → Railway  
2. **Public website** → Netlify (repo root)  
3. **Admin CMS** → Netlify (`admin/` folder)

Railway is already connected to GitHub for this repo. Follow the steps below to go live.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Netlify        │     │  Netlify        │
│  Public site    │     │  Admin CMS      │
│  (/)            │     │  (/admin)       │
└────────┬────────┘     └────────┬────────┘
         │  VITE_API_URL          │
         └──────────┬─────────────┘
                    ▼
         ┌─────────────────────┐
         │  Railway            │
         │  FastAPI (backend/) │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  Railway PostgreSQL │
         └─────────────────────┘
```

---

## Auto-deploy (GitHub Actions)

Every push to **`main`** triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. **Railway** — builds & deploys `backend/`
2. **Netlify** — builds & deploys public site (`dist/`)
3. **Netlify** — builds & deploys admin (`admin/dist/`)

Pull requests run [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (build only, no deploy).

You can also trigger a deploy manually: **GitHub → Actions → Deploy → Run workflow**.

### One-time setup: GitHub secrets & variables

Go to **GitHub repo → Settings → Secrets and variables → Actions**.

**Secrets** (encrypted):

| Name | Where to get it |
|------|-----------------|
| `RAILWAY_TOKEN` | Railway → Project → **Settings → Tokens** (project token, not account token) |
| `RAILWAY_SERVICE_ID` | Service name (`strugglingwithaddiction`) or UUID from Railway → service → Settings |
| `NETLIFY_AUTH_TOKEN` | [Netlify → User settings → Applications](https://app.netlify.com/user/applications) → New access token |
| `NETLIFY_SITE_ID` | Netlify → public site → Site configuration → Site ID |
| `NETLIFY_ADMIN_SITE_ID` | Netlify → admin site → Site configuration → Site ID |

**Variables** (plain text, repo → Variables tab):

| Name | Example |
|------|---------|
| `VITE_API_URL` | `https://your-api.up.railway.app` |
| `VITE_PUBLIC_SITE_URL` | `https://your-public.netlify.app` |

### Railway still needs Postgres + env vars

GitHub Actions deploys the API code, but you must **once** set up on Railway:

- PostgreSQL database (linked `DATABASE_URL`)
- `JWT_SECRET`, `ENVIRONMENT=production`, `CORS_ORIGINS`, bootstrap admin credentials

See Part 1 below. After that, every push to `main` redeploys automatically.

### Disable Railway native GitHub hook (optional)

If Railway **also** auto-deploys from GitHub, you may get double deploys. Either:

- Use **GitHub Actions only** → disable auto-deploy on the Railway service, **or**
- Use **Railway native hook only** → delete/disable the Deploy workflow

Recommended: **GitHub Actions** for all three apps (single pipeline).

---

## Part 1 — Railway (API + database)

### Option A — Railway dashboard (recommended if GitHub is already linked)

1. Open [Railway Dashboard](https://railway.app/dashboard) → your project (or **New Project** → **Deploy from GitHub repo** → select `strugglingwithaddiction`).

2. **Add PostgreSQL**
   - In the project: **+ New** → **Database** → **PostgreSQL**
   - Railway creates `DATABASE_URL` automatically.

3. **Add the API service**
   - **+ New** → **GitHub Repo** → same repo (or use existing service)
   - Open service **Settings**:
     - **Root Directory:** `backend`
     - **Builder:** Dockerfile (`backend/Dockerfile`)
   - The included [`backend/railway.toml`](backend/railway.toml) sets:
     - Health check: `/health`
     - Start command: `uvicorn` on `$PORT`

4. **Link database to API**
   - API service → **Variables** → **Add Reference** → select Postgres → `DATABASE_URL`

5. **Set required variables** on the API service:

   | Variable | Example / notes |
   |----------|-----------------|
   | `DATABASE_URL` | Reference from Postgres service |
   | `JWT_SECRET` | Generate: `openssl rand -hex 32` |
   | `ENVIRONMENT` | `production` |
   | `CORS_ORIGINS` | `https://YOUR-PUBLIC.netlify.app,https://YOUR-ADMIN.netlify.app` |
   | `PUBLIC_SITE_URL` | `https://YOUR-PUBLIC.netlify.app` |
   | `ADMIN_SITE_URL` | `https://YOUR-ADMIN.netlify.app` |
   | `ADMIN_BOOTSTRAP_EMAIL` | Your admin email |
   | `ADMIN_BOOTSTRAP_PASSWORD` | Strong password (used on **first boot only**) |

   Optional (add when ready):

   | Variable | Purpose |
   |----------|---------|
   | `STRIPE_SECRET_KEY` | Billing |
   | `STRIPE_WEBHOOK_SECRET` | Billing webhooks |
   | `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | Stripe price IDs |
   | `S3_*` | Cloudflare R2 / AWS S3 for uploads |

6. **Deploy**
   - Push to GitHub or click **Deploy** in Railway.
   - Wait for build; confirm: `https://YOUR-SERVICE.up.railway.app/health` → `{"status":"ok"}`

7. **Generate public domain**
   - API service → **Settings** → **Networking** → **Generate Domain**
   - Copy the URL (e.g. `https://swa-api-production.up.railway.app`) — you need this for Netlify.

### Option B — Railway CLI

```bash
# One-time login (opens browser)
railway login

cd backend
railway link          # link to existing project, or: railway init
railway add --database postgres
railway variables set JWT_SECRET="$(openssl rand -hex 32)"
railway variables set ENVIRONMENT=production
railway variables set CORS_ORIGINS="https://your-public.netlify.app,https://your-admin.netlify.app"
railway variables set PUBLIC_SITE_URL="https://your-public.netlify.app"
railway variables set ADMIN_SITE_URL="https://your-admin.netlify.app"
railway variables set ADMIN_BOOTSTRAP_EMAIL="you@example.com"
railway variables set ADMIN_BOOTSTRAP_PASSWORD="your-secure-password"
railway up
railway domain        # generate public URL
```

### First deploy — what happens automatically

On startup the API:

- Creates database tables
- Runs lightweight migrations (`db_migrate.py`)
- Creates admin user (if none exists)
- Seeds 5 sample rehab centers (if table is empty)

### Seed blog content on Railway (optional)

```bash
cd backend
railway link
railway run python scripts/seed_from_json.py
```

Requires `src/data/posts.json` (from `node scripts/extract-posts.mjs` locally, committed or uploaded).

### Media uploads on Railway

By default uploads go to `backend/uploads/` on the container filesystem (ephemeral). For production, configure S3-compatible storage (Cloudflare R2 recommended):

```
S3_ENDPOINT_URL=https://....r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=swa-uploads
S3_PUBLIC_URL=https://cdn.yourdomain.com
```

Or attach a [Railway Volume](https://docs.railway.app/guides/volumes) mounted at `/app/uploads`.

### Stripe webhooks (when billing is enabled)

In Stripe Dashboard → Webhooks → Add endpoint:

```
https://YOUR-RAILWAY-API.up.railway.app/api/billing/webhook
```

Set `STRIPE_WEBHOOK_SECRET` on Railway from the signing secret Stripe provides.

---

## Part 2 — Netlify (public site)

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import from Git** → select repo.

2. Build settings:

   | Setting | Value |
   |---------|-------|
   | Base directory | *(leave empty — repo root)* |
   | Build command | `npm run build` |
   | Publish directory | `dist` |

   (`netlify.toml` in the repo root sets this automatically.)

3. **Environment variables:**

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://YOUR-RAILWAY-API.up.railway.app` |

4. Deploy → note your URL (e.g. `https://swa-site.netlify.app`).

5. Update Railway `CORS_ORIGINS` and `PUBLIC_SITE_URL` if you didn’t already.

---

## Part 3 — Netlify (admin CMS)

1. **Add another site** from the **same repo**.

2. Build settings:

   | Setting | Value |
   |---------|-------|
   | Base directory | `admin` |
   | Build command | `npm run build` |
   | Publish directory | `admin/dist` |

   (`admin/netlify.toml` configures redirects for SPA routing.)

3. **Environment variables:**

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://YOUR-RAILWAY-API.up.railway.app` |
   | `VITE_PUBLIC_SITE_URL` | `https://YOUR-PUBLIC.netlify.app` |

4. Deploy → note admin URL.

5. Update Railway `CORS_ORIGINS` and `ADMIN_SITE_URL` to include the admin Netlify URL, then redeploy API if CORS was wrong on first try.

---

## Post-deploy checklist

- [ ] `GET https://YOUR-API/health` returns `{"status":"ok"}`
- [ ] Public site loads rehab centers from API (not just static fallback)
- [ ] Admin login works at `/login`
- [ ] Change default admin password in **Profile**
- [ ] `CORS_ORIGINS` includes both Netlify URLs exactly
- [ ] Stripe webhook registered (if using billing)
- [ ] S3/R2 or Railway volume configured for uploads (if using media in admin)

---

## Custom domains (optional)

| Service | Where to configure |
|---------|-------------------|
| Public site | Netlify → Domain settings |
| Admin | Netlify → Domain settings |
| API | Railway → Service → Settings → Custom Domain |

After adding custom domains, update `CORS_ORIGINS`, `PUBLIC_SITE_URL`, and `ADMIN_SITE_URL` on Railway, and `VITE_API_URL` on both Netlify sites.

---

## Redeploying

| Change | Action |
|--------|--------|
| Backend code | Push to GitHub → Railway auto-deploys |
| Public site | Push → Netlify auto-builds |
| Admin | Push → Netlify auto-builds |
| Env vars only | Update in Railway/Netlify dashboard → redeploy |

---

## Railway CLI reference

```bash
railway login
railway link
railway status
railway logs
railway variables
railway run python scripts/seed_from_json.py
railway open
```

---

## Troubleshooting

### API build fails on Railway

- Confirm **Root Directory** is `backend`
- Check build logs for missing `libpq` — Dockerfile installs it

### `postgres://` vs `postgresql://`

Railway may provide `postgres://`. The app normalizes this automatically in `config.py`.

### Database empty after redeploy

Postgres on Railway is persistent. If tables are missing, check `DATABASE_URL` is referenced correctly and review deploy logs for migration errors.

### CORS blocked in browser

`CORS_ORIGINS` must match frontend origins exactly (scheme + host, no path). After changing, redeploy the API.

### Admin shows static rehab data only

`VITE_API_URL` was not set at **build time** on Netlify. Rebuild after adding the variable.

### Uploads disappear after redeploy

Use S3/R2 or a Railway Volume — container disk is not persistent.

---

## Need help with Railway setup?

If you want an agent to configure Railway directly, run this once in your terminal (opens browser login):

```bash
railway login
```

Then ask the agent to link the project, provision Postgres, set variables, and deploy. The CLI must be authenticated on your machine first.
