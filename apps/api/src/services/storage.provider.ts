import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db/client';
import { LocalStorageService } from './storage.service';

export interface StoragePutInput {
  workspaceId: string;
  projectId?: string;
  ownerId?: string;
  key: string;
  buffer: Buffer;
  mimeType: string;
  isPrivate?: boolean;
}

export interface StorageProvider {
  readonly providerName: 'LOCAL' | 'S3_COMPATIBLE';
  putObject(input: StoragePutInput): Promise<{ storageKey: string; checksum: string; fileSize: number }>;
  getObject(workspaceId: string, storageKey: string): Promise<Buffer>;
  deleteObject(workspaceId: string, storageKey: string): Promise<void>;
  createSignedDownloadToken(workspaceId: string, storageKey: string, ttlSeconds?: number): string;
  verifySignedDownloadToken(token: string): { workspaceId: string; storageKey: string } | null;
}

function sanitizeWorkspaceKey(workspaceId: string, key: string): string {
  const safeWs = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!safeWs || cleanKey.includes('..')) {
    throw new Error('Invalid workspace storage key');
  }
  if (cleanKey.startsWith(`workspaces/${safeWs}/`)) return cleanKey;
  return path.posix.join('workspaces', safeWs, cleanKey);
}

export class LocalFilesystemStorageProvider implements StorageProvider {
  public readonly providerName = 'LOCAL' as const;
  private readonly local: LocalStorageService;
  private readonly signingSecret: string;

  constructor(rootDir: string, signingSecret?: string) {
    this.local = new LocalStorageService(rootDir);
    this.signingSecret = signingSecret || process.env.STORAGE_SIGNING_SECRET || 'local-dev-storage-signing-key';
  }

  async putObject(input: StoragePutInput) {
    const storageKey = sanitizeWorkspaceKey(input.workspaceId, input.key);
    const abs = this.local.resolveSafePath(storageKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, input.buffer);
    const checksum = crypto.createHash('sha256').update(input.buffer).digest('hex');

    await prisma.storageObject.upsert({
      where: { storageKey },
      update: { fileSize: input.buffer.length, checksum, mimeType: input.mimeType },
      create: {
        workspaceId: input.workspaceId,
        projectId: input.projectId || null,
        ownerId: input.ownerId || null,
        provider: 'LOCAL',
        storageKey,
        mimeType: input.mimeType,
        fileSize: input.buffer.length,
        isPrivate: input.isPrivate ?? true,
        checksum,
      },
    });

    return { storageKey, checksum, fileSize: input.buffer.length };
  }

  async getObject(workspaceId: string, storageKey: string): Promise<Buffer> {
    const expectedPrefix = `workspaces/${workspaceId.replace(/[^a-zA-Z0-9_-]/g, '')}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new Error('Cross-tenant storage access denied');
    }
    return this.local.readRelativeFile(storageKey);
  }

  async deleteObject(workspaceId: string, storageKey: string): Promise<void> {
    const expectedPrefix = `workspaces/${workspaceId.replace(/[^a-zA-Z0-9_-]/g, '')}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new Error('Cross-tenant storage deletion denied');
    }
    await this.local.deleteRelativeFile(storageKey);
    await prisma.storageObject.deleteMany({ where: { workspaceId, storageKey } });
  }

  createSignedDownloadToken(workspaceId: string, storageKey: string, ttlSeconds = 300): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = Buffer.from(JSON.stringify({ w: workspaceId, k: storageKey, e: exp })).toString('base64url');
    const sig = crypto.createHmac('sha256', this.signingSecret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  verifySignedDownloadToken(token: string): { workspaceId: string; storageKey: string } | null {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', this.signingSecret).update(payload).digest('base64url');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { w: string; k: string; e: number };
      if (!parsed.w || !parsed.k || parsed.e < Math.floor(Date.now() / 1000)) return null;
      return { workspaceId: parsed.w, storageKey: parsed.k };
    } catch {
      return null;
    }
  }
}

export class S3CompatibleStorageProvider implements StorageProvider {
  public readonly providerName = 'S3_COMPATIBLE' as const;
  private readonly endpoint: string;
  private readonly bucket: string;

  constructor(opts?: { endpoint?: string; bucket?: string }) {
    this.endpoint = (opts?.endpoint || process.env.S3_ENDPOINT || '').replace(/\/$/, '');
    this.bucket = opts?.bucket || process.env.S3_BUCKET || '';
  }

  isConfigured(): boolean {
    return Boolean(this.endpoint && this.bucket && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
  }

  async putObject(input: StoragePutInput) {
    if (!this.isConfigured()) {
      throw new Error('S3-compatible storage is not configured; set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.');
    }
    const storageKey = sanitizeWorkspaceKey(input.workspaceId, input.key);
    const checksum = crypto.createHash('sha256').update(input.buffer).digest('hex');
    const url = `${this.endpoint}/${this.bucket}/${storageKey}`;
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': input.mimeType }, body: new Uint8Array(input.buffer) });
    if (!res.ok) throw new Error(`S3 PUT failed: HTTP ${res.status}`);
    await prisma.storageObject.upsert({
      where: { storageKey },
      update: { fileSize: input.buffer.length, checksum, mimeType: input.mimeType },
      create: {
        workspaceId: input.workspaceId,
        projectId: input.projectId || null,
        ownerId: input.ownerId || null,
        provider: 'S3_COMPATIBLE',
        storageKey,
        mimeType: input.mimeType,
        fileSize: input.buffer.length,
        isPrivate: input.isPrivate ?? true,
        checksum,
      },
    });
    return { storageKey, checksum, fileSize: input.buffer.length };
  }

  async getObject(workspaceId: string, storageKey: string): Promise<Buffer> {
    if (!this.isConfigured()) throw new Error('S3-compatible storage is not configured.');
    const expectedPrefix = `workspaces/${workspaceId.replace(/[^a-zA-Z0-9_-]/g, '')}/`;
    if (!storageKey.startsWith(expectedPrefix)) throw new Error('Cross-tenant S3 storage access denied');
    const res = await fetch(`${this.endpoint}/${this.bucket}/${storageKey}`);
    if (!res.ok) throw new Error(`S3 GET failed: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async deleteObject(workspaceId: string, storageKey: string): Promise<void> {
    if (!this.isConfigured()) throw new Error('S3-compatible storage is not configured.');
    const expectedPrefix = `workspaces/${workspaceId.replace(/[^a-zA-Z0-9_-]/g, '')}/`;
    if (!storageKey.startsWith(expectedPrefix)) throw new Error('Cross-tenant S3 deletion denied');
    await fetch(`${this.endpoint}/${this.bucket}/${storageKey}`, { method: 'DELETE' });
    await prisma.storageObject.deleteMany({ where: { workspaceId, storageKey } });
  }

  createSignedDownloadToken(workspaceId: string, storageKey: string, ttlSeconds = 300): string {
    return new LocalFilesystemStorageProvider('./storage').createSignedDownloadToken(workspaceId, storageKey, ttlSeconds);
  }

  verifySignedDownloadToken(token: string) {
    return new LocalFilesystemStorageProvider('./storage').verifySignedDownloadToken(token);
  }
}
