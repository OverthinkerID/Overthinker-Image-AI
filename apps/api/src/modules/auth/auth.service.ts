import crypto from 'node:crypto';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `$scrypt$n=16384,r=8,p=1$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 5 || parts[1] !== 'scrypt') return false;
  const [, , , salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateTotpCode(secretHex: string, stepOffset = 0): string {
  const counter = Math.floor(Date.now() / 30000) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', Buffer.from(secretHex, 'hex')).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secretHex: string, code: string): boolean {
  const clean = code.trim();
  return [-1, 0, 1].some((offset) => generateTotpCode(secretHex, offset) === clean);
}

export function sanitizeUser<T extends { passwordHash?: string; twoFactorSecret?: string | null; emailVerifyToken?: string | null }>(user: T) {
  const { passwordHash: _p, twoFactorSecret: _t, emailVerifyToken: _e, ...safe } = user;
  return safe;
}

let localContextInitPromise: Promise<{ user: any; workspace: any }> | null = null;

export class AuthService {
  async ensureLocalDefaultContext() {
    if (localContextInitPromise) return localContextInitPromise;
    localContextInitPromise = (async () => {
      const localEmail = 'local@overthinker.studio';
      const user = await prisma.user.upsert({
        where: { email: localEmail },
        update: {},
        create: {
          id: 'usr_local_owner',
          email: localEmail,
          name: 'Local Studio Owner',
          passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
          emailVerifiedAt: new Date(),
          isPlatformAdmin: true,
        },
      });

      const workspace = await prisma.workspace.upsert({
        where: { id: 'ws_local_default' },
        update: {},
        create: {
          id: 'ws_local_default',
          name: 'Local Brand Studio',
          slug: 'local-brand-studio',
          type: 'PERSONAL',
          ownerId: user.id,
          members: { create: { userId: user.id, role: 'OWNER' } },
          settings: { create: { aiMode: 'HYBRID', defaultProvider: 'heuristic', storageProvider: 'LOCAL' } },
        },
      });

      // Backfill any pre-Phase-7 projects that have null workspaceId
      await prisma.project.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } });
      return { user, workspace };
    })().finally(() => {
      localContextInitPromise = null;
    });
    return localContextInitPromise;
  }

  async register(input: { email: string; password: string; name: string; workspaceName?: string }) {
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new AppError(400, 'INVALID_EMAIL', 'Valid email is required.');
    if (input.password.length < 8) throw new AppError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters.');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');

    const verifyToken = crypto.randomBytes(24).toString('hex');
    const user = await prisma.user.create({
      data: {
        email,
        name: input.name.trim() || email.split('@')[0],
        passwordHash: hashPassword(input.password),
        emailVerifyToken: hashToken(verifyToken),
      },
    });

    const wsSlug = `${(input.workspaceName || user.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${crypto.randomBytes(3).toString('hex')}`;
    const workspace = await prisma.workspace.create({
      data: {
        name: input.workspaceName?.trim() || `${user.name}'s Workspace`,
        slug: wsSlug,
        type: 'PERSONAL',
        ownerId: user.id,
        members: { create: { userId: user.id, role: 'OWNER' } },
        settings: { create: { aiMode: 'HYBRID', defaultProvider: 'heuristic', storageProvider: 'LOCAL' } },
      },
    });

    const session = await this.createSession(user.id, workspace.id);
    return { user: sanitizeUser(user), workspace, sessionToken: session.rawToken, expiresAt: session.expiresAt, verificationToken: verifyToken };
  }

  async login(input: { email: string; password: string; totpCode?: string; userAgent?: string; ipAddress?: string }) {
    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(423, 'ACCOUNT_LOCKED', 'Account temporarily locked due to too many failed login attempts.');
    }

    if (!verifyPassword(input.password, user.passwordHash)) {
      const nextAttempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: nextAttempts,
          lockedUntil: nextAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
        },
      });
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!input.totpCode || !verifyTotpCode(user.twoFactorSecret, input.totpCode)) {
        throw new AppError(401, 'TWO_FACTOR_REQUIRED', 'Valid two-factor authentication code is required.');
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });

    const firstMembership = await prisma.workspaceMember.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    const session = await this.createSession(user.id, firstMembership?.workspaceId || null, input.userAgent, input.ipAddress);
    return { user: sanitizeUser(user), activeWorkspaceId: firstMembership?.workspaceId || null, sessionToken: session.rawToken, expiresAt: session.expiresAt };
  }

  async createSession(userId: string, activeWorkspaceId: string | null, userAgent?: string, ipAddress?: string) {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await prisma.userSession.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        activeWorkspaceId,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
        expiresAt,
      },
    });
    return { session, rawToken, expiresAt };
  }

  async resolveSession(rawToken: string) {
    const session = await prisma.userSession.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
    await prisma.userSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    return session;
  }

  async logout(rawToken: string) {
    await prisma.userSession.updateMany({ where: { tokenHash: hashToken(rawToken) }, data: { revokedAt: new Date() } });
    return { loggedOut: true };
  }

  async listSessions(userId: string) {
    return prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, activeWorkspaceId: true, createdAt: true, lastSeenAt: true, expiresAt: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const res = await prisma.userSession.updateMany({ where: { id: sessionId, userId }, data: { revokedAt: new Date() } });
    if (res.count === 0) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found.');
    return { revoked: true };
  }

  async verifyEmail(rawToken: string) {
    const user = await prisma.user.findFirst({ where: { emailVerifyToken: hashToken(rawToken) } });
    if (!user) throw new AppError(400, 'INVALID_TOKEN', 'Invalid verification token.');
    const updated = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), emailVerifyToken: null } });
    return sanitizeUser(updated);
  }

  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) return { sent: true };
    const rawToken = crypto.randomBytes(24).toString('hex');
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    return { sent: true, resetToken: rawToken };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    if (newPassword.length < 8) throw new AppError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters.');
    const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Password reset token is invalid or expired.');
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hashPassword(newPassword), failedLoginAttempts: 0, lockedUntil: null } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.userSession.updateMany({ where: { userId: reset.userId }, data: { revokedAt: new Date() } }),
    ]);
    return { reset: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 8) throw new AppError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters.');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
    }
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(newPassword) } });
    return { changed: true };
  }

  async enableTwoFactor(userId: string) {
    const secretHex = crypto.randomBytes(20).toString('hex');
    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true, twoFactorSecret: secretHex } });
    return { twoFactorEnabled: true, secretHex };
  }

  async disableTwoFactor(userId: string) {
    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
    return { twoFactorEnabled: false };
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string | null }) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { ...(data.name !== undefined ? { name: data.name.trim() } : {}), ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}) },
    });
    return sanitizeUser(updated);
  }
}
