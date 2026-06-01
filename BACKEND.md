# SWA Backend & Admin Platform

## Local development

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

Postgres listens on **localhost:5433** (see `docker-compose.yml`).

### 2. Backend API

```bash
cd backend
cp .env.example .env
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Default admin (created on first boot):

- Email: `admin@example.com`
- Password: `changeme123`

### 3. Seed blog content

```bash
# Optional: refresh posts from WordPress
node scripts/extract-posts.mjs

cd backend && source .venv/bin/activate
python scripts/seed_from_json.py
```

### 4. Admin SPA

```bash
cd admin
cp .env.example .env
npm install
npm run dev
```

Open http://127.0.0.1:5180/login (admin uses port **5180** to avoid conflicts with other Vite apps)

### 5. Public site with API

```bash
cp .env.example .env   # VITE_API_URL empty = Vite proxies /api (recommended locally)
npm run dev            # http://127.0.0.1:5173
```

**Or run everything:** `chmod +x scripts/dev.sh && ./scripts/dev.sh`

### Troubleshooting "Failed to fetch"

1. Ensure the API is running: `curl http://127.0.0.1:8000/health`
2. Use **empty** `VITE_API_URL` in `.env` / `admin/.env` so Vite proxies requests (avoids CORS).
3. Admin app: **http://127.0.0.1:5180** (not 5174 — that port may be used by another project).

## Deployment

**Full production guide:** [DEPLOYMENT.md](../DEPLOYMENT.md) (Railway API + Postgres, Netlify frontends)

Quick summary:

1. Deploy `backend/` on **Railway** with PostgreSQL (root directory: `backend`, Dockerfile build).
2. Set `DATABASE_URL`, `JWT_SECRET`, `ENVIRONMENT=production`, and `CORS_ORIGINS`.
3. Deploy public site and `admin/` on **Netlify** with `VITE_API_URL` pointing to your Railway API URL.
4. Register Stripe webhook: `POST https://your-api.example.com/api/billing/webhook` (when billing is enabled).

## API overview

| Area | Public routes |
|------|----------------|
| Blog | `GET /api/posts`, `GET /api/posts/{slug}` |
| Rehab | `GET /api/rehab-centers`, `POST /api/rehab/claims` |
| Partners | `GET /api/partners/{slug}` |

Authenticated routes use `Authorization: Bearer <access_token>` from `POST /api/auth/login`.
