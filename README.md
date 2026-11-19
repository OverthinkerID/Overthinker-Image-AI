<p align="center">
  <img src="docs/assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="520" />
</p>

<p align="center">
  <strong>Local-First &amp; Cloud-Ready AI Brand Identity, Design, Strategy, Marketing &amp; Motion Studio</strong>
</p>

<p align="center">
  <code>v1.0.0</code> · <code>Phases 1–12 Complete</code> · <code>Node.js &gt;= 18.17.0</code> · <code>Next.js 14</code> · <code>Prisma + SQLite</code>
</p>

---

**OIA – Overthinker Image AI** (`v1.0.0`) is a local-first and cloud-ready AI Brand Identity, Design, Strategy, Marketing, and Motion Studio built as a TypeScript monorepo (`apps/api` Express + Prisma + SQLite, `apps/web` Next.js 14 + Tailwind CSS + Fabric.js with Overthinker Studio UI).

---

## ✨ Key Features (Phases 1–12)

| Phase | Module | Highlights |
| :---: | --- | --- |
| 1 | 🛡️ **Project & Immutable Logo Vault** | Create brand projects and store original logos with SHA-256 hashing and immutable paths. |
| 2 | 🧬 **Logo Analyzer & Brand DNA** | Extract dimensions, aspect ratio, dominant colors, transparency, OCR text, typography confidence, and Brand Personality. |
| 3 | 🎨 **Brand Concepts & Hybrid AI Engine** | Generate 4 distinct brand concept directions with revision history and ComfyUI / Local / Cloud adapters. |
| 4 | ✏️ **Design Engine & Fabric.js Studio** | Logo variations, CMYK/WCAG color systems, typography systems, graphic elements, templates, and SVG/PNG/PDF exports. |
| 5 | 📦 **Smart Mockup Studio & Guidelines** | Categorized mockup library (Stationery, Packaging, Environment, Merchandise, Digital, Retail), Brand Guidelines & Presentations. |
| 6 | ⚙️ **Automation, Batch & Export** | Automatic, Semi-Automatic, and Manual workflows, sequential batch generation, QC checks, and 14-folder commercial ZIP export. |
| 7 | 🏢 **Multi-Workspace, Clients & SaaS** | `LOCAL` & `SAAS` editions, RBAC, Client CRM, Client Portal, Comments/Notifications, Billing/Usage quotas, Local/S3 storage. |
| 8 | 🧠 **AI Creative Director** | Context-aware Creative Director chat, Logo Intelligence, Design Critic, Brand Consistency audit, Creative Briefs & PDF reports. |
| 9 | 🖼️ **AI Image Editing Studio** | Non-destructive versioned editing (crop, resize, rotate, flip, adjust, upscale, bg remove/replace), masks, protected logo regions. |
| 10 | 📊 **Market Research & Brand Strategy** | Source-grounded research, competitor comparison, personas, brand positioning, naming/taglines & 22-section reports (PDF/DOCX/JSON). |
| 11 | 📣 **AI Marketing & Growth Studio** | 3-mode Strategist, 6-platform Social Studio, Copywriting A/B/C, Calendar, Ad Studio + Budget Estimator, 14-stage Campaign ZIP, sanitized Landing Pages, AES-256-GCM Integrations, 7-step Publishing Preflight, CSV Analytics. |
| 12 | 🎬 **AI Brand Video & Motion + Hardening** | 12 Video Templates, Storyboard & Script Studio, deterministic Logo Animation, consent-gated Voice Profiles & SRT, 5-track Timeline Editor, MP4/WebM render + editable ZIP, Video QC, Diagnostics & SQLite Backup/Restore. |

---

## ⚖️ Local Edition vs. Cloud Edition

| Capability | 💻 Local Edition (`APP_EDITION=LOCAL`) | ☁️ Cloud Edition (`APP_EDITION=SAAS`) |
| --- | --- | --- |
| **Authentication** | Automatic local owner context (`usr_local_owner`) | Strict session auth, email verification, optional TOTP 2FA |
| **Multi-Tenancy & RBAC** | Single default workspace (`ws_local_default`) | Strict workspace isolation & role-based permissions |
| **Database** | SQLite (`apps/api/prisma/dev.db`) | SQLite in persistent Docker volume (`apps/api/prisma/dev.db`) |
| **Storage** | Local filesystem (`./storage`) | Local volume or S3-compatible object storage |
| **AI Execution** | Heuristic / Ollama / LM Studio / ComfyUI | Hybrid Local + Cloud (OpenAI / Gemini) with consent gate |

---

## 💻 System Requirements
- **Node.js**: `>= 18.17.0` (Node 20 LTS recommended)
- **npm**: `>= 9.x`
- **OS**: macOS, Linux, or Windows x64 (with `packaging/local-windows/` launcher)
- **Optional Media & AI Tools**:
  - `ffmpeg` in `PATH` for MP4 & WebM video rendering (falls back cleanly to editable motion bundle if absent)
  - Ollama (`http://localhost:11434`), LM Studio (`http://localhost:1234/v1`), or ComfyUI (`http://localhost:8188`)

---

## 🚀 Quick Start

```bash
# 1. Install workspace dependencies
npm install

# 2. Copy environment template
cp .env.example apps/api/.env

# 3. Generate Prisma client & apply all 12 database migrations
npm run db:generate
cd apps/api && npx prisma migrate deploy && cd ../..

# 4. Start API (port 4000) and Web UI (port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser. Press `Ctrl+C` in the terminal to stop both servers gracefully.

---

## 📚 Documentation

| Guide | Description |
| --- | --- |
| 📦 [Installation Guide](docs/INSTALLATION.md) | Step-by-step local setup and verification |
| 💻 [Local Edition Guide](docs/LOCAL-EDITION.md) | Single-user workstation mode & Windows x64 launcher |
| ☁️ [Cloud Edition Guide](docs/CLOUD-EDITION.md) | Docker Compose deployment & HTTPS reverse proxy |
| 🤖 [AI Providers Setup](docs/AI-PROVIDERS.md) | Heuristic, Ollama, LM Studio, ComfyUI & Cloud AI setup |
| ⚙️ [Configuration Reference](docs/CONFIGURATION.md) | Environment variables reference |
| 💾 [Backup & Restore](docs/BACKUP-RESTORE.md) | SQLite snapshot backup & restore endpoints |
| 🔧 [Troubleshooting](docs/TROUBLESHOOTING.md) | Common issues and quick fixes |
| 🛡️ [Security Policy](SECURITY.md) | Security architecture & vulnerability reporting |
| 📋 [Changelog](CHANGELOG.md) | Release history (`v1.0.0-rc.1`, `v1.0.0`) |
| 🤝 [Contributing](CONTRIBUTING.md) | Contribution & verification checklist |

---

## ⚠️ Known Limitations (`v1.0.0`)
- **Database Engine**: `v1.0.0` uses SQLite via Prisma (`provider = "sqlite"`). PostgreSQL DDL is not bundled in `v1.0.0` migrations.
- **External Integrations**: Live social publishing, web search research, and domain availability checks require external API credentials; unconfigured integrations report `NOT_CONNECTED` or `EXTERNAL_PROVIDER_NOT_CONFIGURED`.
- **Video Rendering**: Without `ffmpeg` installed on the host/container, render jobs complete with an editable timeline bundle and fallback render artifact.
- **MP4 Alpha Channel**: Standard MP4 (`yuv420p`) does not support alpha transparency; use `WEBM` for alpha-capable renders.
