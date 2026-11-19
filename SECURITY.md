<p align="center">
  <img src="docs/assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="440" />
</p>

<p align="center"><strong>🛡️ Security Policy</strong> — Security architecture &amp; vulnerability reporting</p>

---

# Security Policy — OIA – Overthinker Image AI

## Supported Versions

| Version | Supported |
| --- | --- |
| `v1.0.x` | Yes |
| `< 1.0.0` | No |

## Security Architecture Summary
- **Local Edition (`APP_EDITION=LOCAL`)**: Binds to `localhost` by default, stores data in local SQLite (`apps/api/prisma/dev.db`) and local filesystem (`storage/`), and keeps AI execution local-first unless cloud providers are explicitly configured.
- **Cloud Edition (`APP_EDITION=SAAS`)**: Enforces Bearer/cookie session authentication (`scrypt` password hashing, timing-safe comparison, account lockout after failed attempts, optional TOTP 2FA) and strict workspace-level tenant isolation (`assertProjectTenantAccess`) + RBAC (`OWNER`, `ADMIN`, `DESIGNER`, `REVIEWER`, `CLIENT`).
- **Credential Protection**: External platform OAuth tokens (Phase 11) are encrypted at rest using AES-256-GCM (`MARKETING_TOKEN_SECRET`) and are never returned in API responses.
- **Landing Page Sanitization**: Generated HTML landing pages strip `<script>`, `<iframe>`, `on*=` event handlers, and `javascript:` URIs.
- **Original Asset Immutability**: Uploaded original logos are hashed (SHA-256) and never overwritten by downstream design, mockup, image editing, or video animation workflows.

## Reporting a Vulnerability
Please **do not** open a public GitHub issue for security vulnerabilities. Report vulnerabilities privately to the repository owner with:
1. Steps to reproduce and affected endpoint or module.
2. Impact assessment (e.g., tenant isolation bypass, credential exposure, XSS).
3. Suggested remediation if available.

## Production Deployment Checklist
- Set `APP_EDITION=SAAS` and `NODE_ENV=production` for multi-user deployments.
- Replace default `MARKETING_TOKEN_SECRET` and `SESSION_SECRET` with cryptographically random 32+ byte secrets.
- Serve behind a TLS/HTTPS reverse proxy (Nginx, Caddy, or Cloudflare) and restrict `CORS_ORIGIN` to your exact frontend origin.
- Never expose SQLite database files or `storage/` directories directly via a static web server.
