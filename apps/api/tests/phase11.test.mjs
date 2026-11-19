import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

async function createInProcessCaller() {
  const { createApp } = await import('../dist/app.js');
  const app = createApp();
  return async function apiCall(route, opts = {}) {
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

    const p = new Promise((resolve, reject) => {
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
          const rawBuf = Buffer.concat(chunks);
          const txt = rawBuf.toString('utf8');
          const parsed = txt ? (() => { try { return JSON.parse(txt); } catch { return rawBuf; } })() : {};
          resolve({ status: this.statusCode, body: parsed, rawBuffer: rawBuf });
        },
        json(obj) { this.headersSent = true; resolve({ status: this.statusCode, body: obj }); return this; },
        send(val) {
          this.headersSent = true;
          if (Buffer.isBuffer(val)) { resolve({ status: this.statusCode, body: val, rawBuffer: val }); return this; }
          const parsed = typeof val === 'string' ? (() => { try { return JSON.parse(val); } catch { return val; } })() : val;
          resolve({ status: this.statusCode, body: parsed });
          return this;
        },
        on() { return this; },
        once() { return this; },
        emit() { return false; },
      };
      app(req, res, (err) => { if (err) reject(err); });
    });
    if (opts.body) req.push(opts.body);
    req.push(null);
    return p;
  };
}

