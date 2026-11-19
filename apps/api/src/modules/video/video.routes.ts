import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { requirePermission } from '../../middleware/tenantContext';
import { discoverVideoProviders } from './videoProvider.adapter';
import {
  BRAND_VIDEO_TEMPLATES,
  cancelOrRetryVideoJob,
  createDeterministicLogoAnimation,
  createVideoGenerationJob,
  createVideoProject,
  createVoiceProfileAndAudio,
  generateVideoScriptAndStoryboard,
  renderVideoProject,
  runVideoQualityControl
} from './videoStudio.service';

export const videoRouter = Router({ mergeParams: true });

const p = (req: Request, key: string) => String((req.params as Record<string, string | string[]>)[key] || '');
const ws = (req: Request) => req.auth?.workspaceId || 'ws_local_default';
const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res, next).catch(next); };

videoRouter.get(
  '/overview',
  requirePermission('projects:view'),
  wrap(async (req: Request, res: Response) => {
    const projectId = p(req, 'id');
    const workspaceId = ws(req);

    const [videoProjects, assets, jobs, voiceProfiles, renderJobs, qcReports, providers] = await Promise.all([
      prisma.videoProject.findMany({
        where: { workspaceId, projectId, deletedAt: null },
        include: {
          scripts: true,
          storyboards: { include: { scenes: true } },
          timelines: { include: { tracks: { include: { clips: true } }, subtitles: true, overlays: true, transitions: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.videoAsset.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } }),
      prisma.videoGenerationJob.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } }),
      prisma.voiceProfile.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } }),
      prisma.videoRenderJob.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } }),
      prisma.videoQualityReport.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } }),
      discoverVideoProviders()
    ]);

    res.json({
      templates: BRAND_VIDEO_TEMPLATES,
      providers,
      videoProjects,
      assets,
      jobs,
      voiceProfiles,
      renderJobs,
      qcReports
    });
  })
);

videoRouter.post(
  '/projects',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        title: z.string().min(1),
        templateKey: z.string().optional(),
        mode: z.enum(['AUTOMATIC', 'SEMI_AUTOMATIC', 'MANUAL']).optional(),
        aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
        durationSec: z.number().int().positive().optional(),
        provider: z.string().optional()
      })
      .parse(req.body);
    const result = await createVideoProject(ws(req), p(req, 'id'), req.auth?.userId, body);
    res.status(201).json(result);
  })
);

videoRouter.post(
  '/projects/:videoProjectId/storyboard',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z.object({ language: z.string().optional(), topic: z.string().optional() }).parse(req.body || {});
    const result = await generateVideoScriptAndStoryboard(ws(req), p(req, 'id'), p(req, 'videoProjectId'), body);
    res.status(201).json(result);
  })
);

videoRouter.post(
  '/jobs',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        videoProjectId: z.string().optional(),
        jobType: z.enum(['TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO', 'REF_TO_VIDEO', 'LOGO_ANIMATION']),
        provider: z.string().optional(),
        model: z.string().optional(),
        prompt: z.string().min(1),
        params: z.record(z.unknown()).optional()
      })
      .parse(req.body);
    const job = await createVideoGenerationJob(ws(req), p(req, 'id'), body);
    res.status(201).json(job);
  })
);

videoRouter.post(
  '/jobs/:jobId/:action',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const action = p(req, 'action').toUpperCase() === 'CANCEL' ? 'CANCEL' : 'RETRY';
    const updated = await cancelOrRetryVideoJob(ws(req), p(req, 'id'), p(req, 'jobId'), action);
    res.json(updated);
  })
);

videoRouter.post(
  '/logo-animation',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        videoProjectId: z.string().optional(),
        sourceLogoId: z.string().optional(),
        animationStyle: z.string().optional(),
        durationSec: z.number().positive().optional(),
        backgroundHex: z.string().optional()
      })
      .parse(req.body || {});
    const result = await createDeterministicLogoAnimation(ws(req), p(req, 'id'), body);
    res.status(201).json(result);
  })
);

videoRouter.post(
  '/voice-audio',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        profileName: z.string().min(1),
        language: z.string().optional(),
        consentGranted: z.boolean(),
        consentNote: z.string().optional(),
        text: z.string().optional(),
        timelineId: z.string().optional()
      })
      .parse(req.body);
    const result = await createVoiceProfileAndAudio(ws(req), p(req, 'id'), body);
    res.status(201).json(result);
  })
);

videoRouter.post(
  '/projects/:videoProjectId/render',
  requirePermission('projects:edit'),
  wrap(async (req: Request, res: Response) => {
    const body = z
      .object({
        format: z.enum(['MP4', 'WEBM']).optional(),
        aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional()
      })
      .parse(req.body || {});
    const job = await renderVideoProject(ws(req), p(req, 'id'), p(req, 'videoProjectId'), body);
    res.status(201).json(job);
  })
);

videoRouter.post(
  '/projects/:videoProjectId/qc',
  requirePermission('projects:view'),
  wrap(async (req: Request, res: Response) => {
    const report = await runVideoQualityControl(ws(req), p(req, 'id'), p(req, 'videoProjectId'));
    res.status(201).json(report);
  })
);
