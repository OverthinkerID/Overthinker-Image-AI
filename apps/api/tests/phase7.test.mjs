import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

async function createInProcessCaller() {
  const { createApp } = await import('../dist/app.js');
  const app = createApp();
  return async function apiCall(_baseUrl, route, opts = {}) {
    const req = new PassThrough();
    req.method = opts.method || 'GET';
    req.url = `/api/v1${route}`;
    req.originalUrl = req.url;
    req.headers = {
      'content-type': 'application/json',
      ...(opts.body ? { 'content-length': String(Buffer.byteLength(opts.body)) } : {}),
      ...Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v])),
    };
    req.socket = { remoteAddress: 'localhost' };
    req.connection = req.socket;
    req.complete = true;

    const bodyPromise = new Promise((resolve, reject) => {
      const headers = {};
      const chunks = [];
      const res = {
        statusCode: 200,
        locals: {},
        headersSent: false,
        setHeader(k, v) { headers[k.toLowerCase()] = v; },
        getHeader(k) { return headers[k.toLowerCase()]; },
        hasHeader(k) { return k.toLowerCase() in headers; },
        removeHeader(k) { delete headers[k.toLowerCase()]; },
        getHeaders() { return headers; },
        header(k, v) { this.setHeader(k, v); return this; },
        set(k, v) { if (typeof k === 'string') this.setHeader(k, v); return this; },
        type(t) { this.setHeader('content-type', t); return this; },
        status(code) { this.statusCode = code; return this; },
        cookie() { return this; },
        clearCookie() { return this; },
        write(chunk) { if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))); return true; },
        end(chunk) {
          this.headersSent = true;
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          const txt = Buffer.concat(chunks).toString('utf8');
          const parsed = txt ? (() => { try { return JSON.parse(txt); } catch { return {}; } })() : {};
          resolve({ status: this.statusCode, body: parsed });
        },
        json(obj) { this.headersSent = true; resolve({ status: this.statusCode, body: obj }); return this; },
        send(val) {
          this.headersSent = true;
          const parsed = typeof val === 'string' ? (() => { try { return JSON.parse(val); } catch { return val; } })() : val;
          resolve({ status: this.statusCode, body: parsed });
          return this;
        },
        on() { return this; },
        once() { return this; },
        emit() { return false; },
      };
      app(req, res, (err) => {
        if (err) reject(err);
      });
    });

    if (opts.body) req.push(opts.body);
    req.push(null);
    return bodyPromise;
  };
}

