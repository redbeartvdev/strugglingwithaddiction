# Struggling With Addiction

A full-stack addiction recovery resource platform: public marketing site, rehab center directory with advanced search, blog, partner portal, and admin CMS.

| App | Stack | Local URL |
|-----|-------|-----------|
| **Public site** | React + Vite | http://127.0.0.1:5173 |
| **Admin CMS** | React + Vite | http://127.0.0.1:5180 |
| **API** | FastAPI + PostgreSQL | http://127.0.0.1:8000 |

**Repository:** [github.com/redbeartvdev/strugglingwithaddiction](https://github.com/redbeartvdev/strugglingwithaddiction)

---

## What’s in this repo

```
├── src/              Public website (React)
├── admin/            Admin & client portal (React)
├── backend/          FastAPI API + PostgreSQL models
├── public/           Static assets (images, icons)
├── scripts/          Dev helpers, blog import, image tools
├── docker-compose.yml   Local Postgres (+ Redis)
└── DEPLOYMENT.md     Production setup (Railway + Netlify)
```

### Features

- **Blog** — posts, authors, categories, SEO fields, Editor.js in admin
- **Rehab directory** — searchable listings with state & service filters, claim workflow
- **Admin** — users, posts, rehab centers, billing, AI scrape tools
- **Client portal** — claimed centers manage their listing & posts
- **Billing** — Stripe subscriptions (optional)

---

## Quick start (local)

### Prerequisites

- Node.js 20+
- Python 3.12+
- Docker (for Postgres)

### 1. Clone & install

```bash
git clone https://github.com/redbeartvdev/strugglingwithaddiction.git
cd strugglingwithaddiction

npm install
npm install --prefix admin

cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 2. Environment files

```bash
cp .env.example .env
cp admin/.env.example admin/.env
cp backend/.env.example backend/.env
```

Leave `VITE_API_URL` **empty** locally — Vite proxies `/api` to the backend (no CORS issues).

### 3. Start Postgres

```bash
docker compose up -d postgres
```

Postgres runs on **localhost:5433** (see `docker-compose.yml`).

### 4. Run everything (easiest)

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

Or run services separately:

```bash
# Terminal 1 — API
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — public site
npm run dev

# Terminal 3 — admin
npm run dev --prefix admin
```

### 5. Log in to admin

On first boot the API creates a default admin:

| Field | Value |
|-------|-------|
| URL | http://127.0.0.1:5180/login |
| Email | `admin@example.com` |
| Password | `changeme123` |

Change these via `ADMIN_BOOTSTRAP_*` in `backend/.env` **before** first run, or change password in admin after login.

### 6. Seed blog posts (optional)

```bash
node scripts/extract-posts.mjs          # pull from WordPress export (optional)
cd backend && source .venv/bin/activate
python scripts/seed_from_json.py
```

Rehab centers are seeded automatically on first API start.

---

## Environment variables

### Public site (`.env`)

| Variable | Local | Production |
|----------|-------|------------|
| `VITE_API_URL` | *(empty — uses proxy)* | `https://your-api.up.railway.app` |

### Admin (`admin/.env`)

| Variable | Local | Production |
|----------|-------|------------|
| `VITE_API_URL` | *(empty)* | Railway API URL |
| `VITE_PUBLIC_SITE_URL` | `http://127.0.0.1:5173` | Your public Netlify URL |

### API (`backend/.env`)

See [`backend/.env.example`](backend/.env.example). Required for production:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string |
| `ENVIRONMENT` | `production` |
| `CORS_ORIGINS` | Comma-separated frontend URLs |
| `PUBLIC_SITE_URL` | Public site URL |
| `ADMIN_SITE_URL` | Admin site URL |

Optional: Stripe keys, S3/R2 for media uploads.

Full reference: [`BACKEND.md`](BACKEND.md)

---

## Production deployment

**Recommended stack:**

| Service | Host | Auto-deploy |
|---------|------|-------------|
| API + PostgreSQL | [Railway](https://railway.app) | GitHub Actions on push to `main` |
| Public site | [Netlify](https://netlify.com) | GitHub Actions on push to `main` |
| Admin CMS | Netlify (`admin/`) | GitHub Actions on push to `main` |

Step-by-step setup (secrets, database, first deploy): **[DEPLOYMENT.md](DEPLOYMENT.md)**

---

## API docs

With the API running:

- Health: `GET /health`
- Swagger UI: http://127.0.0.1:8000/docs

Public routes include `/api/posts`, `/api/rehab-centers`, `/api/rehab/claims`. Authenticated routes use `Authorization: Bearer <token>` from `POST /api/auth/login`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Public site (port 5173) |
| `npm run dev:admin` | Admin app |
| `npm run dev:api` | API (requires venv) |
| `npm run build` | Production build (public) |
| `./scripts/dev.sh` | Postgres + API + both frontends |
| `node scripts/extract-posts.mjs` | Import blog JSON from WordPress |
| `python backend/scripts/seed_from_json.py` | Seed posts into DB |

---

## Troubleshooting

### “Failed to fetch” / API unreachable

1. Confirm API: `curl http://127.0.0.1:8000/health`
2. Keep `VITE_API_URL` empty locally so Vite proxies requests
3. Admin runs on port **5180**, not 5174

### Postgres connection refused

```bash
docker compose up -d postgres
docker compose ps
```

Ensure `DATABASE_URL` in `backend/.env` uses port **5433**.

### CORS errors in production

Set `CORS_ORIGINS` on Railway to your exact Netlify URLs (no trailing slash):

```
https://your-site.netlify.app,https://your-admin.netlify.app
```

---

## License

See [LICENSE](LICENSE).
