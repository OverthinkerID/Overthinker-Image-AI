import crypto from 'crypto';
import { prisma } from '../../db/client';
import { getPlatformCapabilities, type SupportedPlatform } from './platformIntegration.adapter';

export interface PreflightCheckResult {
  passed: boolean;
  checks: Array<{ key: string; label: string; passed: boolean; message: string }>;
}

export async function runPublishingPreflight(
  workspaceId: string,
  projectId: string,
  input: { contentId: string; accountId?: string; platform: string }
): Promise<PreflightCheckResult> {
  const content = await prisma.marketingContent.findFirst({
    where: { id: input.contentId, workspaceId, projectId }
  });
  const account = input.accountId
    ? await prisma.publishingAccount.findFirst({
        where: { id: input.accountId, workspaceId, projectId },
        include: { connection: { include: { permissions: true } } }
      })
    : await prisma.publishingAccount.findFirst({
        where: { workspaceId, projectId, platform: input.platform, status: 'CONNECTED' },
        include: { connection: { include: { permissions: true } } }
      });

  const caps = getPlatformCapabilities(input.platform as SupportedPlatform);
  const checks = [
    {
      key: 'CONTENT_EXISTS',
      label: 'Content record exists in workspace',
      passed: Boolean(content),
      message: content ? 'Content found' : 'Content not found'
    },
    {
      key: 'CONTENT_APPROVED',
      label: 'Content approved before publishing',
      passed: Boolean(content?.isApproved),
      message: content?.isApproved ? 'Content is approved' : 'Content must be approved before publishing'
    },
    {
      key: 'PLATFORM_SUPPORTED',
      label: 'Platform supports automated publishing',
      passed: Boolean(caps?.supportsAutoPublish),
      message: caps?.supportsAutoPublish ? 'Auto-publish supported' : `Auto-publish not supported for ${input.platform}`
    },
    {
      key: 'ACCOUNT_CONNECTED',
      label: 'Publishing account is connected',
      passed: Boolean(account && account.status === 'CONNECTED' && account.connection?.status === 'CONNECTED'),
      message: account?.status === 'CONNECTED' ? 'Account connected' : 'No active connected account'
    },
    {
      key: 'PERMISSIONS_GRANTED',
      label: 'Required platform permissions granted',
      passed: Boolean(account?.connection?.permissions?.some((perm: any) => perm.granted)),
      message: account?.connection?.permissions?.some((perm: any) => perm.granted) ? 'Permissions granted' : 'Required OAuth scopes not granted'
    },
    {
      key: 'CAPTION_VALID',
      label: 'Caption non-empty and within platform limit',
      passed: Boolean(content && content.caption.trim().length > 0 && (!caps || content.caption.length <= caps.maxCaptionLength)),
      message: content && caps && content.caption.length > caps.maxCaptionLength
        ? `Caption exceeds ${caps.maxCaptionLength} chars`
        : 'Caption length valid'
    },
    {
      key: 'BRAND_TITLE_VALID',
      label: 'Title and CTA metadata present',
      passed: Boolean(content && content.title.trim().length > 0),
      message: content?.title ? 'Title present' : 'Title missing'
    }
  ];

  return {
    passed: checks.every((c) => c.passed),
    checks
  };
}

export async function createPublishingJob(
  workspaceId: string,
  projectId: string,
  input: { contentId: string; accountId?: string; platform: string; idempotencyKey?: string; scheduledFor?: string }
) {
  const idempotencyKey =
    input.idempotencyKey || crypto.createHash('sha256').update(`${workspaceId}:${projectId}:${input.contentId}:${input.platform}`).digest('hex');

  const existing = await prisma.publishingJob.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return { job: existing, deduplicated: true };
  }

  const preflight = await runPublishingPreflight(workspaceId, projectId, input);
  const status = preflight.passed ? 'QUEUED' : 'PREFLIGHT_FAILED';

  const job = await prisma.publishingJob.create({
    data: {
      workspaceId,
      projectId,
      contentId: input.contentId,
      accountId: input.accountId || null,
      platform: input.platform,
      idempotencyKey,
      status,
      preflightJson: JSON.stringify(preflight),
      platformConfirmed: false,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
      errorMessage: preflight.passed ? null : 'Pre-flight checks failed. Resolve requirements before dispatch.'
    }
  });

  return { job, preflight, deduplicated: false };
}

export async function dispatchPublishingJob(
  workspaceId: string,
  projectId: string,
  jobId: string,
  platformConfirmation?: { externalPostId?: string; confirmed?: boolean }
) {
  const job = await prisma.publishingJob.findFirst({ where: { id: jobId, workspaceId, projectId } });
  if (!job) throw new Error('Publishing job not found');
  if (job.status === 'PREFLIGHT_FAILED') {
    throw new Error('Cannot dispatch job that failed pre-flight checks');
  }

  // Never claim CONFIRMED_PUBLISHED unless external platform explicitly confirmed with externalPostId
  const confirmed = Boolean(platformConfirmation?.confirmed && platformConfirmation?.externalPostId);

  return prisma.publishingJob.update({
    where: { id: job.id },
    data: {
      status: confirmed ? 'CONFIRMED_PUBLISHED' : 'DISPATCHED',
      platformConfirmed: confirmed,
      externalPostId: confirmed ? platformConfirmation?.externalPostId : null,
      dispatchedAt: new Date()
    }
  });
}

