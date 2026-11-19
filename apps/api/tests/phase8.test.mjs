import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createTinyPng(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = y * rowSize + 1 + x * 4;
      raw[px] = 200; raw[px + 1] = 205; raw[px + 2] = 215; raw[px + 3] = 255;
    }
  }
  const chunk = (t, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0);
    const tb = Buffer.from(t, 'ascii');
    const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, d])), 0);
    return Buffer.concat([l, tb, d, cb]);
  };
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

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

test('Phase 8: AI Creative Director, Logo Intelligence, Design Critic, Consistency, Recommendations, Briefs, Comparison, PDF & Security', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'overthinker-phase8-'));
  const dbPath = path.join(tmpDir, 'phase8.db');
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
  const { LocalStorageService } = await import('../dist/services/storage.service.js');
  const { computeOverallAdvisoryScore } = await import('../dist/modules/creative-director/scoring.engine.js');
  const { DirectorAiAdapter } = await import('../dist/modules/creative-director/directorAi.adapter.js');
  const apiCall = await createInProcessCaller();

  try {
    // 1. Register Tenant A & Tenant B
    const regA = await apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'cdA@brand.test', password: 'Password123!', name: 'Director A', workspaceName: 'Studio A' }) });
    const tokenA = regA.body.data.sessionToken;
    const wsA = regA.body.data.workspace.id;

    const regB = await apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'cdB@brand.test', password: 'Password123!', name: 'Director B', workspaceName: 'Studio B' }) });
    const tokenB = regB.body.data.sessionToken;

    const projRes = await apiCall('/projects', { method: 'POST', headers: { Authorization: `Bearer ${tokenA}` }, body: JSON.stringify({ name: 'Lumina Brand', industry: 'Clean Energy' }) });
    const projectId = projRes.body.data.id;

    // 2. Upload a tiny low-res PNG (64x64) -> human-reviewed expected finding: low scalability score (< 50)
    const storage = new LocalStorageService(storageDir);
    const tinyPng = createTinyPng(64, 64);
    const savedTiny = await storage.saveOriginalLogo({ projectId, logoId: 'logo_tiny', buffer: tinyPng, mimeType: 'image/png', originalFilename: 'tiny.png' });
    await prisma.logoAsset.create({
      data: { id: 'logo_tiny', projectId, originalFilename: 'tiny.png', storedFilename: savedTiny.storedFilename, storagePath: savedTiny.storagePath, mimeType: 'image/png', fileSize: savedTiny.fileSize, sha256: savedTiny.sha256, width: 64, height: 64, isOriginal: true, isPrimary: true },
    });

    const evalLow = await apiCall(`/projects/${projectId}/creative-director/logo-intelligence`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ logoId: 'logo_tiny' }),
    });
    assert.equal(evalLow.status, 201);
    const lowScaleCat = evalLow.body.data.assessment.categories.find((c) => c.categoryKey === 'scalability');
    assert.ok(lowScaleCat.score < 50, `Expected tiny 64x64 PNG scalability < 50, got ${lowScaleCat.score}`);
    assert.equal(lowScaleCat.severity, 'CRITICAL');
    assert.equal(lowScaleCat.judgmentType, 'DETERMINISTIC');
    assert.match(evalLow.body.data.assessment.disclaimer, /do not predict commercial success|guarantee trademark/i);

    // 3. Scoring engine returns null overallScore when insufficient evidence exists
    assert.equal(computeOverallAdvisoryScore([], []), null);

    // 4. Design Critic detects low contrast in DesignDocument without fabricating coordinates
    const lowContrastDoc = await prisma.designDocument.create({
      data: {
        projectId,
        title: 'Low Contrast Card',
        category: 'BUSINESS_CARD',
        width: 1050,
        height: 600,
        canvasJson: JSON.stringify({ background: '#FFFFFF', objects: [{ type: 'textbox', left: 40, top: 40, fill: '#CBD5E1', text: 'Faint Text' }] }),
      },
    });
    const criticRes = await apiCall(`/projects/${projectId}/creative-director/design-critic`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ targetType: 'DESIGN_DOCUMENT', targetId: lowContrastDoc.id }),
    });
    assert.equal(criticRes.status, 201);
    const findings = JSON.parse(criticRes.body.data.regionFindingsJson);
    assert.ok(findings.some((f) => f.issue.includes('Low contrast')));

    // 5. Creative Director Conversation distinguishes unapproved suggestion vs approved decision
    const chatRes = await apiCall(`/projects/${projectId}/creative-director/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ message: 'Should we lock this brand direction?' }),
    });
    assert.equal(chatRes.status, 201);
    assert.match(chatRes.body.data.reply.content, /Unapproved/i);

    // 6. Brand Consistency Intelligence identifies missing approved Brand DNA
    const consRes = await apiCall(`/projects/${projectId}/creative-director/consistency`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(consRes.status, 201);
    assert.ok(consRes.body.data.consistencyScore < 100);

    // 7. Recommendations + Approval Controls
    const recRes = await apiCall(`/projects/${projectId}/creative-director/recommendations/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ direction: 'Modern Minimalist' }),
    });
    assert.equal(recRes.status, 201);
    const recId = recRes.body.data[0].id;
    const acceptRec = await apiCall(`/projects/${projectId}/creative-director/recommendations/${recId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ status: 'ACCEPTED' }),
    });
    assert.equal(acceptRec.status, 200);
    assert.equal(acceptRec.body.data.status, 'ACCEPTED');

    // 8. Creative Brief & Brand Comparison (no auto-winner without criteria)
    const briefRes = await apiCall(`/projects/${projectId}/creative-director/briefs/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ direction: 'Premium Luxury' }),
    });
    assert.equal(briefRes.status, 201);
    assert.equal(briefRes.body.data.version, 1);

    const cmpRes = await apiCall(`/projects/${projectId}/creative-director/comparisons`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ comparisonType: 'DESIGNS' }),
    });
    assert.equal(cmpRes.status, 201);
    assert.match(cmpRes.body.data.aiRecommendation, /No automatic winner selected/i);

    // 9. Cloud AI privacy & vision capability gating + Local provider failure fallback
    const adapter = new DirectorAiAdapter();
    assert.equal(adapter.supportsVision('local-ollama', 'llama3.1:8b'), false);
    assert.equal(adapter.supportsVision('local-ollama', 'llava:latest'), true);

    await assert.rejects(
      () => adapter.reasonText({ workspaceId: wsA, projectId, provider: 'cloud-openai', systemPrompt: 's', prompt: 'p', allowCloudUpload: false, fallbackText: () => 'fb' }),
      /Explicit cloud upload permission/
    );

    const fallbackChat = await apiCall(`/projects/${projectId}/creative-director/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ message: 'Fallback test', provider: 'local-ollama' }),
    });
    assert.equal(fallbackChat.status, 201);

    // 10. 12-Section Intelligence Report + PDF Export
    const repRes = await apiCall(`/projects/${projectId}/creative-director/reports/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(repRes.status, 201);
    const sections = JSON.parse(repRes.body.data.sectionsJson);
    assert.equal(sections.length, 12);

    const pdfRes = await apiCall(`/projects/${projectId}/creative-director/reports/${repRes.body.data.id}/export/pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(pdfRes.status, 200);
    assert.ok(pdfRes.rawBuffer.subarray(0, 4).toString('ascii') === '%PDF');

    // 11. Workspace Isolation: Tenant B cannot access Tenant A's Creative Director endpoints
    const crossTenant = await apiCall(`/projects/${projectId}/creative-director/context`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(crossTenant.status, 404);

    // 12. Original Logo SHA-256 unchanged
    const diskBuf = await storage.readLogo(savedTiny.storagePath);
    assert.equal(crypto.createHash('sha256').update(diskBuf).digest('hex'), savedTiny.sha256);
  } finally {
    await prisma.$disconnect();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
