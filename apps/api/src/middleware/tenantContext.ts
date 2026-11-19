import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/client';
import { AuthService, sanitizeUser } from '../modules/auth/auth.service';
import { AppError } from './errorHandler';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'DESIGNER' | 'REVIEWER' | 'CLIENT';

export const ROLE_PERMISSIONS: Record<WorkspaceRole, Set<string>> = {
  OWNER: new Set(['workspace:manage', 'workspace:delete', 'billing:manage', 'members:manage', 'clients:manage', 'projects:create', 'projects:edit', 'projects:view', 'assets:approve', 'comments:write']),
  ADMIN: new Set(['workspace:manage', 'members:manage', 'clients:manage', 'projects:create', 'projects:edit', 'projects:view', 'assets:approve', 'comments:write']),
  DESIGNER: new Set(['projects:create', 'projects:edit', 'projects:view', 'comments:write']),
  REVIEWER: new Set(['projects:view', 'assets:approve', 'comments:write']),
  CLIENT: new Set(['portal:view', 'assets:approve', 'comments:write']),
};

export interface AuthContext {
  userId: string;
  userEmail: string;
  userName: string;
  isPlatformAdmin: boolean;
  sessionId: string | null;
  workspaceId: string;
  workspaceRole: WorkspaceRole;
  isLocalDefaultMode: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const authService = new AuthService();

export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === 'bf_session') return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function isSaasEdition(): boolean {
  return (process.env.APP_EDITION || 'LOCAL').toUpperCase() === 'SAAS';
}

export async function attachAuthContext(req: Request, _res: Response, next: NextFunction) {
  try {
    const rawToken = extractSessionToken(req);
    const requestedWsId = typeof req.headers['x-workspace-id'] === 'string' ? req.headers['x-workspace-id'].trim() : undefined;

    if (rawToken) {
      const session = await authService.resolveSession(rawToken);
      if (!session) {
        if (isSaasEdition()) {
          throw new AppError(401, 'UNAUTHORIZED', 'Session expired or invalid.');
        }
      } else {
        const targetWsId = requestedWsId || session.activeWorkspaceId || undefined;
        let membership = targetWsId
          ? await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: targetWsId, userId: session.userId } } })
          : await prisma.workspaceMember.findFirst({ where: { userId: session.userId }, orderBy: { createdAt: 'asc' } });

        // Never trust frontend-supplied workspaceId if user is not a member
        if (requestedWsId && !membership) {
          throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'You do not have access to the requested workspace.');
        }

        if (!membership && !isSaasEdition()) {
          const local = await authService.ensureLocalDefaultContext();
          membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: local.workspace.id, userId: local.user.id } } });
        }

        if (!membership) {
          throw new AppError(403, 'NO_WORKSPACE_MEMBERSHIP', 'User has no active workspace membership.');
        }

        req.auth = {
          userId: session.userId,
          userEmail: session.user.email,
          userName: session.user.name,
          isPlatformAdmin: session.user.isPlatformAdmin,
          sessionId: session.id,
          workspaceId: membership.workspaceId,
          workspaceRole: membership.role as WorkspaceRole,
          isLocalDefaultMode: false,
        };
        next();
        return;
      }
    }

    if (isSaasEdition()) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required in SaaS Edition.');
    }

    // Local Edition single-user fallback
    const local = await authService.ensureLocalDefaultContext();
    req.auth = {
      userId: local.user.id,
      userEmail: local.user.email,
      userName: local.user.name,
      isPlatformAdmin: true,
      sessionId: null,
      workspaceId: requestedWsId && requestedWsId === local.workspace.id ? requestedWsId : local.workspace.id,
      workspaceRole: 'OWNER',
      isLocalDefaultMode: true,
    };
    if (requestedWsId && requestedWsId !== local.workspace.id) {
      throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace access denied.');
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
      return;
    }
    const allowed = ROLE_PERMISSIONS[req.auth.workspaceRole];
    if (!allowed || !allowed.has(permission)) {
      next(new AppError(403, 'FORBIDDEN', `Role "${req.auth.workspaceRole}" lacks permission "${permission}".`));
      return;
    }
    next();
  };
}

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth || !req.auth.isPlatformAdmin) {
    next(new AppError(403, 'PLATFORM_ADMIN_REQUIRED', 'Platform administrator privileges required.'));
    return;
  }
  next();
}

export async function assertProjectTenantAccess(req: Request, projectId: string, requiredPermission = 'projects:view') {
  if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: req.auth.workspaceId } });
  if (!project) {
    throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found in active workspace.');
  }

  if (req.auth.workspaceRole === 'CLIENT') {
    const portalAccess = await prisma.clientPortalAccess.findUnique({
      where: { projectId_userId: { projectId, userId: req.auth.userId } },
    });
    if (!portalAccess || !portalAccess.isActive) {
      throw new AppError(403, 'CLIENT_ACCESS_DENIED', 'You are not authorized to access this project.');
    }
    if (!['portal:view', 'assets:approve', 'comments:write'].includes(requiredPermission)) {
      throw new AppError(403, 'CLIENT_RESTRICTED', 'Clients cannot perform internal agency mutations.');
    }
    return { project, portalAccess };
  }

  const allowed = ROLE_PERMISSIONS[req.auth.workspaceRole];
  if (!allowed || !allowed.has(requiredPermission)) {
    throw new AppError(403, 'FORBIDDEN', `Role "${req.auth.workspaceRole}" lacks permission "${requiredPermission}".`);
  }
  return { project, portalAccess: null };
}

export { sanitizeUser };
