<p align="center">
  <img src="assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="420" />
</p>

<p align="center">
  <a href="../README.md">🏠 Home</a> · <a href="INSTALLATION.md">📦 Installation</a> · <a href="LOCAL-EDITION.md">💻 Local Edition</a> · <a href="BACKUP-RESTORE.md">💾 Backup &amp; Restore</a>
</p>

---

# Cloud Edition Guide — OIA – Overthinker Image AI

## Overview
Cloud Edition (`APP_EDITION=SAAS`) enables multi-user authentication, strict workspace tenant isolation, RBAC, client portals, and usage quotas.

## Docker Compose Deployment
See `packaging/cloud-docker/` for `Dockerfile.api`, `Dockerfile.web`, and `docker-compose.yml`:
1. Copy `.env.example` to `packaging/cloud-docker/.env` and set:
   - `APP_EDITION=SAAS`
   - Strong random `MARKETING_TOKEN_SECRET` and `SESSION_SECRET`
   - `CORS_ORIGIN=https://your-domain.example`
   - `NEXT_PUBLIC_API_URL=https://your-domain.example/api/v1`
2. Start services:
   ```bash
   docker compose -f packaging/cloud-docker/docker-compose.yml up -d --build
   ```
3. Persistent Volumes:
   - `oia_db_data`: Persists SQLite database at `/app/data/dev.db`
   - `oia_storage_data`: Persists uploaded logos, renders, exports, and backups at `/app/storage`

## Reverse Proxy & HTTPS
Place Nginx or Caddy in front of containers (`web:3000` and `api:4000`), terminate TLS with Let's Encrypt, and route `/api/` to `api:4000` and `/` to `web:3000`.
