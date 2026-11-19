<p align="center">
  <img src="assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="420" />
</p>

<p align="center">
  <a href="../README.md">🏠 Home</a> · <a href="../CHANGELOG.md">📋 Changelog</a> · <a href="../SECURITY.md">🛡️ Security</a>
</p>

---

# OIA – Overthinker Image AI v1.0.0 Release Notes

## Overview
**OIA – Overthinker Image AI v1.0.0** is the initial stable release of the local-first and cloud-ready AI Brand Identity, Design, Strategy, Marketing, and Motion Studio (Phases 1–12 complete).

## New Features (Phases 1–12)
- **Brand Core (Phases 1–6)**: Immutable SHA-256 Logo Vault, Brand DNA Analyzer, 4 Brand Concepts, Fabric.js Design Studio (SVG/PNG/PDF), Smart Mockup Studio & Brand Guidelines/Presentations, Automation Engine & 14-Folder Commercial Export.
- **Multi-Workspace & SaaS (Phase 7)**: `LOCAL` and `SAAS` editions, RBAC, Client CRM & Portal, Collaboration Comments/Notifications, Billing/Usage Quotas, Local & S3 storage abstraction.
- **Brand Intelligence & Image Editing (Phases 8–9)**: AI Creative Director, Logo Intelligence, Design Critic, Non-Destructive Image Editor, Masking, Protected Regions & Deterministic Logo Compositing.
- **Market Strategy & Marketing Growth (Phases 10–11)**: Source-grounded Market Research, Competitor & Audience Personas, 22-Section Strategy Reports (PDF/DOCX/JSON), 3-Mode Marketing Strategist, 6-Platform Social Studio, Content Calendar, Ad Studio + Budget Estimator, 14-Stage Campaign ZIP, Sanitized Landing Pages, AES-256-GCM Platform Integrations, 7-Step Publishing Preflight & CSV Analytics.
- **Video & Motion Studio + Hardening (Phase 12)**: 12 Brand Video Templates, Script & Storyboard Studio, Deterministic Logo Animation, Consent-Gated Voice Profiles & SRT Subtitles, 5-Track Timeline Editor, MP4/WebM Render + Editable Bundle, Video QC, System Diagnostics & SQLite Backup/Restore.
- **Overthinker Studio UI**: Olive-green header (`#394f29`), glass-pill navigation, solid black active pills (`#141812`), and `Plus Jakarta Sans` typography.

## Installation
- **Local Edition (Windows x64)**: Extract `OIA-Overthinker-Image-AI-v1.0.0-Windows-x64.zip` and double-click `start-oia.bat`.
- **Cloud Edition (Docker)**: Extract `OIA-Overthinker-Image-AI-v1.0.0-Cloud-Docker.zip`, configure `packaging/cloud-docker/.env.cloud`, and run `docker compose -f packaging/cloud-docker/docker-compose.yml up -d --build`.

## System Requirements
- Node.js `>= 18.17.0` (Node 20 LTS recommended), npm `>= 9.x`
- Optional: `ffmpeg` in `PATH` for MP4/WebM video rendering; Ollama / LM Studio / ComfyUI for local AI inference.

## Known Limitations
- `v1.0.0` uses SQLite (`provider = "sqlite"`) in Prisma; PostgreSQL DDL is not included in `v1.0.0`.
- Live social publishing, web search research, and domain checks require external credentials and otherwise report `NOT_CONNECTED` or `EXTERNAL_PROVIDER_NOT_CONFIGURED`.
- Standard MP4 (`yuv420p`) does not support alpha transparency; use `WEBM` for alpha-capable renders.

## Upgrade Instructions
- Back up `apps/api/prisma/dev.db` and `storage/` before upgrading, then run `npm ci`, `npm run db:generate`, and `cd apps/api && npx prisma migrate deploy`.

## Security Notes
- Verify release archive integrity against `SHA256SUMS.txt`.
- Never commit `.env`, `*.db`, or `storage/` files. Change `MARKETING_TOKEN_SECRET` and `SESSION_SECRET` before deploying Cloud Edition.