test('Phase 7: Auth, Multi-Workspace Isolation, RBAC, Client Portal, Collaboration, Billing Webhook & Storage Isolation', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'overthinker-phase7-'));
  const dbPath = path.join(tmpDir, 'phase7.db');
  const storageDir = path.join(tmpDir, 'storage');
  await fs.mkdir(storageDir, { recursive: true });

  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.STORAGE_ROOT = storageDir;
  process.env.APP_EDITION = 'SAAS';
  process.env.PAYMENT_PROVIDER = 'STRIPE_COMPAT';
  process.env.PAYMENT_PROVIDER_KEY = 'provider_key_value';
  process.env.PAYMENT_WEBHOOK_SECRET = 'webhook_hmac_value';

  const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const migrationFiles = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((d) => path.join(migrationsDir, d, 'migration.sql'));

  const pyMigrate = `
import sqlite3, sys
conn = sqlite3.connect(sys.argv[1])
conn.execute("PRAGMA foreign_keys = ON;")
for p in sys.argv[2:]:
    with open(p, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
conn.commit()
`;
  execFileSync('python3', ['-c', pyMigrate, dbPath, ...migrationFiles]);

  const { prisma } = await import('../dist/db/client.js');
  const { LocalFilesystemStorageProvider } = await import('../dist/services/storage.provider.js');
  const { generateTotpCode } = await import('../dist/modules/auth/auth.service.js');
  const apiCall = await createInProcessCaller();
  const baseUrl = '';

  try {
    // 1. Unauthenticated request in SAAS mode is blocked (401)
    const unauthRes = await apiCall(baseUrl, '/projects');
    assert.equal(unauthRes.status, 401);

    // 2. Register Tenant A (Owner) & Tenant B (Owner)
    const regA = await apiCall(baseUrl, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'ownerA@agency.test', password: 'Password123!', name: 'Owner A', workspaceName: 'Agency Alpha' }),
    });
    assert.equal(regA.status, 201);
    const tokenA = regA.body.data.sessionToken;
    const wsA = regA.body.data.workspace.id;

    const regB = await apiCall(baseUrl, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'ownerB@agency.test', password: 'Password123!', name: 'Owner B', workspaceName: 'Agency Beta' }),
    });
    assert.equal(regB.status, 201);
    const tokenB = regB.body.data.sessionToken;
    const wsB = regB.body.data.workspace.id;

    // 3. Password reset & 2FA TOTP & session management
    const resetReq = await apiCall(baseUrl, '/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email: 'ownerB@agency.test' }),
    });
    assert.equal(resetReq.status, 200);
    const resetConfirm = await apiCall(baseUrl, '/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: resetReq.body.data.resetToken, newPassword: 'NewPassword456!' }),
    });
    assert.equal(resetConfirm.status, 200);

    // Old tokenB must now be revoked after password reset
    const revokedCheck = await apiCall(baseUrl, '/projects', { headers: { Authorization: `Bearer ${tokenB}` } });
    assert.equal(revokedCheck.status, 401);

    // Re-login Tenant B with new password + enable 2FA
    const loginB = await apiCall(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ownerB@agency.test', password: 'NewPassword456!' }),
    });
    assert.equal(loginB.status, 200);
    const activeTokenB = loginB.body.data.sessionToken;

    const twoFa = await apiCall(baseUrl, '/auth/2fa/enable', {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeTokenB}` },
    });
    assert.equal(twoFa.status, 200);
    const totpCode = generateTotpCode(twoFa.body.data.secretHex);
    const loginB2fa = await apiCall(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ownerB@agency.test', password: 'NewPassword456!', totpCode }),
    });
    assert.equal(loginB2fa.status, 200);

    // 4. Tenant A creates a Project & Client
    const projA = await apiCall(baseUrl, '/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Alpha Brand Project', industry: 'Fintech' }),
    });
    assert.equal(projA.status, 201);
    const projAId = projA.body.data.id;

    // 5. CROSS-TENANT SECURITY TESTS: Tenant B cannot access Tenant A's workspace or project
    const crossWs = await apiCall(baseUrl, '/projects', {
      headers: { Authorization: `Bearer ${activeTokenB}`, 'x-workspace-id': wsA },
    });
    assert.equal(crossWs.status, 403);

    const crossProj = await apiCall(baseUrl, `/projects/${projAId}`, {
      headers: { Authorization: `Bearer ${activeTokenB}` },
    });
    assert.equal(crossProj.status, 404);

    const crossSubRoute = await apiCall(baseUrl, `/projects/${projAId}/concepts`, {
      headers: { Authorization: `Bearer ${activeTokenB}` },
    });
    assert.equal(crossSubRoute.status, 404);

    // 6. Storage Isolation & Signed Download URL Verification
    const storageProvider = new LocalFilesystemStorageProvider(storageDir, 'test-secret');
    const stored = await storageProvider.putObject({
      workspaceId: wsA,
      projectId: projAId,
      key: 'briefs/alpha.txt',
      buffer: Buffer.from('Confidential Alpha Brief'),
      mimeType: 'text/plain',
    });
    await assert.rejects(() => storageProvider.getObject(wsB, stored.storageKey), /Cross-tenant storage access denied/);
    const dlToken = storageProvider.createSignedDownloadToken(wsA, stored.storageKey, 60);
    const verified = storageProvider.verifySignedDownloadToken(dlToken);
    assert.equal(verified?.workspaceId, wsA);
    assert.equal(verified?.storageKey, stored.storageKey);

    // 7. Member Invitation, RBAC & Client Portal Restrictions
    const regReviewer = await apiCall(baseUrl, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'reviewer@agency.test', password: 'Password123!', name: 'Reviewer User' }),
    });
    const reviewerToken = regReviewer.body.data.sessionToken;

    const inv = await apiCall(baseUrl, '/workspaces/current/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ email: 'reviewer@agency.test', role: 'REVIEWER' }),
    });
    assert.equal(inv.status, 201);

    const accept = await apiCall(baseUrl, '/workspaces/invitations/accept', {
      method: 'POST',
      headers: { Authorization: `Bearer ${reviewerToken}` },
      body: JSON.stringify({ token: inv.body.data.inviteToken }),
    });
    assert.equal(accept.status, 200);

    // REVIEWER cannot create a project in Workspace A (RBAC 403)
    const reviewerCreateProj = await apiCall(baseUrl, '/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${reviewerToken}`, 'x-workspace-id': wsA },
      body: JSON.stringify({ name: 'Forbidden Project' }),
    });
    assert.equal(reviewerCreateProj.status, 403);

    // Client Management + Client Portal Isolation
    const clientRes = await apiCall(baseUrl, '/clients', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Acme Corp', internalNotes: 'SECRET AGENCY MARGIN 40%' }),
    });
    assert.equal(clientRes.status, 201);
    const clientId = clientRes.body.data.id;

    // Register a client user and grant portal access
    const regClient = await apiCall(baseUrl, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'client@acme.test', password: 'Password123!', name: 'Acme Client' }),
    });
    const clientToken = regClient.body.data.sessionToken;
    const clientUserId = regClient.body.data.user.id;

    const grant = await apiCall(baseUrl, '/portal/access', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ clientId, projectId: projAId, userId: clientUserId, allowApprovals: true }),
    });
    assert.equal(grant.status, 201);

    // Agency posts an internal comment and a public comment
    await apiCall(baseUrl, `/collaboration/projects/${projAId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ content: 'Internal agency note: do not show client', isInternal: true }),
    });
    await apiCall(baseUrl, `/collaboration/projects/${projAId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ content: 'Ready for your review!', isInternal: false, mentions: [clientUserId] }),
    });

    // Client views portal: sees public comment, NEVER sees internal comment
    const portalView = await apiCall(baseUrl, `/portal/projects/${projAId}`, {
      headers: { Authorization: `Bearer ${clientToken}`, 'x-workspace-id': wsA },
    });
    assert.equal(portalView.status, 200);
    assert.equal(portalView.body.data.comments.length, 1);
    assert.equal(portalView.body.data.comments[0].content, 'Ready for your review!');

    // Client cannot access internal agency clients list
    const clientListAttempt = await apiCall(baseUrl, '/clients', {
      headers: { Authorization: `Bearer ${clientToken}`, 'x-workspace-id': wsA },
    });
    assert.equal(clientListAttempt.status, 403);

    // 8. Subscription Plans, Entitlements, Usage & Payment Webhook Verification
    await prisma.subscriptionPlan.create({
      data: {
        code: 'PRO',
        name: 'Pro Studio',
        monthlyPriceCents: 2900,
        annualPriceCents: 29000,
        workspaceLimit: 3,
        projectLimit: 1,
        memberLimit: 5,
        aiImageQuota: 100,
        aiTextQuota: 500,
        storageQuotaMb: 2048,
        exportLimit: 50,
      },
    });
    const subAssign = await apiCall(baseUrl, '/billing/subscription', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ planCode: 'PRO', startTrialDays: 14 }),
    });
    assert.equal(subAssign.status, 200);

    // Project limit is 1 and wsA already has 1 project -> entitlement must return allowed: false
    const ent = await apiCall(baseUrl, '/billing/entitlements/PROJECTS', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(ent.status, 200);
    assert.equal(ent.body.data.allowed, false);

    // Payment webhook signature verification + idempotency
    const webhookPayload = { id: 'evt_test_001', type: 'payment.succeeded', workspaceId: wsA, amountCents: 2900 };
    const rawWebhook = JSON.stringify(webhookPayload);
    const badSigRes = await apiCall(baseUrl, '/billing/webhooks', {
      method: 'POST',
      headers: { 'x-payment-signature': 'invalid_sig' },
      body: rawWebhook,
    });
    assert.equal(badSigRes.status, 401);

    const validSig = crypto.createHmac('sha256', 'webhook_hmac_value').update(rawWebhook).digest('hex');
    const goodWebhook1 = await apiCall(baseUrl, '/billing/webhooks', {
      method: 'POST',
      headers: { 'x-payment-signature': validSig },
      body: rawWebhook,
    });
    assert.equal(goodWebhook1.status, 200);
    assert.equal(goodWebhook1.body.data.duplicate, false);

    const goodWebhook2 = await apiCall(baseUrl, '/billing/webhooks', {
      method: 'POST',
      headers: { 'x-payment-signature': validSig },
      body: rawWebhook,
    });
    assert.equal(goodWebhook2.status, 200);
    assert.equal(goodWebhook2.body.data.duplicate, true);

    // 9. Local Edition Regression Check
    process.env.APP_EDITION = 'LOCAL';
    const localProjects = await apiCall(baseUrl, '/projects');
    assert.equal(localProjects.status, 200);
  } finally {
    await prisma.$disconnect();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
