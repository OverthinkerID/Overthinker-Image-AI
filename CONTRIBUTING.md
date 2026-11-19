<p align="center">
  <img src="docs/assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="440" />
</p>

<p align="center"><strong>🤝 Contributing</strong> — Development workflow &amp; verification checklist</p>

---

# Contributing to OIA – Overthinker Image AI

## Development Setup
1. Ensure Node.js `>= 18.17.0` is installed.
2. Run `npm install` at the repository root.
3. Copy `.env.example` to `apps/api/.env`.
4. Run `npm run db:generate` and `cd apps/api && npx prisma migrate deploy`.
5. Start both API and Web apps with `npm run dev`.

## Verification Before Submitting Changes
- Backend TypeScript build & full test suite:
  ```bash
  npm run build --workspace=apps/api
  npm run test --workspace=apps/api
  ```
- Frontend TypeScript check:
  ```bash
  npx --workspace=apps/web tsc --noEmit
  ```

## Guidelines
- Never commit `.env` files, `*.db` SQLite databases, `storage/` user assets, or real API keys.
- Preserve existing Phase 1–12 schemas, APIs, and immutable original logo guarantees.
- Keep AI provider integrations modular and never hardcode a single model or fabricate external metrics.
