# BrandForge AI v1.0.0 — Production Release & Operations Guide

## 1. Release Changelog (Phases 1–12 Complete)
- **Phases 1–6**: Original Logo Vault (SHA-256 immutable), Brand DNA Analyzer, 4 Brand Concepts, Design Engine (Fabric.js + SVG/PNG/PDF), Smart Mockup Studio & Brand Guidelines/Presentations, Automation Engine & 14-Folder Commercial Export.
- **Phase 7**: Multi-Workspace SaaS & Local Edition (`LOCAL` vs `SAAS`), RBAC, Client Management & Portal, Comments/Notifications, Subscription Quotas, Storage Abstraction (`LocalFilesystemStorageProvider` & `S3CompatibleStorageProvider`).
- **Phase 8**: AI Creative Director, Logo Intelligence, Design Critic, Consistency Audit, Creative Briefs & PDF Reports.
- **Phase 9**: Non-Destructive AI Image Editor, Masking, Protected Regions, Deterministic Logo Compositing, Upscale & Workflows.
- **Phase 10**: Market Research, Source Provenance, Competitor Comparison, Audience/Personas, Brand Positioning, Naming/Taglines & 22-Section Strategy Reports (PDF/DOCX/JSON).
- **Phase 11**: AI Marketing & Brand Growth Studio — 3-Mode Strategist, 6-Platform Social Studio, Copywriting Variants, Content Calendar, Ad Studio + Budget Estimator, 14-Stage Campaigns + ZIP Export, Sanitized Landing Pages, AES-256-GCM Platform Integrations, 7-Step Publishing Preflight, Analytics CSV & AI Analyst.
- **Phase 12**: AI Brand Video & Motion Studio + Production Hardening — 12 Video Templates, Storyboard & Script Studio, Deterministic Logo Animation, Voice Profiles (consent-gated) & SRT Subtitles, 5-Track Timeline Editor, FFmpeg/Fallback MP4 & WebM Render + Editable Bundle, Video QC, System Diagnostics & SQLite Backup/Restore.

## 2. Local & Cloud Deployment Quickstart
- **Local Edition (`APP_EDITION=LOCAL`)**: Uses SQLite (`DATABASE_URL="file:./prisma/dev.db"`), local filesystem storage (`STORAGE_ROOT`), and automatic local owner workspace fallback.
- **Cloud / SaaS Edition (`APP_EDITION=SAAS`)**: Enforces strict Bearer/cookie session authentication, workspace tenant isolation, RBAC permissions, and optional S3-compatible object storage.

## 3. Database Backup & Restore
- **Create Backup**: `POST /api/v1/diagnostics/backup` writes a timestamped SQLite snapshot to `${STORAGE_ROOT}/_backups/brandforge-backup-<timestamp>.db`.
- **Restore Backup**: `POST /api/v1/diagnostics/restore` with `{ "backupPath": "..." }` restores a verified snapshot from `_backups/`.
- **System Diagnostics**: `GET /api/v1/diagnostics/system` reports DB health, storage writability, memory/CPU, FFmpeg availability, video provider status, and active job queues.
