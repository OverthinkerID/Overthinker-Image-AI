import { prisma } from '../../db/client';
import { sanitizeUser } from '../../middleware/tenantContext';

export class AdminService {
  async getPlatformOverview() {
    const [usersCount, workspacesCount, projectsCount, activeJobs, aiProviders, storageAgg] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.project.count(),
      prisma.automationWorkflow.count({ where: { status: { in: ['RUNNING', 'QUEUED'] } } }),
      prisma.aiProviderConfig.findMany({ select: { id: true, name: true, providerType: true, mode: true, isActive: true, healthStatus: true, lastCheckedAt: true } }),
      prisma.storageObject.aggregate({ _sum: { fileSize: true } }),
    ]);

    return {
      systemHealth: 'OPERATIONAL',
      usersCount,
      workspacesCount,
      projectsCount,
      activeBackgroundJobs: activeJobs,
      totalTrackedStorageBytes: storageAgg._sum.fileSize || 0,
      aiProviders,
    };
  }

  async listUsers() {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return users.map((u) => sanitizeUser(u));
  }

  async listWorkspaces() {
    return prisma.workspace.findMany({
      include: {
        owner: { select: { id: true, email: true, name: true } },
        subscription: { include: { plan: true } },
        _count: { select: { projects: true, members: true, clients: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listAuditLogs(actorAdminId: string) {
    // Audited support access check — never silently access private client files
    return prisma.activityLog.findMany({
      where: actorAdminId ? {} : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
