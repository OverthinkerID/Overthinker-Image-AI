import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { requirePermission } from '../../middleware/tenantContext';
import {
  advanceCampaignStage,
  approveMarketingContent,
  approveMarketingStrategy,
  CAMPAIGN_14_STAGES,
  createAdCampaignWithEstimator,
  createContentCalendar,
  createMarketingCampaign,
  createMarketingProject,
  exportCampaignZip,
  generateCopywritingVariants,
  generateLandingPage,
  generateMarketingStrategy,
  generateSocialContentSuite,
  scheduleCalendarItem
} from './marketing.service';
import {
  completePlatformOAuth,
  disconnectPlatformConnection,
  initiatePlatformOAuth,
  listAllPlatformCapabilities,
  listSafePlatformConnections,
  type SupportedPlatform
} from './platformIntegration.adapter';
import {
  createPublishingJob,
  dispatchPublishingJob,
  generateMarketingPerformanceReport,
  importAnalyticsCsv,
  recordManualAnalytics,
  runPublishingPreflight
} from './publishingAnalytics.service';

export const marketingRouter = Router({ mergeParams: true });

const p = (req: Request, key: string) => String((req.params as Record<string, string | string[]>)[key] || '');
const ws = (req: Request) => req.auth?.workspaceId || 'ws_local_default';
const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res, next).catch(next); };

// Overview & KPIs
marketingRouter.get(
  '/overview',
  requirePermission('projects:view'),
  wrap(async (req: Request, res: Response) => {
    const projectId = p(req, 'id');
    const workspaceId = ws(req);

    const [
      strategies,
      campaigns,
      contents,
      scheduleItems,
      adCampaigns,
      landingPages,
      analyticsRows,
      connections,
      publishingJobs,
      recommendations
    ] = await Promise.all([
      prisma.marketingStrategy.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } }),
      prisma.marketingCampaign.findMany({ where: { workspaceId, projectId }, include: { channels: true }, orderBy: { createdAt: 'desc' } }),
      prisma.marketingContent.findMany({ where: { workspaceId, projectId }, include: { variants: true }, orderBy: { createdAt: 'desc' } }),
      prisma.contentScheduleItem.findMany({ where: { workspaceId }, orderBy: { scheduledAt: 'asc' }, take: 50 }),
      prisma.adCampaign.findMany({ where: { workspaceId, projectId }, include: { creatives: true }, orderBy: { createdAt: 'desc' } }),
      prisma.landingPage.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } }),
      prisma.marketingAnalytics.findMany({ where: { workspaceId, projectId }, orderBy: { periodDate: 'desc' } }),
      listSafePlatformConnections(workspaceId, projectId),
      prisma.publishingJob.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } }),
      prisma.marketingRecommendation.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } })
    ]);

    const totalImpressions = analyticsRows.reduce((s: number, r: any) => s + r.impressions, 0);
    const totalClicks = analyticsRows.reduce((s: number, r: any) => s + r.clicks, 0);

    res.json({
      kpis: {
        strategiesCount: strategies.length,
        campaignsCount: campaigns.length,
        contentsCount: contents.length,
        scheduledCount: scheduleItems.length,
        adCampaignsCount: adCampaigns.length,
        landingPagesCount: landingPages.length,
        connectedPlatformsCount: connections.filter((c: any) => c.status === 'CONNECTED').length,
        totalImpressions,
        overallCtrPct: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0
      },
      strategies,
      campaigns,
      contents,
      scheduleItems,
      adCampaigns,
      landingPages,
      analyticsRows,
      connections,
      publishingJobs,
      recommendations,
      campaignStages: CAMPAIGN_14_STAGES,
      platformCapabilities: listAllPlatformCapabilities()
    });
  })
);

// Marketing Projects
marketingRouter.post(
  '/projects',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        name: z.string().min(1),
        goal: z.string().optional(),
        mode: z.enum(['AUTOMATIC', 'SEMI_AUTOMATIC', 'MANUAL']).optional(),
        timezone: z.string().optional(),
        provider: z.string().optional(),
        model: z.string().optional()
      })
      .parse(req.body);
    const created = await createMarketingProject(ws(req), p(req, 'id'), req.auth?.userId, body);
    res.status(201).json(created);
  })
);

