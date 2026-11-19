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

function createTestPng(width, height, r = 240, g = 245, b = 250) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = y * rowSize + 1 + x * 4;
      const isCenter = x > width * 0.25 && x < width * 0.75 && y > height * 0.25 && y < height * 0.75;
      raw[px] = isCenter ? 37 : r;
      raw[px + 1] = isCenter ? 99 : g;
      raw[px + 2] = isCenter ? 235 : b;
      raw[px + 3] = 255;
    }
  }
  const chunk = (t, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0);
    const tb = Buffer.from(t, 'ascii');
    const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, d])), 0);
    return Buffer.concat([l, tb, d, cb]);
  };
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
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

test('Phase 9: Non-Destructive Image Editor, Masking, Protected Regions, Logo Compositing, Upscale, Workflows & Isolation', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'overthinker-phase9-'));
  const dbPath = path.join(tmpDir, 'phase9.db');
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
  const { ImageEditorService } = await import('../dist/modules/image-editor/imageEditor.service.js');
  const { ImageEditorProviderAdapter } = await import('../dist/modules/image-editor/imageEditorProvider.adapter.js');
  const apiCall = await createInProcessCaller();

  try {
    const regA = await apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'edA@studio.test', password: 'Password123!', name: 'Editor A', workspaceName: 'Edit Studio A' }) });
    const tokenA = regA.body.data.sessionToken;
    const wsA = regA.body.data.workspace.id;
    const userAId = regA.body.data.user.id;

    const regB = await apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'edB@studio.test', password: 'Password123!', name: 'Editor B', workspaceName: 'Edit Studio B' }) });
    const tokenB = regB.body.data.sessionToken;

    const projRes = await apiCall('/projects', { method: 'POST', headers: { Authorization: `Bearer ${tokenA}` }, body: JSON.stringify({ name: 'Packaging Studio', industry: 'Consumer Goods' }) });
    const projectId = projRes.body.data.id;

    // Upload an original brand logo for deterministic compositing
    const storage = new LocalStorageService(storageDir);
    const logoPng = createTestPng(64, 64, 15, 23, 42);
    const savedLogo = await storage.saveOriginalLogo({ projectId, logoId: 'logo_brand_9', buffer: logoPng, mimeType: 'image/png', originalFilename: 'brand-mark.png' });
    await prisma.logoAsset.create({
      data: { id: 'logo_brand_9', projectId, originalFilename: 'brand-mark.png', storedFilename: savedLogo.storedFilename, storagePath: savedLogo.storagePath, mimeType: 'image/png', fileSize: savedLogo.fileSize, sha256: savedLogo.sha256, width: 64, height: 64, isOriginal: true, isPrimary: true },
    });

    // 1. Create ImageEditingProject from uploaded PNG (v1 ORIGINAL preserved)
    const editorService = new ImageEditorService();
    const sourcePng = createTestPng(200, 160);
    const ep = await editorService.createFromUpload(wsA, projectId, userAId, { buffer: sourcePng, originalname: 'product.png', mimetype: 'image/png' }, 'Product Hero');
    assert.equal(ep.currentVersion, 1);
    assert.equal(ep.originalWidth, 200);
    assert.equal(ep.originalHeight, 160);

    // 2. Non-destructive Crop & Resize (creates v2, v3)
    const cropRes = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/manual-edit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ operation: 'CROP', crop: { left: 10, top: 10, width: 160, height: 120 } }),
    });
    assert.equal(cropRes.status, 201);
    assert.equal(cropRes.body.data.version, 2);
    assert.equal(cropRes.body.data.width, 160);

    // Restore original creates v3 without deleting v1 or v2
    const restoreRes = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/manual-edit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ operation: 'RESTORE' }),
    });
    assert.equal(restoreRes.status, 201);
    assert.equal(restoreRes.body.data.version, 3);
    assert.equal(restoreRes.body.data.width, 200);

    // 3. Coordinate-aware Mask creation
    const maskRes = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/masks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Packaging Label Area',
        maskType: 'EDITABLE',
        featherPx: 4,
        inverted: false,
        geometry: { rects: [{ x: 40, y: 40, width: 80, height: 60 }], strokes: [{ brushSize: 12, points: [{ x: 50, y: 50 }, { x: 90, y: 80 }] }] },
      }),
    });
    assert.equal(maskRes.status, 201);
    const maskId = maskRes.body.data.id;

    // 4. Protected Region + Deterministic Logo Compositing
    const protRes = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/protected-regions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ regionType: 'ORIGINAL_LOGO', label: 'Brand Mark Safe Zone', protectedAssetId: 'logo_brand_9', bounds: { x: 10, y: 10, width: 48, height: 48 } }),
    });
    assert.equal(protRes.status, 201);

    const compLogoRes = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/composite-logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ logoId: 'logo_brand_9', x: 10, y: 10, width: 48, height: 48 }),
    });
    assert.equal(compLogoRes.status, 201);
    assert.equal(compLogoRes.body.data.operationType, 'LOGO_COMPOSITE');

    // 5. Background Removal & Studio Replacement
    const bgRes = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/background`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ mode: 'BG_REPLACE', preset: 'LUXURY' }),
    });
    assert.equal(bgRes.status, 201);

    // 6. Generative Fill & Cloud Consent Enforcement
    const cloudBlocked = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/generative-edit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ jobType: 'GEN_FILL', prompt: 'Add studio rim light', provider: 'cloud-openai', allowCloudUpload: false }),
    });
    assert.equal(cloudBlocked.status, 403);

    const genFillRes = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/generative-edit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ jobType: 'GEN_FILL', prompt: 'Add metallic foil highlight', negativePrompt: 'blurry', seed: 42, denoise: 0.65, maskId, provider: 'heuristic' }),
    });
    assert.equal(genFillRes.status, 201);
    assert.equal(genFillRes.body.data.status, 'COMPLETED');

    // 7. Upscaling 2x + GPU/Resource Limit Guard
    const upRes = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/enhance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ mode: 'UPSCALE', factor: 2 }),
    });
    assert.equal(upRes.status, 201);
    assert.equal(upRes.body.data.status, 'COMPLETED');

    const adapter = new ImageEditorProviderAdapter();
    await assert.rejects(() => adapter.checkGpuAndResourceLimits('comfyui', 8192, 8192), /exceeds safe limit/);

    // 8. Before/After Comparison & Export
    const cmpRes = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/comparisons`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ beforeVersion: 1, afterVersion: 7, mode: 'SLIDER' }),
    });
    assert.equal(cmpRes.status, 201);

    const expRes = await apiCall(`/projects/${projectId}/image-editor/projects/${ep.id}/export`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ format: 'WEBP' }),
    });
    assert.equal(expRes.status, 200);
    assert.ok(expRes.rawBuffer.subarray(0, 4).toString('ascii') === 'RIFF');

    // 9. Workflows & Batch Processing
    const wfList = await apiCall(`/projects/${projectId}/image-editor/workflows`, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(wfList.status, 200);
    assert.ok(wfList.body.data.length >= 8);

    const batchRes = await apiCall(`/projects/${projectId}/image-editor/workflows/${wfList.body.data[0].id}/batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ editingProjectIds: [ep.id] }),
    });
    assert.equal(batchRes.status, 200);
    assert.equal(batchRes.body.data.processedCount, 1);

    // 10. Workspace Isolation & Original Source Integrity
    const crossTenant = await apiCall(`/projects/${projectId}/image-editor/projects`, { headers: { Authorization: `Bearer ${tokenB}` } });
    assert.equal(crossTenant.status, 404);

    const origDisk = await storage.readRelativeFile(ep.originalStoragePath);
    assert.equal(crypto.createHash('sha256').update(origDisk).digest('hex'), ep.originalSha256);

    const logoDisk = await storage.readLogo(savedLogo.storagePath);
    assert.equal(crypto.createHash('sha256').update(logoDisk).digest('hex'), savedLogo.sha256);
  } finally {
    await prisma.$disconnect();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
