import { Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';
import { attachAuthContext, extractSessionToken, sanitizeUser } from '../../middleware/tenantContext';
import { prisma } from '../../db/client';
import { AuthService } from './auth.service';

const authService = new AuthService();
export const authRouter = Router();

const authLimiter = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'auth' });

function setSessionCookie(res: { cookie: (name: string, val: string, opts: Record<string, unknown>) => void }, token: string, expiresAt: Date) {
  res.cookie('bf_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

authRouter.post('/register', authLimiter, async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    setSessionCookie(res, result.sessionToken, result.expiresAt);
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const result = await authService.login({
      ...req.body,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    setSessionCookie(res, result.sessionToken, result.expiresAt);
    res.json({ data: result });
  } catch (e) { next(e); }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = extractSessionToken(req);
    if (token) await authService.logout(token);
    res.clearCookie('bf_session', { path: '/' });
    res.json({ data: { loggedOut: true } });
  } catch (e) { next(e); }
});

authRouter.post('/verify-email', async (req, res, next) => {
  try { res.json({ data: await authService.verifyEmail(String(req.body.token || '')) }); } catch (e) { next(e); }
});

authRouter.post('/password-reset/request', authLimiter, async (req, res, next) => {
  try { res.json({ data: await authService.requestPasswordReset(String(req.body.email || '')) }); } catch (e) { next(e); }
});

authRouter.post('/password-reset/confirm', authLimiter, async (req, res, next) => {
  try { res.json({ data: await authService.resetPassword(String(req.body.token || ''), String(req.body.newPassword || '')) }); } catch (e) { next(e); }
});

authRouter.get('/me', attachAuthContext, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.auth!.userId },
      include: { workspace: { select: { id: true, name: true, slug: true, type: true, isArchived: true } } },
    });
    res.json({
      data: {
        user: user ? sanitizeUser(user) : null,
        activeWorkspaceId: req.auth!.workspaceId,
        workspaceRole: req.auth!.workspaceRole,
        isLocalDefaultMode: req.auth!.isLocalDefaultMode,
        workspaces: memberships.map((m) => ({ ...m.workspace, role: m.role })),
      },
    });
  } catch (e) { next(e); }
});

authRouter.patch('/profile', attachAuthContext, async (req, res, next) => {
  try { res.json({ data: await authService.updateProfile(req.auth!.userId, req.body || {}) }); } catch (e) { next(e); }
});

authRouter.post('/change-password', attachAuthContext, async (req, res, next) => {
  try { res.json({ data: await authService.changePassword(req.auth!.userId, String(req.body.currentPassword || ''), String(req.body.newPassword || '')) }); } catch (e) { next(e); }
});

authRouter.get('/sessions', attachAuthContext, async (req, res, next) => {
  try { res.json({ data: await authService.listSessions(req.auth!.userId) }); } catch (e) { next(e); }
});

authRouter.delete('/sessions/:sessionId', attachAuthContext, async (req, res, next) => {
  try { res.json({ data: await authService.revokeSession(req.auth!.userId, String(req.params.sessionId)) }); } catch (e) { next(e); }
});

authRouter.post('/2fa/enable', attachAuthContext, async (req, res, next) => {
  try { res.json({ data: await authService.enableTwoFactor(req.auth!.userId) }); } catch (e) { next(e); }
});

authRouter.post('/2fa/disable', attachAuthContext, async (req, res, next) => {
  try { res.json({ data: await authService.disableTwoFactor(req.auth!.userId) }); } catch (e) { next(e); }
});
