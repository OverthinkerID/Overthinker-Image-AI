<p align="center">
  <img src="assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="420" />
</p>

<p align="center">
  <a href="../README.md">🏠 Home</a> · <a href="INSTALLATION.md">📦 Installation</a> · <a href="CLOUD-EDITION.md">☁️ Cloud Edition</a> · <a href="TROUBLESHOOTING.md">🔧 Troubleshooting</a>
</p>

---

# Local Edition Guide — OIA – Overthinker Image AI

## Overview
Local Edition (`APP_EDITION=LOCAL`) is designed for single-user desktop/workstation use with zero external cloud dependencies required.

- **Binding**: Binds to `localhost:4000` (API) and `localhost:3000` (Web UI).
- **Default Context**: Automatically initializes `usr_local_owner` and `ws_local_default` (`Local Brand Studio`).
- **Database**: Local SQLite at `apps/api/prisma/dev.db`.
- **Storage**: Local filesystem at `./storage` (configurable via `STORAGE_ROOT`).

## Windows x64 Portable Distribution
The Windows x64 distribution (`OIA-Overthinker-Image-AI-v1.0.0-Windows-x64.zip`) includes:
- `start-oia.bat` & `start-oia.ps1`: Checks Node.js (`>=18.17.0`), creates `.env` from `.env.example` if missing, runs `prisma migrate deploy`, starts API & Web servers, and opens `http://localhost:3000`.
- `stop-oia.bat`: Gracefully stops OIA processes.
- Prebuilt `apps/api/dist` and `apps/web/.next` (or source + build script when packaged from CI).

## Stopping Safely
Press `Ctrl+C` in the launcher terminal or run `stop-oia.bat` so SQLite WAL/journals flush cleanly before exit.
