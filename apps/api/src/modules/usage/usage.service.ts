import { prisma } from '../../db/client';

export type UsageMetric =
  | 'AI_IMAGE_GEN'
  | 'AI_TEXT_GEN'
  | 'CLOUD_API_CALL'
  | 'LOCAL_AI_CALL'
  | 'STORAGE_BYTES'
  | 'EXPORT_OP'
  | 'WORKFLOW_RUN';

export class UsageService {
  async recordUsage(input: { workspaceId: string; projectId?: string; userId?: string; metric: UsageMetric; quantity?: number; provider?: string; meta?: Record<string, unknown> }) {
    const safeMeta = { ...(input.meta || {}) };
    delete (safeMeta as Record<string, unknown>).apiKey;
    delete (safeMeta as Record<string, unknown>).secret;
    return prisma.usageRecord.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId || null,
        userId: input.userId || null,
        metric: input.metric,
        quantity: input.quantity ?? 1,
        provider: input.provider || null,
        metaJson: JSON.stringify(safeMeta),
      },
    });
  }

  async getWorkspaceUsageSummary(workspaceId: string) {
    const [records, storageAgg, sub] = await Promise.all([
      prisma.usageRecord.groupBy({ by: ['metric'], where: { workspaceId }, _sum: { quantity: true } }),
      prisma.storageObject.aggregate({ where: { workspaceId }, _sum: { fileSize: true } }),
      prisma.subscription.findUnique({ where: { workspaceId }, include: { plan: true } }),
    ]);

    const totals: Record<string, number> = {};
    for (const r of records) totals[r.metric] = r._sum.quantity || 0;
    const storageBytes = storageAgg._sum.fileSize || totals.STORAGE_BYTES || 0;
    const storageMb = Number((storageBytes / (1024 * 1024)).toFixed(2));

    const warnings: string[] = [];
    if (sub?.plan) {
      if ((totals.AI_IMAGE_GEN || 0) >= sub.plan.aiImageQuota * 0.8) warnings.push('AI image generation quota has reached >= 80%.');
      if (storageMb >= sub.plan.storageQuotaMb * 0.8) warnings.push('Workspace storage quota has reached >= 80%.');
    }

    return { totals, storageBytes, storageMb, warnings, plan: sub?.plan || null };
  }

  async getUsageHistory(workspaceId: string) {
    return prisma.usageRecord.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
}