export async function recordManualAnalytics(
  workspaceId: string,
  projectId: string,
  input: {
    platform: string;
    periodDate: string;
    impressions: number;
    reach: number;
    clicks: number;
    engagements: number;
    conversions: number;
    spendCents: number;
    revenueCents: number;
    dataSource?: string;
  }
) {
  const ctr = input.impressions > 0 ? Number(((input.clicks / input.impressions) * 100).toFixed(2)) : 0;
  const cpcCents = input.clicks > 0 ? Number((input.spendCents / input.clicks).toFixed(2)) : 0;

  return prisma.marketingAnalytics.create({
    data: {
      workspaceId,
      projectId,
      platform: input.platform,
      periodDate: new Date(input.periodDate),
      impressions: input.impressions,
      reach: input.reach,
      clicks: input.clicks,
      engagements: input.engagements,
      conversions: input.conversions,
      spendCents: input.spendCents,
      revenueCents: input.revenueCents,
      ctr,
      cpcCents,
      dataSource: input.dataSource || 'MANUAL'
    }
  });
}

export async function importAnalyticsCsv(workspaceId: string, projectId: string, csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must include header row and at least one data row');

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const created = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || '';
    });
    const impressions = Number(row.impressions || 0);
    const clicks = Number(row.clicks || 0);
    const spendCents = Number(row.spendcents || row.spend_cents || 0);
    const item = await recordManualAnalytics(workspaceId, projectId, {
      platform: row.platform || 'INSTAGRAM',
      periodDate: row.date || row.perioddate || new Date().toISOString().slice(0, 10),
      impressions,
      reach: Number(row.reach || impressions),
      clicks,
      engagements: Number(row.engagements || 0),
      conversions: Number(row.conversions || 0),
      spendCents,
      revenueCents: Number(row.revenuecents || row.revenue_cents || 0),
      dataSource: 'CSV_IMPORT'
    });
    created.push(item);
  }

  return { importedCount: created.length, rows: created };
}

export async function generateMarketingPerformanceReport(
  workspaceId: string,
  projectId: string,
  periodLabel?: string
) {
  const rows = await prisma.marketingAnalytics.findMany({
    where: { workspaceId, projectId },
    orderBy: { periodDate: 'asc' }
  });

  const actualTotals = rows.reduce(
    (acc: any, r: any) => ({
      impressions: acc.impressions + r.impressions,
      reach: acc.reach + r.reach,
      clicks: acc.clicks + r.clicks,
      engagements: acc.engagements + r.engagements,
      conversions: acc.conversions + r.conversions,
      spendCents: acc.spendCents + r.spendCents,
      revenueCents: acc.revenueCents + r.revenueCents
    }),
    { impressions: 0, reach: 0, clicks: 0, engagements: 0, conversions: 0, spendCents: 0, revenueCents: 0 }
  );

  const calculatedKpis = {
    overallCtrPct: actualTotals.impressions > 0 ? Number(((actualTotals.clicks / actualTotals.impressions) * 100).toFixed(2)) : 0,
    averageCpcCents: actualTotals.clicks > 0 ? Number((actualTotals.spendCents / actualTotals.clicks).toFixed(2)) : 0,
    conversionRatePct: actualTotals.clicks > 0 ? Number(((actualTotals.conversions / actualTotals.clicks) * 100).toFixed(2)) : 0,
    roas: actualTotals.spendCents > 0 ? Number((actualTotals.revenueCents / actualTotals.spendCents).toFixed(2)) : 0
  };

  const aiInsights = [
    {
      category: 'AI_RECOMMENDATION',
      title: rows.length === 0 ? 'Import or record baseline metrics first' : 'Optimize top-CTR channel allocation',
      rationale:
        rows.length === 0
          ? 'No actual analytics rows recorded yet. Import CSV or enter manual campaign metrics before scaling spend.'
          : `Observed ${calculatedKpis.overallCtrPct}% overall CTR across ${rows.length} reported data points. Test A/B hooks on highest-impression channels.`
    }
  ];

  const report = await prisma.marketingReport.create({
    data: {
      workspaceId,
      projectId,
      title: `Marketing Performance Report (${periodLabel || 'Current Period'})`,
      periodLabel: periodLabel || 'Current Period',
      actualSummaryJson: JSON.stringify({ dataType: 'ACTUAL_RECORDED', rowCount: rows.length, totals: actualTotals }),
      calculatedKpisJson: JSON.stringify({ dataType: 'CALCULATED_FROM_ACTUAL', ...calculatedKpis }),
      aiInsightsJson: JSON.stringify(aiInsights)
    }
  });

  const rec = await prisma.marketingRecommendation.create({
    data: {
      workspaceId,
      projectId,
      category: 'CONTENT',
      title: aiInsights[0].title,
      rationale: aiInsights[0].rationale,
      priority: 'HIGH'
    }
  });

  return { report, recommendation: rec, actualTotals, calculatedKpis, aiInsights };
}
