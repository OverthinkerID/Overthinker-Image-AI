import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const ALLOWED_LOGO_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
};

export interface SaveOriginalLogoInput {
  projectId: string;
  logoId: string;
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
}

export interface SaveOriginalLogoResult {
  storedFilename: string;
  storagePath: string;
  absolutePath: string;
  sha256: string;
  fileSize: number;
}

export class LocalStorageService {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  getRootDir(): string {
    return this.rootDir;
  }

  resolveSafePath(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const resolved = path.resolve(this.rootDir, normalized);
    const rootWithSep = this.rootDir.endsWith(path.sep)
      ? this.rootDir
      : `${this.rootDir}${path.sep}`;

    if (resolved !== this.rootDir && !resolved.startsWith(rootWithSep)) {
      throw new Error('Invalid storage path: directory traversal detected');
    }
    return resolved;
  }

  async saveOriginalLogo(input: SaveOriginalLogoInput): Promise<SaveOriginalLogoResult> {
    const ext = ALLOWED_LOGO_MIME_TYPES[input.mimeType];
    if (!ext) {
      throw new Error(`Unsupported logo MIME type: ${input.mimeType}`);
    }
    if (!input.buffer || input.buffer.length === 0) {
      throw new Error('Uploaded logo file is empty');
    }

    const safeProjectId = input.projectId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeLogoId = input.logoId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeProjectId || !safeLogoId) {
      throw new Error('Invalid projectId or logoId');
    }

    const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');
    const shortHash = sha256.slice(0, 12);
    const storedFilename = `${safeLogoId}-${shortHash}.${ext}`;
    const relativePath = path.posix.join('projects', safeProjectId, 'logos', 'originals', storedFilename);
    const absolutePath = this.resolveSafePath(relativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.buffer, { flag: 'wx' });

    return {
      storedFilename,
      storagePath: relativePath,
      absolutePath,
      sha256,
      fileSize: input.buffer.length,
    };
  }

  async saveConceptAsset(params: {
    projectId: string;
    conceptId: string;
    filename: string;
    buffer: Buffer;
  }): Promise<{ storagePath: string; absolutePath: string }> {
    const safeProjectId = params.projectId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeConceptId = params.conceptId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFile = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativePath = path.posix.join('projects', safeProjectId, 'concepts', safeConceptId, safeFile);
    const absolutePath = this.resolveSafePath(relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, params.buffer);
    return { storagePath: relativePath, absolutePath };
  }

  async saveProjectScopedAsset(params: {
    projectId: string;
    folder: 'variations' | 'elements' | 'fonts' | 'exports' | 'mockups';
    filename: string;
    buffer: Buffer;
  }): Promise<{ storagePath: string; absolutePath: string }> {
    const safeProjectId = params.projectId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFile = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativePath = path.posix.join('projects', safeProjectId, params.folder, safeFile);
    const absolutePath = this.resolveSafePath(relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, params.buffer);
    return { storagePath: relativePath, absolutePath };
  }

  async readLogo(relativePath: string): Promise<Buffer> {
    return fs.readFile(this.resolveSafePath(relativePath));
  }

  async readConceptAsset(relativePath: string): Promise<Buffer> {
    return fs.readFile(this.resolveSafePath(relativePath));
  }

  async readRelativeFile(relativePath: string): Promise<Buffer> {
    return fs.readFile(this.resolveSafePath(relativePath));
  }

  async deleteRelativeFile(relativePath: string): Promise<void> {
    const normalized = relativePath.replace(/\\/g, '/');
    if (normalized.includes('/logos/originals/')) {
      throw new Error('Refusing to delete immutable original logo file');
    }
    await fs.rm(this.resolveSafePath(relativePath), { force: true });
  }

  async fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolveSafePath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async deleteProjectStorage(projectId: string): Promise<void> {
    const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeProjectId) return;
    const projectDir = this.resolveSafePath(path.posix.join('projects', safeProjectId));
    await fs.rm(projectDir, { recursive: true, force: true });
  }
}
