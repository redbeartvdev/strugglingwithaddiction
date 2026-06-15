# Monolith image: API + public site + admin (/admin).
# Railway: leave Root Directory empty (repo root). Config: /railway.toml

FROM node:20-bookworm-slim AS public-build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY scripts ./scripts
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
ENV VITE_API_URL=
RUN npm run build

FROM node:20-bookworm-slim AS admin-build
WORKDIR /build/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin/ ./
ENV VITE_API_URL=
ENV VITE_PUBLIC_SITE_URL=
RUN npm run build

FROM python:3.12-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY src/data ./seed-data
COPY --from=public-build /build/dist ./static
COPY public/images ./static/images
COPY public/images ./image-assets
COPY --from=admin-build /build/admin/dist ./static/admin
RUN chmod +x start.sh
ENV PYTHONPATH=/app
EXPOSE 8000
CMD ["/bin/sh", "/app/start.sh"]