// Marketing Strategist
marketingRouter.post(
  '/strategies/generate',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        marketingProjectId: z.string().optional(),
        title: z.string().optional(),
        mode: z.enum(['AUTOMATIC', 'SEMI_AUTOMATIC', 'MANUAL']).optional(),
        objective: z.string().optional(),
        channels: z.array(z.string()).optional(),
        budgetCents: z.number().int().nonnegative().optional(),
        provider: z.string().optional(),
        model: z.string().optional()
      })
      .parse(req.body);
    const strategy = await generateMarketingStrategy(ws(req), p(req, 'id'), body);
    res.status(201).json(strategy);
  })
);

marketingRouter.post(
  '/strategies/:strategyId/approve',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const updated = await approveMarketingStrategy(ws(req), p(req, 'id'), p(req, 'strategyId'));
    res.json(updated);
  })
);

// Social Media Studio
marketingRouter.post(
  '/social/generate',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        campaignId: z.string().optional(),
        platforms: z.array(z.string()).optional(),
        topic: z.string().optional(),
        tone: z.string().optional(),
        provider: z.string().optional(),
        model: z.string().optional()
      })
      .parse(req.body);
    const result = await generateSocialContentSuite(ws(req), p(req, 'id'), body);
    res.status(201).json(result);
  })
);

marketingRouter.post(
  '/contents/:contentId/approve',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const updated = await approveMarketingContent(ws(req), p(req, 'id'), p(req, 'contentId'));
    res.json(updated);
  })
);

// Copywriting Studio
marketingRouter.post(
  '/copywriting/generate',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        contentType: z.string().min(1),
        platform: z.string().min(1),
        topic: z.string().min(1),
        tone: z.string().optional(),
        cta: z.string().optional()
      })
      .parse(req.body);
    const result = await generateCopywritingVariants(ws(req), p(req, 'id'), body);
    res.status(201).json(result);
  })
);

// Content Calendar
marketingRouter.post(
  '/calendars',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        name: z.string().min(1),
        timezone: z.string().optional(),
        viewMode: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CAMPAIGN']).optional(),
        marketingProjectId: z.string().optional()
      })
      .parse(req.body);
    const cal = await createContentCalendar(ws(req), p(req, 'id'), body);
    res.status(201).json(cal);
  })
);

marketingRouter.post(
  '/calendars/:calendarId/items',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        contentId: z.string().optional(),
        title: z.string().min(1),
        platform: z.string().min(1),
        scheduledAt: z.string().min(1),
        timezone: z.string().optional(),
        notes: z.string().optional()
      })
      .parse(req.body);
    const item = await scheduleCalendarItem(ws(req), p(req, 'calendarId'), body);
    res.status(201).json(item);
  })
);

// Advertising Studio
marketingRouter.post(
  '/ads',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        marketingCampaignId: z.string().optional(),
        platform: z.string().min(1),
        name: z.string().min(1),
        objective: z.string().min(1),
        dailyBudgetCents: z.number().int().positive(),
        durationDays: z.number().int().positive(),
        currency: z.string().optional(),
        targeting: z.record(z.unknown()).optional()
      })
      .parse(req.body);
    const result = await createAdCampaignWithEstimator(ws(req), p(req, 'id'), body);
    res.status(201).json(result);
  })
);

// Campaign Studio & ZIP Export
marketingRouter.post(
  '/campaigns',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        marketingProjectId: z.string().optional(),
        name: z.string().min(1),
        objective: z.string().min(1),
        mode: z.enum(['AUTOMATIC', 'SEMI_AUTOMATIC', 'MANUAL']).optional(),
        budgetCents: z.number().int().nonnegative().optional(),
        channels: z.array(z.string()).optional()
      })
      .parse(req.body);
    const campaign = await createMarketingCampaign(ws(req), p(req, 'id'), body);
    res.status(201).json(campaign);
  })
);

marketingRouter.post(
  '/campaigns/:campaignId/advance',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z.object({ stage: z.number().int().min(1).max(14).optional() }).parse(req.body || {});
    const updated = await advanceCampaignStage(ws(req), p(req, 'id'), p(req, 'campaignId'), body.stage);
    res.json(updated);
  })
);

marketingRouter.post(
  '/campaigns/:campaignId/export',
  requirePermission('projects:view'),
  wrap(async (req: Request, res: Response) => {
    const result = await exportCampaignZip(ws(req), p(req, 'id'), p(req, 'campaignId'));
    res.json(result);
  })
);

