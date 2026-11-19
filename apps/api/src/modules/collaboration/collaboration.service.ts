import { prisma } from '../../db/client';
import { assertProjectTenantAccess } from '../../middleware/tenantContext';
import type { Request } from 'express';

export class CollaborationService {
  async listProjectComments(req: Request, projectId: string) {
    await assertProjectTenantAccess(req, projectId, req.auth!.workspaceRole === 'CLIENT' ? 'portal:view' : 'projects:view');
    const isClient = req.auth!.workspaceRole === 'CLIENT';
    return prisma.projectComment.findMany({
      where: { projectId, workspaceId: req.auth!.workspaceId, ...(isClient ? { isInternal: false } : {}) },
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addProjectComment(req: Request, projectId: string, input: { content: string; mentions?: string[]; isInternal?: boolean }) {
    await assertProjectTenantAccess(req, projectId, 'comments:write');
    const isClient = req.auth!.workspaceRole === 'CLIENT';
    const isInternal = isClient ? false : Boolean(input.isInternal);
    const comment = await prisma.projectComment.create({
      data: {
        workspaceId: req.auth!.workspaceId,
        projectId,
        authorId: req.auth!.userId,
        content: input.content,
        mentionsJson: JSON.stringify(input.mentions || []),
        isInternal,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    for (const mentionedUserId of input.mentions || []) {
      await prisma.notification.create({
        data: {
          workspaceId: req.auth!.workspaceId,
          userId: mentionedUserId,
          type: 'MENTION',
          title: 'You were mentioned in a comment',
          body: input.content.slice(0, 140),
          linkUrl: `/projects/${projectId}`,
        },
      }).catch(() => undefined);
    }

    await prisma.activityLog.create({
      data: { workspaceId: req.auth!.workspaceId, actorId: req.auth!.userId, projectId, action: 'COMMENT_ADDED', entityType: 'PROJECT_COMMENT', entityId: comment.id, summary: `${req.auth!.userName} commented on project` },
    });
    return comment;
  }

  async listAssetComments(req: Request, projectId: string, assetId: string) {
    await assertProjectTenantAccess(req, projectId, req.auth!.workspaceRole === 'CLIENT' ? 'portal:view' : 'projects:view');
    const isClient = req.auth!.workspaceRole === 'CLIENT';
    return prisma.assetComment.findMany({
      where: { workspaceId: req.auth!.workspaceId, projectId, assetId, ...(isClient ? { isInternal: false } : {}) },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAssetComment(req: Request, projectId: string, input: { assetType: string; assetId: string; content: string; mentions?: string[]; isInternal?: boolean }) {
    await assertProjectTenantAccess(req, projectId, 'comments:write');
    const isClient = req.auth!.workspaceRole === 'CLIENT';
    return prisma.assetComment.create({
      data: {
        workspaceId: req.auth!.workspaceId,
        projectId,
        assetType: input.assetType,
        assetId: input.assetId,
        authorId: req.auth!.userId,
        content: input.content,
        mentionsJson: JSON.stringify(input.mentions || []),
        isInternal: isClient ? false : Boolean(input.isInternal),
      },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async listNotifications(userId: string) {
    return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async markNotificationRead(userId: string, notificationId: string) {
    await prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { isRead: true, readAt: new Date() } });
    return { read: true };
  }
}
