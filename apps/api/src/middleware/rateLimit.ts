import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler';

interface Bucket { count: number; resetAt: number; }
const buckets = new Map<string, Bucket>();

export function rateLimit(opts: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    const key = `${opts.keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }
    if (existing.count >= opts.max) {
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
      return;
    }
    existing.count += 1;
    next();
  };
}
