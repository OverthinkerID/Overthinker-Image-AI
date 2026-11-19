import { Router } from 'express';
import { prisma } from '../../db/client';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let dbStatus: 'connected' | 'error' = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    service: 'overthinker-image-ai-api',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});
