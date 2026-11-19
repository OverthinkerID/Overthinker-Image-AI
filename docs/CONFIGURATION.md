<p align="center">
  <img src="assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="420" />
</p>

<p align="center">
  <a href="../README.md">🏠 Home</a> · <a href="AI-PROVIDERS.md">🤖 AI Providers</a> · <a href="LOCAL-EDITION.md">💻 Local Edition</a>
</p>

---

# Configuration Reference — OIA – Overthinker Image AI

| Variable | Default | Description |
| --- | --- | --- |
| `APP_EDITION` | `LOCAL` | `LOCAL` (auto local owner) or `SAAS` (strict session auth) |
| `PORT` | `4000` | API server port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin |
| `DATABASE_URL` | `file:./dev.db` | SQLite database path (relative to `apps/api/prisma/schema.prisma`) |
| `STORAGE_ROOT` | `./storage` | Root folder for logos, mockups, exports, video renders, and backups |
| `MAX_LOGO_FILE_SIZE_MB` | `15` | Maximum logo upload size in MB |
| `AI_PROVIDER` | `heuristic` | Active AI provider (`heuristic`, `local-ollama`, `local-openai`, `cloud-openai`, `cloud-gemini`) |
| `AI_MODE` | `HYBRID` | Execution policy (`LOCAL_ONLY`, `CLOUD_ONLY`, `HYBRID`) |
| `MARKETING_TOKEN_SECRET` | Local fallback | Secret key used for AES-256-GCM encryption of platform OAuth tokens |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | Frontend API base URL |