// Landing Page Studio
marketingRouter.post(
  '/landing-pages',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        title: z.string().optional(),
        slug: z.string().optional(),
        customHtmlSnippet: z.string().optional(),
        ctaText: z.string().optional()
      })
      .parse(req.body || {});
    const page = await generateLandingPage(ws(req), p(req, 'id'), body);
    res.status(201).json(page);
  })
);

// Platform Integration Manager
marketingRouter.get(
  '/integrations',
  requirePermission('projects:view'),
  wrap(async (req: Request, res: Response) => {
    const connections = await listSafePlatformConnections(ws(req), p(req, 'id'));
    res.json({ capabilities: listAllPlatformCapabilities(), connections });
  })
);

marketingRouter.post(
  '/integrations/oauth/initiate',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        platform: z.enum(['INSTAGRAM', 'FACEBOOK', 'META_ADS', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'X_TWITTER', 'GOOGLE_ADS']),
        displayName: z.string().optional()
      })
      .parse(req.body);
    const result = await initiatePlatformOAuth(ws(req), p(req, 'id'), body.platform as SupportedPlatform, body.displayName);
    res.status(201).json(result);
  })
);

marketingRouter.post(
  '/integrations/:connectionId/oauth/complete',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        oauthState: z.string().min(1),
        accessToken: z.string().min(6),
        refreshToken: z.string().optional(),
        accountName: z.string().optional()
      })
      .parse(req.body);
    const result = await completePlatformOAuth(
      ws(req),
      p(req, 'id'),
      p(req, 'connectionId'),
      body.oauthState,
      body.accessToken,
      body.refreshToken,
      body.accountName
    );
    res.json(result);
  })
);

marketingRouter.post(
  '/integrations/:connectionId/disconnect',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const result = await disconnectPlatformConnection(ws(req), p(req, 'id'), p(req, 'connectionId'));
    res.json(result);
  })
);

// Publishing Engine
marketingRouter.post(
  '/publishing/preflight',
  requirePermission('projects:view'),
  wrap(async (req: Request, res: Response) => {
    const body = z.object({ contentId: z.string(), accountId: z.string().optional(), platform: z.string() }).parse(req.body);
    const result = await runPublishingPreflight(ws(req), p(req, 'id'), body);
    res.json(result);
  })
);

marketingRouter.post(
  '/publishing/jobs',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        contentId: z.string(),
        accountId: z.string().optional(),
        platform: z.string(),
        idempotencyKey: z.string().optional(),
        scheduledFor: z.string().optional()
      })
      .parse(req.body);
    const result = await createPublishingJob(ws(req), p(req, 'id'), body);
    res.status(201).json(result);
  })
);

marketingRouter.post(
  '/publishing/jobs/:jobId/dispatch',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        externalPostId: z.string().optional(),
        confirmed: z.boolean().optional()
      })
      .parse(req.body || {});
    const job = await dispatchPublishingJob(ws(req), p(req, 'id'), p(req, 'jobId'), body);
    res.json(job);
  })
);

// Marketing Analytics & Reports
marketingRouter.post(
  '/analytics/manual',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        platform: z.string().min(1),
        periodDate: z.string().min(1),
        impressions: z.number().int().nonnegative(),
        reach: z.number().int().nonnegative(),
        clicks: z.number().int().nonnegative(),
        engagements: z.number().int().nonnegative(),
        conversions: z.number().int().nonnegative(),
        spendCents: z.number().int().nonnegative(),
        revenueCents: z.number().int().nonnegative()
      })
      .parse(req.body);
    const row = await recordManualAnalytics(ws(req), p(req, 'id'), body);
    res.status(201).json(row);
  })
);

marketingRouter.post(
  '/analytics/import-csv',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z.object({ csvText: z.string().min(5) }).parse(req.body);
    const result = await importAnalyticsCsv(ws(req), p(req, 'id'), body.csvText);
    res.status(201).json(result);
  })
);

marketingRouter.post(
  '/reports/generate',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z.object({ periodLabel: z.string().optional() }).parse(req.body || {});
    const result = await generateMarketingPerformanceReport(ws(req), p(req, 'id'), body.periodLabel);
    res.status(201).json(result);
  })
);
