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

test('Phase 12: AI Brand Video & Motion Studio, 12 Templates, Deterministic Logo Animation, Consent-Gated Voice/SRT, 5-Track Timeline, MP4/WebM Render, Video QC, Diagnostics, Backup/Restore & Isolation', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'overthinker-phase12-'));
  const dbPath = path.join(tmpDir, 'phase12.db');
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
    const regA = await apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'vidA@brand.test', password: 'Password123!', name: 'Video A', workspaceName: 'Studio A' }) });
    const tokenA = regA.body.data.sessionToken;

    const regB = await apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'vidB@brand.test', password: 'Password123!', name: 'Video B', workspaceName: 'Studio B' }) });
    const tokenB = regB.body.data.sessionToken;

    const projRes = await apiCall('/projects', { method: 'POST', headers: { Authorization: `Bearer ${tokenA}` }, body: JSON.stringify({ name: 'Kopi Senja Motion', industry: 'Specialty Coffee' }) });
    const projectId = projRes.body.data.id;

    // 2. Overview: 12 Templates & Provider Discovery
    const ovRes = await apiCall(`/projects/${projectId}/video/overview`, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(ovRes.status, 200);
    assert.equal(ovRes.body.templates.length, 12);
    assert.ok(ovRes.body.providers.length >= 4);

    // 3. Create Video Project + 5-Track Timeline
    const vpRes = await apiCall(`/projects/${projectId}/video/projects`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ title: 'Senja Launch Reel', templateKey: 'SOCIAL_REEL', aspectRatio: '9:16', durationSec: 15 })
    });
    assert.equal(vpRes.status, 201);
    const vpId = vpRes.body.videoProject.id;
    const timelineId = vpRes.body.timeline.id;
    assert.equal(vpRes.body.timeline.tracks.length, 5);

    // 4. Storyboard & Indonesian Script
    const sbRes = await apiCall(`/projects/${projectId}/video/projects/${vpId}/storyboard`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ language: 'id-ID', topic: 'Kopi dingin spesialti' })
    });
    assert.equal(sbRes.status, 201);
    assert.equal(sbRes.body.storyboard.scenes.length, 3);

    // 5. Video Job Queue + Cancel + Retry
    const jobRes = await apiCall(`/projects/${projectId}/video/jobs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ videoProjectId: vpId, jobType: 'IMAGE_TO_VIDEO', prompt: 'Smooth coffee pour slow motion' })
    });
    assert.equal(jobRes.status, 201);
    const cancelRes = await apiCall(`/projects/${projectId}/video/jobs/${jobRes.body.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(cancelRes.body.status, 'CANCELLED');
    const retryRes = await apiCall(`/projects/${projectId}/video/jobs/${jobRes.body.id}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(retryRes.body.status, 'QUEUED');

    // 6. Deterministic Logo Animation (Preserves geometry, typography, colors, transparency)
    const logoAnimRes = await apiCall(`/projects/${projectId}/video/logo-animation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ videoProjectId: vpId, animationStyle: 'FADE_AND_SCALE', durationSec: 5 })
    });
    assert.equal(logoAnimRes.status, 201);
    assert.equal(logoAnimRes.body.asset.preservesLogo, true);
    assert.equal(logoAnimRes.body.descriptor.preservesOriginalGeometry, true);

    // 7. Voice Profile Consent Gate + Audio/SRT Generation
    const voiceBlocked = await apiCall(`/projects/${projectId}/video/voice-audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ profileName: 'Narrator ID', language: 'id-ID', consentGranted: false })
    });
    assert.equal(voiceBlocked.status, 500);

    const voiceOk = await apiCall(`/projects/${projectId}/video/voice-audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ profileName: 'Narrator ID', language: 'id-ID', consentGranted: true, text: 'Nikmati Kopi Senja', timelineId })
    });
    assert.equal(voiceOk.status, 201);
    assert.equal(voiceOk.body.subtitle.format, 'SRT');

    // 8. Render MP4 (supportsAlpha MUST be false) & WebM (supportsAlpha true) + Editable Bundle
    const mp4Res = await apiCall(`/projects/${projectId}/video/projects/${vpId}/render`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ format: 'MP4', aspectRatio: '9:16' })
    });
    assert.equal(mp4Res.status, 201);
    assert.equal(mp4Res.body.status, 'COMPLETED');
    assert.equal(mp4Res.body.supportsAlpha, false);
    assert.ok(mp4Res.body.editableBundlePath);

    const webmRes = await apiCall(`/projects/${projectId}/video/projects/${vpId}/render`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ format: 'WEBM', aspectRatio: '16:9' })
    });
    assert.equal(webmRes.status, 201);
    assert.equal(webmRes.body.supportsAlpha, true);

    // 9. Video Quality Control
    const qcRes = await apiCall(`/projects/${projectId}/video/projects/${vpId}/qc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(qcRes.status, 201);
    assert.equal(qcRes.body.passed, true);
    assert.equal(qcRes.body.overallScore, 100);

    // 10. Production Hardening: System Diagnostics + SQLite Backup & Restore
    const diagRes = await apiCall('/diagnostics/system', { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(diagRes.status, 200);
    assert.equal(diagRes.body.status, 'HEALTHY');
    assert.equal(diagRes.body.securityAudit.encryptedMarketingTokens, true);

    const bkpRes = await apiCall('/diagnostics/backup', { method: 'POST', headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(bkpRes.status, 201);
    assert.equal(bkpRes.body.status, 'BACKUP_CREATED');

    const rstRes = await apiCall('/diagnostics/restore', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ backupPath: bkpRes.body.backupPath })
    });
    assert.equal(rstRes.status, 200);
    assert.equal(rstRes.body.status, 'RESTORE_COMPLETED');

    // 11. Workspace Tenant Isolation
    const crossTenant = await apiCall(`/projects/${projectId}/video/overview`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.equal(crossTenant.status, 404);
  } finally {
    await prisma.$disconnect();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