test('Phase 11: AI Marketing & Brand Growth Studio (Strategist, Social, Copy, Calendar, Ads, 14-Stage Campaign ZIP, Sanitized Landing Page, OAuth/Encryption, Publishing Preflight, Analytics CSV & Isolation)', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'overthinker-phase11-'));
  const dbPath = path.join(tmpDir, 'phase11.db');
  const storageDir = path.join(tmpDir, 'storage');
  await fs.mkdir(storageDir, { recursive: true });

  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.STORAGE_ROOT = storageDir;
  process.env.APP_EDITION = 'SAAS';

  const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const migrationFiles = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort().map((d) => path.join(migrationsDir, d, 'migration.sql'));
  execFileSync('python3', [
    '-c',
    'import sqlite3,sys\nc=sqlite3.connect(sys.argv[1])\nc.execute("PRAGMA foreign_keys=ON;")\nfor p in sys.argv[2:]:\n with open(p) as f: c.executescript(f.read())\nc.commit()',
    dbPath,
    ...migrationFiles,
  ]);

  const { prisma } = await import('../dist/db/client.js');
  const apiCall = await createInProcessCaller();

  try {
    // 1. Setup Tenant A & Tenant B
    const regA = await apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'mktA@brand.test', password: 'Password123!', name: 'Marketer A', workspaceName: 'Growth A' }) });
    const tokenA = regA.body.data.sessionToken;

    const regB = await apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'mktB@brand.test', password: 'Password123!', name: 'Marketer B', workspaceName: 'Growth B' }) });
    const tokenB = regB.body.data.sessionToken;

    const projRes = await apiCall('/projects', { method: 'POST', headers: { Authorization: `Bearer ${tokenA}` }, body: JSON.stringify({ name: 'Kopi Senja', industry: 'Specialty Coffee' }) });
    const projectId = projRes.body.data.id;

    // 2. Marketing Project & AI Strategist
    const mpRes = await apiCall(`/projects/${projectId}/marketing/projects`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Q4 Growth Plan', mode: 'SEMI_AUTOMATIC', timezone: 'Asia/Jakarta' })
    });
    assert.equal(mpRes.status, 201);

    const stratRes = await apiCall(`/projects/${projectId}/marketing/strategies/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ marketingProjectId: mpRes.body.id, mode: 'AUTOMATIC', budgetCents: 200000 })
    });
    assert.equal(stratRes.status, 201);
    const strategyId = stratRes.body.id;

    const approveStrat = await apiCall(`/projects/${projectId}/marketing/strategies/${strategyId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(approveStrat.status, 200);
    assert.equal(approveStrat.body.isApproved, true);

    // 3. Social Media Studio (6 platforms) & Copywriting (A/B/C variants)
    const socialRes = await apiCall(`/projects/${projectId}/marketing/social/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ topic: 'Cold Brew Launch' })
    });
    assert.equal(socialRes.status, 201);
    assert.equal(socialRes.body.contents.length, 6);
    const firstContentId = socialRes.body.contents[0].id;

    const copyRes = await apiCall(`/projects/${projectId}/marketing/copywriting/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ contentType: 'AD_COPY', platform: 'INSTAGRAM', topic: 'Weekend Promo' })
    });
    assert.equal(copyRes.status, 201);
    assert.equal(copyRes.body.variants.length, 3);

    // 4. Content Calendar
    const calRes = await apiCall(`/projects/${projectId}/marketing/calendars`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'November Content Calendar', timezone: 'Asia/Jakarta', viewMode: 'MONTHLY' })
    });
    assert.equal(calRes.status, 201);

    const schedRes = await apiCall(`/projects/${projectId}/marketing/calendars/${calRes.body.id}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ contentId: firstContentId, title: 'IG Carousel Launch', platform: 'INSTAGRAM', scheduledAt: '2026-11-25T09:00:00Z' })
    });
    assert.equal(schedRes.status, 201);

    // 5. Advertising Studio + Budget Estimator (no ROI promise)
    const adRes = await apiCall(`/projects/${projectId}/marketing/ads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ platform: 'META_ADS', name: 'Cold Brew Traffic', objective: 'TRAFFIC', dailyBudgetCents: 3000, durationDays: 10 })
    });
    assert.equal(adRes.status, 201);
    assert.match(adRes.body.budgetEstimate.disclaimer, /never|not guarantee/i);

    // 6. 14-Stage Campaign + ZIP Export
    const campRes = await apiCall(`/projects/${projectId}/marketing/campaigns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Senja Holiday Campaign', objective: 'Awareness & Conversions' })
    });
    assert.equal(campRes.status, 201);
    const campaignId = campRes.body.id;

    const advRes = await apiCall(`/projects/${projectId}/marketing/campaigns/${campaignId}/advance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ stage: 13 })
    });
    assert.equal(advRes.status, 200);
    assert.equal(advRes.body.status, 'WAITING_APPROVAL');

    const zipRes = await apiCall(`/projects/${projectId}/marketing/campaigns/${campaignId}/export`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(zipRes.status, 200);
    assert.ok(zipRes.body.fileSize > 0);

    // 7. Landing Page Studio (HTML Sanitization)
    const lpRes = await apiCall(`/projects/${projectId}/marketing/landing-pages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ customHtmlSnippet: '<div onclick="alert(1)">Promo</div><script>alert(2)</script><a href="javascript:void(0)">Link</a>' })
    });
    assert.equal(lpRes.status, 201);
    assert.equal(lpRes.body.isSanitized, true);
    assert.ok(!lpRes.body.htmlContent.includes('<script>'));
    assert.ok(!lpRes.body.htmlContent.includes('onclick='));
    assert.ok(!lpRes.body.htmlContent.includes('javascript:'));

    // 8. Platform Integration Manager (Encrypted Tokens, OAuth State, NOT_SUPPORTED, Disconnect)
    const xInit = await apiCall(`/projects/${projectId}/marketing/integrations/oauth/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ platform: 'X_TWITTER' })
    });
    assert.equal(xInit.status, 201);
    assert.equal(xInit.body.status, 'NOT_SUPPORTED');

    const igInit = await apiCall(`/projects/${projectId}/marketing/integrations/oauth/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ platform: 'INSTAGRAM', displayName: 'Kopi Senja IG' })
    });
    assert.equal(igInit.status, 201);
    const connId = igInit.body.id;

    const igComplete = await apiCall(`/projects/${projectId}/marketing/integrations/${connId}/oauth/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ oauthState: igInit.body.oauthState, accessToken: 'ig_access_token_sample_123456', accountName: '@kopisenja' })
    });
    assert.equal(igComplete.status, 200);
    assert.equal(igComplete.body.status, 'CONNECTED');
    const accountId = igComplete.body.publishingAccountId;

    // Ensure raw tokens are never returned in integrations listing
    const intList = await apiCall(`/projects/${projectId}/marketing/integrations`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(intList.status, 200);
    assert.equal(intList.body.connections[0].encryptedToken, undefined);

    // 9. Publishing Engine (Preflight blocks unapproved -> Approve -> Dispatch without claiming CONFIRMED_PUBLISHED)
    const preflightFail = await apiCall(`/projects/${projectId}/marketing/publishing/preflight`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ contentId: firstContentId, accountId, platform: 'INSTAGRAM' })
    });
    assert.equal(preflightFail.status, 200);
    assert.equal(preflightFail.body.passed, false);

    await apiCall(`/projects/${projectId}/marketing/contents/${firstContentId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const pubJobRes = await apiCall(`/projects/${projectId}/marketing/publishing/jobs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ contentId: firstContentId, accountId, platform: 'INSTAGRAM', idempotencyKey: 'idem-ig-001' })
    });
    assert.equal(pubJobRes.status, 201);
    assert.equal(pubJobRes.body.job.status, 'QUEUED');

    // Deduplication check
    const pubJobDup = await apiCall(`/projects/${projectId}/marketing/publishing/jobs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ contentId: firstContentId, accountId, platform: 'INSTAGRAM', idempotencyKey: 'idem-ig-001' })
    });
    assert.equal(pubJobDup.body.deduplicated, true);

    const dispatchRes = await apiCall(`/projects/${projectId}/marketing/publishing/jobs/${pubJobRes.body.job.id}/dispatch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({})
    });
    assert.equal(dispatchRes.status, 200);
    assert.equal(dispatchRes.body.status, 'DISPATCHED');
    assert.equal(dispatchRes.body.platformConfirmed, false);

    // Disconnect & Revoke
    const discRes = await apiCall(`/projects/${projectId}/marketing/integrations/${connId}/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(discRes.status, 200);
    assert.equal(discRes.body.status, 'REVOKED');

    // 10. Analytics Manual + CSV Import + AI Report (Actual vs Calculated vs AI)
    const csvRes = await apiCall(`/projects/${projectId}/marketing/analytics/import-csv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        csvText: 'platform,date,impressions,reach,clicks,engagements,conversions,spendCents,revenueCents\nINSTAGRAM,2026-11-18,10000,8500,250,600,15,5000,25000'
      })
    });
    assert.equal(csvRes.status, 201);
    assert.equal(csvRes.body.importedCount, 1);

    const repRes = await apiCall(`/projects/${projectId}/marketing/reports/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ periodLabel: 'Nov 2026' })
    });
    assert.equal(repRes.status, 201);
    assert.equal(repRes.body.calculatedKpis.overallCtrPct, 2.5);

    // 11. Workspace Tenant Isolation
    const crossTenant = await apiCall(`/projects/${projectId}/marketing/overview`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.equal(crossTenant.status, 404);
  } finally {
    await prisma.$disconnect();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
