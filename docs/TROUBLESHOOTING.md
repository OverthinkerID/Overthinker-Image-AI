<p align="center">
  <img src="assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="420" />
</p>

<p align="center">
  <a href="../README.md">🏠 Home</a> · <a href="INSTALLATION.md">📦 Installation</a> · <a href="CONFIGURATION.md">⚙️ Configuration</a>
</p>

---

# Troubleshooting Guide — OIA – Overthinker Image AI

## 1. `Environment variable not found: DATABASE_URL` or `The table main.users does not exist`
- Ensure `apps/api/.env` exists with `DATABASE_URL="file:./dev.db"`.
- Run migrations from `apps/api`:
  ```bash
  cd apps/api && npx prisma migrate deploy
  ```

## 2. Port `3000` or `4000` Already in Use
- Stop any running Node processes on ports 3000/4000 or set `PORT=4001` in `apps/api/.env` and update `NEXT_PUBLIC_API_URL` accordingly.

## 3. Video Render Produces Fallback Artifact Instead of H.264 MP4
- Install `ffmpeg` and ensure `ffmpeg -version` works in your terminal `PATH`. Check `GET /api/v1/diagnostics/system` under `mediaTools.ffmpeg.available`.

## 4. Platform Integration Shows `NOT_CONNECTED` or `NOT_SUPPORTED`
- External social publishing requires valid OAuth client credentials and completed OAuth callback. `X_TWITTER` is intentionally marked `NOT_SUPPORTED` in default local mode.
