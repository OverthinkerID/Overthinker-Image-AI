import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { LocalStorageService } from '../dist/services/storage.service.js';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

test('LocalStorageService preserves original logo immutably and rejects path traversal', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'overthinker-storage-'));
  try {
    const storage = new LocalStorageService(tmpRoot);
    const saved = await storage.saveOriginalLogo({
      projectId: 'proj_alpha',
      logoId: 'logo_01',
      buffer: ONE_PIXEL_PNG,
      mimeType: 'image/png',
      originalFilename: 'brand-mark.png',
    });

    const expectedSha = crypto.createHash('sha256').update(ONE_PIXEL_PNG).digest('hex');
    assert.equal(saved.sha256, expectedSha);
    assert.equal(saved.fileSize, ONE_PIXEL_PNG.length);
    assert.match(saved.storagePath, /^projects\/proj_alpha\/logos\/originals\/logo_01-/);

    const readBack = await storage.readLogo(saved.storagePath);
    assert.equal(Buffer.compare(readBack, ONE_PIXEL_PNG), 0);

    await assert.rejects(
      () => storage.deleteRelativeFile(saved.storagePath),
      /Refusing to delete immutable original logo file/
    );

    assert.throws(
      () => storage.resolveSafePath('../../etc/passwd'),
      /directory traversal detected/
    );
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});
