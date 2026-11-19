import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';

export class ClientPortalService {
  async grantAccess(workspaceId: string, actorId: string, input: { clientId: string; projectId: string; userId: string; visibleAssetIds?: string[]; allowDownloads?: boolean; allowComments?: boolean; allowApprovals?: boolean }) {
    const [client, project, member] = await Promise.all([
      prisma.client.findFirst({ where: { id: input.clientId, workspaceId } }),
      prisma.project.findFirst({ where: { id: input.projectId, workspaceId } }),
      prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: input.userId } } }),
    ]);
    if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found in workspace.');
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found in workspace.');
    if (!member) {
      await prisma.workspaceMember.create({ data: { workspaceId, userId: input.userId, role: 'CLIENT' } });
    }
    const access = await prisma.clientPortalAccess.upsert({
      where: { projectId_userId: { projectId: project.id, userId: input.userId } },
      update: {
        visibleAssetIdsJson: JSON.stringify(input.visibleAssetIds || []),
        allowDownloads: input.allowDownloads ?? true,
        allowComments: input.allowComments ?? true,
        allowApprovals: input.allowApprovals ?? true,
        isActive: true,
      },
      create: {
        workspaceId,
        clientId: client.id,
        projectId: project.id,
        userId: input.userId,
        visibleAssetIdsJson: JSON.stringify(input.visibleAssetIds || []),
        allowDownloads: input.allowDownloads ?? true,
        allowComments: input.allowComments ?? true,
        allowApprovals: input.allowApprovals ?? true,
      },
    });
    await prisma.activityLog.create({
      data: { workspaceId, actorId, clientId: client.id, projectId: project.id, action: 'PORTAL_ACCESS_GRANTED', entityType: 'CLIENT_PORTAL_ACCESS', entityId: access.id, summary: `Granted client portal access for project "${project.name}"` },
    });
    return access;
  }

  async listSharedProjectsForClient(workspaceId: string, userId: string) {
    const grants = await prisma.clientPortalAccess.findMany({
      where: { workspaceId, userId, isActive: true },
      include: { project: { select: { id: true, name: true, slug: true, description: true, industry: true, status: true, updatedAt: true } } },
    });
    return grants;
  }

  async getPortalProjectView(workspaceId: string, userId: string, projectId: string, isAgencyStaff: boolean) {
    let grant = null;
    if (!isAgencyStaff) {
      grant = await prisma.clientPortalAccess.findUnique({ where: { projectId_userId: { projectId, userId } } });
      if (!grant || !grant.isActive || grant.workspaceId !== workspaceId) {
        throw new AppError(403, 'PORTAL_ACCESS_DENIED', 'You do not have portal access to this project.');
      }
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true, name: true, slug: true, description: true, industry: true, status: true, updatedAt: true },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');

    const visibleIds = grant ? (JSON.parse(grant.visibleAssetIdsJson || '[]') as string[]) : [];
    const [concepts, assets, mockups, guidelines, comments] = await Promise.all([
      prisma.brandConcept.findMany({
        where: { projectId },
        select: { id: true, categoryKey: true, conceptName: true, description: true, visualDirection: true, colorPaletteJson: true, typographyJson: true, mockupPreviewsJson: true, isPrimary: true, isApproved: true },
      }),
      prisma.brandAsset.findMany({
        where: {
          projectId,
          ...(visibleIds.length > 0 ? { id: { in: visibleIds } } : { isApproved: true }),
        },
        select: { id: true, name: true, category: true, assetType: true, mimeType: true, version: true, isApproved: true, isLocked: true },
      }),
      prisma.mockupDocument.findMany({
        where: { projectId },
        select: { id: true, title: true, category: true, width: true, height: true, currentVersion: true },
      }),
      prisma.brandGuideline.findMany({
        where: { projectId },
        select: { id: true, title: true, currentVersion: true, sections: { select: { id: true, title: true, content: true, orderIndex: true }, orderBy: { orderIndex: 'asc' } } },
      }),
      // Strictly exclude internal agency comments
      prisma.projectComment.findMany({
        where: { projectId, workspaceId, isInternal: false },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      project,
      permissions: grant ? { allowDownloads: grant.allowDownloads, allowComments: grant.allowComments, allowApprovals: grant.allowApprovals } : { allowDownloads: true, allowComments: true, allowApprovals: true },
      concepts,
      assets,
      mockups,
      guidelines,
      comments,
    };
  }

  async submitClientDecision(workspaceId: string, userId: string, projectId: string, input: { targetType: string; targetId: string; status: 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED'; comment?: string }, isAgencyStaff: boolean) {
    if (!isAgencyStaff) {
      const grant = await prisma.clientPortalAccess.findUnique({ where: { projectId_userId: { projectId, userId } } });
      if (!grant || !grant.isActive || !grant.allowApprovals || grant.workspaceId !== workspaceId) {
        throw new AppError(403, 'PORTAL_APPROVAL_DENIED', 'Approval permission not granted.');
      }
    }
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');

    const approval = await prisma.assetApproval.create({
      data: {
        projectId,
        targetType: input.targetType,
        targetId: input.targetId,
        status: input.status,
        isLocked: input.status === 'APPROVED',
        comment: input.comment || null,
      },
    });
    if (input.targetType === 'BRAND_ASSET') {
      await prisma.brandAsset.updateMany({
        where: { id: input.targetId, projectId },
        data: { isApproved: input.status === 'APPROVED', isLocked: input.status === 'APPROVED' },
      });
    }
    await prisma.activityLog.create({
      data: { workspaceId, actorId: userId, projectId, action: `PORTAL_${input.status}`, entityType: input.targetType, entityId: input.targetId, summary: `Client submitted ${input.status} on ${input.targetType}` },
    });
    return approval;
  }
}
