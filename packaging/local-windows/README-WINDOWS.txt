OIA - Overthinker Image AI v1.0.0 (Windows x64 Local Edition)
=============================================================

1. Prerequisites:
   - Node.js >= 18.17.0 (https://nodejs.org/)
   - Optional: FFmpeg in PATH for MP4/WebM video rendering

2. Quick Start:
   - Extract this ZIP to a local folder (e.g., C:\OIA-Studio).
   - Double-click start-oia.bat.
   - The launcher checks Node.js, initializes apps\api\.env if missing,
     applies SQLite migrations, starts API (port 4000) and Web UI (port 3000),
     and opens http://localhost:3000.

3. Stop Application:
   - Double-click stop-oia.bat.

4. Logs & Data:
   - Logs: logs\oia-api.log and logs\oia-web.log
   - Database: apps\api\prisma\dev.db
   - Storage: storage\
