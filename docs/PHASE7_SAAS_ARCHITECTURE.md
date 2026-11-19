# Overthinker Image AI — Phase 7 SaaS & Multi-Tenant Architecture Guide

## 1. Architecture Overview
Overthinker Image AI supports two runtime editions from the same modular codebase:
- **Local Edition (`APP_EDITION=LOCAL`, default)**: Single-user local-first studio with automatic fallback to `usr_local_owner` and `ws_local_default` (`Local Brand Studio`). Existing pre-Phase 7 projects with `workspaceId = null` are automatically linked to `ws_local_default`.
- **Cloud / SaaS Edition (`APP_EDITION=SAAS`)**: Strict multi-tenant mode requiring authenticated `HttpOnly` cookie (`bf_session`) or `Authorization: Bearer` sessions, workspace membership verification on every route, RBAC enforcement, and configurable subscription entitlements.

## 2. Authentication & Session Security
- **Password Hashing**: Node.js `crypto.scryptSync` (`N=16384, r=8, p=1`, 16-byte random salt) verified with `crypto.timingSafeEqual`. Plain-text passwords are never stored.
- **Sessions**: SHA-256 hashed session tokens in `user_sessions` with `expiresAt`, `revokedAt`, `userAgent`, and `ipAddress` tracking. Supports device/session listing and individual revocation.
- **Brute-Force & Rate Limiting**: Sliding-window IP rate limiter on auth endpoints (`/login`, `/register`, `/password-reset/*`) and automatic 15-minute account lockout after 5 consecutive failed logins.
- **2FA**: Optional HMAC-SHA1 TOTP 6-digit verification (`POST /api/v1/auth/2fa/enable`).

## 3. RBAC Permission Matrix

| Role | `workspace:manage` | `workspace:delete` | `billing:manage` | `members:manage` | `clients:manage` | `projects:create` | `projects:edit` | `projects:view` | `assets:approve` | `portal:view` |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **OWNER** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | - |
| **ADMIN** | Yes | - | - | Yes | Yes | Yes | Yes | Yes | Yes | - |
| **DESIGNER** | - | - | - | - | - | Yes | Yes | Yes | - | - |
| **REVIEWER** | - | - | - | - | - | - | - | Yes | Yes | - |
| **CLIENT** | - | - | - | - | - | - | - | - | Yes | Yes |

## 4. Multi-Tenant Data Isolation
- Every request passes through `attachAuthContext` (`apps/api/src/middleware/tenantContext.ts`).
- Frontend-supplied `x-workspace-id` headers are **never trusted** without verifying an active `WorkspaceMember` record for `(workspaceId, userId)`.
- All project-scoped routes (`/api/v1/projects/:id/*`) pass through `guardProjectScope` → `assertProjectTenantAccess`, verifying `project.workspaceId === req.auth.workspaceId`.
- `CLIENT` users additionally require an active `ClientPortalAccess` record for the specific `projectId`, and are strictly blocked from `internalNotes`, `isInternal` comments, AI credentials, and internal workflow logs.

## 5. Storage Configuration (Local & S3-Compatible)
- **Local Filesystem (`LOCAL`, default)**: Enforces workspace-scoped path prefixes (`workspaces/<workspaceId>/...`) and HMAC-SHA256 signed temporary download tokens (`STORAGE_SIGNING_SECRET`).
- **S3-Compatible (`S3_COMPATIBLE`)**: Configure `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

## 6. Database Migration Guide (SQLite → PostgreSQL)
- **Local Edition**: Uses SQLite (`DATABASE_URL="file:./prisma/dev.db"`). Run `npx prisma migrate deploy`.
- **Cloud/SaaS Edition (PostgreSQL)**: Update `provider = "postgresql"` in `apps/api/prisma/schema.prisma`, set `DATABASE_URL="postgresql://user:pass@host:5432/overthinker"`, and run `npx prisma migrate deploy`.

## 7. Subscription & Payment Integration Guide
- Plans (`SubscriptionPlan`) are stored in the database with configurable pricing and quotas (never hardcoded).
- Paid plan upgrades require `PAYMENT_PROVIDER`, `PAYMENT_PROVIDER_KEY`, and `PAYMENT_WEBHOOK_SECRET`. Without credentials, real payment collection is blocked (`HTTP 402`).
- Webhooks (`POST /api/v1/billing/webhooks`) verify `x-payment-signature` via HMAC-SHA256 (`crypto.timingSafeEqual`) and deduplicate via `BillingEvent.externalEventId`.

## 8. Deployment & Backup / Recovery
- **Local Edition**: Run `npm install`, `cd apps/api && npx prisma generate && npx prisma migrate deploy`, then `npm run dev` from root.
- **Cloud Edition**: Set `APP_EDITION=SAAS`, `NODE_ENV=production`, `DATABASE_URL` (PostgreSQL), `STORAGE_SIGNING_SECRET`, and optional S3/Payment credentials.
- **Backup & Recovery**: Back up the SQLite database file (or PostgreSQL dump via `pg_dump`) together with the `storage/` directory (or S3 bucket) atomically.
