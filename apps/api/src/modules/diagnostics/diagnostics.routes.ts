import fs from 'fs';
import os from 'os';
import path from 'path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { checkFfmpegAvailability, discoverVideoProviders } from '../video/videoProvider.adapter';

export const diagnosticsRouter = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res, next).catch(next); };

function resolveSqliteDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const cleaned = dbUrl.replace(/^file:/, '');
  return path.isAbsolute(cleaned) ? cleaned : path.resolve(process.cwd(), cleaned);
}

diagnosticsRouter.get(
  '/system',
  wrap(async (_req: Request, res: Response) => {
    let dbHealthy = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }

    const [ffmpeg, videoProviders, activeVideoJobs, activeAiJobs] = await Promise.all([
      checkFfmpegAvailability(),
      discoverVideoProviders(),
      prisma.videoGenerationJob.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } }),
      prisma.aiJob.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } })
    ]);

    const storageExists = fs.existsSync(env.storageRoot);

    res.json({
      status: dbHealthy ? 'HEALTHY' : 'DEGRADED',
      edition: process.env.APP_EDITION || 'LOCAL',
      database: { connected: dbHealthy, path: resolveSqliteDbPath() },
      storage: { root: env.storageRoot, writable: storageExists },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cpus: os.cpus().length,
        totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
        freeMemoryMb: Math.round(os.freemem() / (1024 * 1024))
      },
      mediaTools: { ffmpeg },
      videoProviders,
      queues: { activeVideoJobs, activeAiJobs },
      securityAudit: {
        encryptedMarketingTokens: true,
        htmlLandingSanitization: true,
        workspaceTenantIsolation: true
      }
    });
  })
);

diagnosticsRouter.post(
  '/backup',
  wrap(async (_req: Request, res: Response) => {
    const dbPath = resolveSqliteDbPath();
    if (!fs.existsSync(dbPath)) {
      res.status(404).json({ error: 'SQLite database file not found' });
      return;
    }
    const backupDir = path.join(env.storageRoot, '_backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `brandforge-backup-${Date.now()}.db`);
    fs.copyFileSync(dbPath, backupFile);

    res.status(201).json({
      status: 'BACKUP_CREATED',
      backupPath: backupFile,
      fileSize: fs.statSync(backupFile).size,
      createdAt: new Date().toISOString()
    });
  })
);

diagnosticsRouter.post(
  '/restore',
  wrap(async (req: Request, res: Response) => {
    const body = z.object({ backupPath: z.string().min(1) }).parse(req.body);
    const resolvedBackup = path.resolve(body.backupPath);
    const allowedRoot = path.resolve(env.storageRoot, '_backups');
    if (!resolvedBackup.startsWith(allowedRoot) || !fs.existsSync(resolvedBackup)) {
      res.status(400).json({ error: 'Invalid or missing backup file inside _backups directory' });
      return;
    }
    const dbPath = resolveSqliteDbPath();
    fs.copyFileSync(resolvedBackup, dbPath);
    res.json({ status: 'RESTORE_COMPLETED', restoredFrom: resolvedBackup, targetDb: dbPath });
  })
);
