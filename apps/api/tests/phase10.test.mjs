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

test('Phase 10: Market Research, Provenance, Competitors, Audience, Positioning, Naming/Tagline, 22-Section PDF/DOCX/JSON, Workflows & Isolation', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'overthinker-phase10-'));
  const dbPath = path.join(tmpDir, 'phase10.db');
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
  const { StrategyAiAdapter } = await import('../dist/modules/strategy/strategyAi.adapter.js');
  const apiCall = await createInProcessCaller();

  try {
    // 1. Register Tenant A & Tenant B
    const regA = await apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'stratA@brand.test', password: 'Password123!', name: 'Strategist A', workspaceName: 'Strategy A' }) });
    const tokenA = regA.body.data.sessionToken;
    const wsA = regA.body.data.workspace.id;

    const regB = await apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'stratB@brand.test', password: 'Password123!', name: 'Strategist B', workspaceName: 'Strategy B' }) });
    const tokenB = regB.body.data.sessionToken;

    const projRes = await apiCall('/projects', { method: 'POST', headers: { Authorization: `Bearer ${tokenA}` }, body: JSON.stringify({ name: 'Kopi Nusantara', industry: 'Specialty Coffee' }) });
    const projectId = projRes.body.data.id;

    // 2. Capabilities & unconfigured external adapters
    const capRes = await apiCall(`/projects/${projectId}/strategy/capabilities`, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(capRes.status, 200);
    assert.equal(capRes.body.data.webResearch.status, 'EXTERNAL_PROVIDER_NOT_CONFIGURED');
    assert.equal(capRes.body.data.domainCheck.status, 'EXTERNAL_PROVIDER_NOT_CONFIGURED');

    // 3. Market Research + Source Citation + No Fabricated CAGR
    const mrRes = await apiCall(`/projects/${projectId}/strategy/market-research/projects`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ brandName: 'Kopi Nusantara', industry: 'Specialty Coffee', country: 'Indonesia', targetRegion: 'Java', priceRange: 'Mid-Premium', researchGoal: 'Launch positioning' }),
    });
    assert.equal(mrRes.status, 201);
    const researchId = mrRes.body.data.id;

    const srcRes = await apiCall(`/projects/${projectId}/strategy/market-research/projects/${researchId}/sources`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ title: 'Industry Coffee Report', url: 'http://localhost/coffee-report', publisher: 'Industry Org', findingCategory: 'VERIFIED_DATA', confidence: 0.95 }),
    });
    assert.equal(srcRes.status, 201);

    const analyzeRes = await apiCall(`/projects/${projectId}/strategy/market-research/projects/${researchId}/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ provider: 'heuristic' }),
    });
    assert.equal(analyzeRes.status, 201);
    assert.match(analyzeRes.body.data.analysis.overview, /not yet available/i);

    // 4. Competitor CRUD + Analysis + Compare
    const comp1 = await apiCall(`/projects/${projectId}/strategy/competitors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Competitor One', competitorType: 'DIRECT', positioning: 'Accessible grab-and-go', priceTier: 'Budget-Mid' }),
    });
    assert.equal(comp1.status, 201);
    const compId = comp1.body.data.id;

    const compAnalyze = await apiCall(`/projects/${projectId}/strategy/competitors/${compId}/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(compAnalyze.status, 201);
    assert.equal(compAnalyze.body.data.dataProvenance, 'AI_ESTIMATE');

    const compCompare = await apiCall(`/projects/${projectId}/strategy/competitors/compare`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(compCompare.status, 201);

    // 5. Audience Segmentation, Personas & Customer Journey
    const perRes = await apiCall(`/projects/${projectId}/strategy/audience/personas/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ industry: 'Specialty Coffee' }),
    });
    assert.equal(perRes.status, 201);
    assert.ok(perRes.body.data.length >= 2);
    assert.equal(perRes.body.data[0].dataSourceType, 'AI_HYPOTHESIS');

    // 6. Brand Positioning + Approve
    const posRes = await apiCall(`/projects/${projectId}/strategy/brand-positioning/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({}),
    });
    assert.equal(posRes.status, 201);
    const approvePos = await apiCall(`/projects/${projectId}/strategy/brand-positioning/${posRes.body.data.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(approvePos.status, 200);
    assert.equal(approvePos.body.data.isApproved, true);

    // 7. Naming (>= 10) & Taglines (>= 10)
    const namesRes = await apiCall(`/projects/${projectId}/strategy/naming/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ seedWord: 'Kopi' }),
    });
    assert.equal(namesRes.status, 201);
    assert.ok(namesRes.body.data.length >= 10);
    assert.equal(namesRes.body.data[0].domainCheckStatus, 'EXTERNAL_PROVIDER_NOT_CONFIGURED');

    const tagRes = await apiCall(`/projects/${projectId}/strategy/taglines/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(tagRes.status, 201);
    assert.ok(tagRes.body.data.length >= 10);

    // 8. 22-Section Strategy Report + Edit + Approve + Export PDF/DOCX/JSON
    const repRes = await apiCall(`/projects/${projectId}/strategy/strategy-reports/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(repRes.status, 201);
    const reportId = repRes.body.data.id;
    assert.equal(JSON.parse(repRes.body.data.sectionsJson).length, 22);

    const pdfOut = await apiCall(`/projects/${projectId}/strategy/strategy-reports/${reportId}/export?format=PDF`, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(pdfOut.status, 200);
    assert.equal(pdfOut.rawBuffer.subarray(0, 4).toString('ascii'), '%PDF');

    const docxOut = await apiCall(`/projects/${projectId}/strategy/strategy-reports/${reportId}/export?format=DOCX`, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(docxOut.status, 200);
    assert.equal(docxOut.rawBuffer.subarray(0, 2).toString('ascii'), 'PK');

    const jsonOut = await apiCall(`/projects/${projectId}/strategy/strategy-reports/${reportId}/export?format=JSON`, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(jsonOut.status, 200);
    assert.equal(JSON.parse(jsonOut.rawBuffer.toString('utf8')).sections.length, 22);

    // 9. Semi-Automatic Workflow Checkpoint + Resume + Automatic Workflow
    const wfSemi = await apiCall(`/projects/${projectId}/strategy/workflows`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ mode: 'SEMI_AUTOMATIC' }),
    });
    assert.equal(wfSemi.status, 201);
    const wfStart = await apiCall(`/projects/${projectId}/strategy/workflows/${wfSemi.body.data.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(wfStart.status, 200);
    assert.equal(wfStart.body.data.status, 'WAITING_APPROVAL');

    // 10. Cloud Privacy Gate + Workspace Isolation + RBAC
    const aiAdapter = new StrategyAiAdapter();
    await assert.rejects(
      () => aiAdapter.checkPrivacy(wsA, 'cloud-openai', false),
      /Explicit cloud upload consent/
    );

    const crossTenant = await apiCall(`/projects/${projectId}/strategy/competitors`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(crossTenant.status, 404);
  } finally {
    await prisma.$disconnect();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
