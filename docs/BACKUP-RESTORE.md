<p align="center">
  <img src="assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="420" />
</p>

<p align="center">
  <a href="../README.md">🏠 Home</a> · <a href="CLOUD-EDITION.md">☁️ Cloud Edition</a> · <a href="TROUBLESHOOTING.md">🔧 Troubleshooting</a>
</p>

---

# Backup & Restore Guide — OIA – Overthinker Image AI

## Creating a Backup
1. **Via API (Phase 12 Diagnostics)**:
   ```bash
   curl -X POST http://localhost:4000/api/v1/diagnostics/backup
   ```
   Creates a timestamped SQLite snapshot in `${STORAGE_ROOT}/_backups/brandforge-backup-<timestamp>.db`.
2. **Manual File Backup**:
   Stop the API server first, then copy both `apps/api/prisma/dev.db` and the `storage/` folder to a safe backup location.

## Restoring a Backup
1. **Via API**:
   ```bash
   curl -X POST http://localhost:4000/api/v1/diagnostics/restore \
     -H "Content-Type: application/json" \
     -d '{"backupPath":"/absolute/path/to/storage/_backups/brandforge-backup-<timestamp>.db"}'
   ```
2. **Manual Restore**:
   Stop the API server, replace `apps/api/prisma/dev.db` and `storage/`, then restart `npm run dev`.
