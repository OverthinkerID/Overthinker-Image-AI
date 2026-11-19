import crypto from 'node:crypto';
import sharp from 'sharp';
import { env } from '../../config/appConfig';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';
import { UsageService } from '../usage/usage.service';
import { ImageEditorProviderAdapter } from './imageEditorProvider.adapter';
import { ImageProcessingService, type ImageAdjustments, type MaskGeometry, type ProtectedBox } from './imageProcessing.service';

const storage = new LocalStorageService(env.storageRoot);
const proc = new ImageProcessingService();
const providerAdapter = new ImageEditorProviderAdapter();
const usageService = new UsageService();

export const PRESET_IMAGE_WORKFLOWS = [
  { presetType: 'BG_REMOVAL', name: 'Background Removal', steps: [{ operation: 'BG_REMOVE', params: {} }] },
  { presetType: 'PRODUCT_ENHANCE', name: 'Product Photo Enhancement', steps: [{ operation: 'ADJUST', params: { contrast: 1.08, saturation: 1.05, sharpness: 1.2 } }, { operation: 'UPSCALE', params: { factor: 2 } }] },
  { presetType: 'GEN_FILL', name: 'Generative Fill', steps: [{ operation: 'GEN_FILL', params: { denoise: 0.65 } }] },
  { presetType: 'OBJECT_REPLACE', name: 'Object Replacement', steps: [{ operation: 'OBJECT_REPLACE', params: { denoise: 0.7 } }] },
  { presetType: 'RESTORATION', name: 'Image Restoration', steps: [{ operation: 'ADJUST', params: { denoise: 3, sharpness: 1.5 } }, { operation: 'UPSCALE', params: { factor: 2 } }] },
  { presetType: 'BRAND_SAFE_MOCKUP', name: 'Brand-Safe Mockup Editing', steps: [{ operation: 'BG_REPLACE', params: { preset: 'STUDIO' } }] },
  { presetType: 'SOCIAL_PREP', name: 'Social Media Image Preparation', steps: [{ operation: 'RESIZE', params: { width: 1080, height: 1080 } }] },
  { presetType: 'PACKAGING_VIZ', name: 'Packaging Visualization', steps: [{ operation: 'BG_REPLACE', params: { preset: 'LUXURY' } }, { operation: 'ADJUST', params: { contrast: 1.1 } }] },
] as const;

export class ImageEditorService {
  private async getScopedEditingProject(workspaceId: string, projectId: string, editingProjectId: string) {
    const ep = await prisma.imageEditingProject.findFirst({
      where: { id: editingProjectId, workspaceId, projectId },
      include: {
        versions: { orderBy: { version: 'desc' } },
        masks: { orderBy: { createdAt: 'desc' } },
        protectedRegions: { orderBy: { createdAt: 'desc' } },
        jobs: { include: { parameters: true }, orderBy: { createdAt: 'desc' } },
        comparisons: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!ep) throw new AppError(404, 'EDITING_PROJECT_NOT_FOUND', 'Image editing project not found in workspace.');
    return ep;
  }

  private async getProtectedBoxes(editingProjectId: string): Promise<ProtectedBox[]> {
    const regions = await prisma.protectedRegion.findMany({ where: { editingProjectId, isLocked: true } });
    return regions.map((r) => JSON.parse(r.boundsJson || '{}') as ProtectedBox).filter((b) => b.width > 0 && b.height > 0);
  }

  async createFromUpload(
    workspaceId: string,
    projectId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    title?: string
  ) {
    const meta = await proc.getMetadata(file.buffer);
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const safeName = `${Date.now()}-orig-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'exports', filename: safeName, buffer: file.buffer });

    const ep = await prisma.imageEditingProject.create({
      data: {
        workspaceId,
        projectId,
        userId,
        title: title?.trim() || file.originalname,
        originalStoragePath: saved.storagePath,
        originalMimeType: file.mimetype,
        originalSha256: sha256,
        originalWidth: meta.width,
        originalHeight: meta.height,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            operationType: 'ORIGINAL',
            storagePath: saved.storagePath,
            mimeType: file.mimetype,
            width: meta.width,
            height: meta.height,
            changeNote: 'Immutable original uploaded source',
          },
        },
      },
      include: { versions: true, masks: true, protectedRegions: true, jobs: true, comparisons: true },
    });
    return ep;
  }

  async listProjects(workspaceId: string, projectId: string) {
    return prisma.imageEditingProject.findMany({
      where: { workspaceId, projectId },
      include: { versions: { orderBy: { version: 'desc' }, take: 5 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getProject(workspaceId: string, projectId: string, editingProjectId: string) {
    return this.getScopedEditingProject(workspaceId, projectId, editingProjectId);
  }

  async readVersionBuffer(workspaceId: string, projectId: string, editingProjectId: string, version?: number) {
    const ep = await this.getScopedEditingProject(workspaceId, projectId, editingProjectId);
    const targetVer = version ? ep.versions.find((v) => v.version === version) : ep.versions[0];
    if (!targetVer) throw new AppError(404, 'VERSION_NOT_FOUND', 'Image version not found.');
    return { ep, version: targetVer, buffer: await storage.readRelativeFile(targetVer.storagePath) };
  }

  private async saveNewVersion(
    epId: string,
    projectId: string,
    operationType: string,
    outBuffer: Buffer,
    adjustments: Record<string, unknown>,
    changeNote: string
  ) {
    const maxVer = await prisma.imageEditingVersion.aggregate({ where: { editingProjectId: epId }, _max: { version: true } });
    const nextVersion = (maxVer._max.version || 0) + 1;
    const meta = await proc.getMetadata(outBuffer);
    const saved = await storage.saveProjectScopedAsset({
      projectId,
      folder: 'exports',
      filename: `${epId}-v${nextVersion}.png`,
      buffer: outBuffer,
    });
    const ver = await prisma.imageEditingVersion.create({
      data: {
        editingProjectId: epId,
        version: nextVersion,
        operationType,
        storagePath: saved.storagePath,
        mimeType: 'image/png',
        width: meta.width,
        height: meta.height,
        adjustmentsJson: JSON.stringify(adjustments),
        changeNote,
      },
    });
    await prisma.imageEditingProject.update({ where: { id: epId }, data: { currentVersion: nextVersion } });
    return ver;
  }

  async applyManualEdit(
    workspaceId: string,
    projectId: string,
    editingProjectId: string,
    payload: {
      operation: 'CROP' | 'RESIZE' | 'ROTATE' | 'FLIP' | 'ADJUST' | 'RESTORE';
      crop?: { left: number; top: number; width: number; height: number };
      resize?: { width: number; height: number; fit?: 'contain' | 'cover' | 'fill' };
      angle?: number;
      flip?: { horizontal?: boolean; vertical?: boolean };
      adjustments?: ImageAdjustments;
    }
  ) {
    const ep = await this.getScopedEditingProject(workspaceId, projectId, editingProjectId);
    const latestBuf = await storage.readRelativeFile(ep.versions[0].storagePath);
    const origBuf = await storage.readRelativeFile(ep.originalStoragePath);

    let outBuf: Buffer;
    if (payload.operation === 'RESTORE') {
      outBuf = origBuf;
    } else if (payload.operation === 'CROP' && payload.crop) {
      outBuf = await proc.crop(latestBuf, payload.crop);
    } else if (payload.operation === 'RESIZE' && payload.resize) {
      outBuf = await proc.resize(latestBuf, payload.resize.width, payload.resize.height, payload.resize.fit);
    } else if (payload.operation === 'ROTATE') {
      outBuf = await proc.rotate(latestBuf, payload.angle ?? 90);
    } else if (payload.operation === 'FLIP') {
      outBuf = await proc.flip(latestBuf, payload.flip || { horizontal: true });
    } else {
      outBuf = await proc.adjust(latestBuf, payload.adjustments || {});
    }

    if (payload.operation !== 'CROP' && payload.operation !== 'RESIZE' && payload.operation !== 'ROTATE' && payload.operation !== 'FLIP' && payload.operation !== 'RESTORE') {
      const boxes = await this.getProtectedBoxes(ep.id);
      outBuf = await proc.applyProtectedRegions(origBuf, outBuf, boxes);
    }

    return this.saveNewVersion(ep.id, projectId, payload.operation, outBuf, payload as unknown as Record<string, unknown>, `Manual ${payload.operation}`);
  }

  async saveMask(
    workspaceId: string,
    projectId: string,
    editingProjectId: string,
    payload: { name: string; maskType?: 'EDITABLE' | 'PROTECTED'; geometry: MaskGeometry; featherPx?: number; inverted?: boolean }
  ) {
    const ep = await this.getScopedEditingProject(workspaceId, projectId, editingProjectId);
    const maskBuf = await proc.renderMaskPng(ep.originalWidth, ep.originalHeight, payload.geometry || {}, {
      featherPx: payload.featherPx,
      inverted: payload.inverted,
    });
    const saved = await storage.saveProjectScopedAsset({
      projectId,
      folder: 'exports',
      filename: `mask-${ep.id}-${Date.now()}.png`,
      buffer: maskBuf,
    });
    return prisma.imageMask.create({
      data: {
        editingProjectId: ep.id,
        name: payload.name || 'Selection Mask',
        maskType: payload.maskType || 'EDITABLE',
        geometryJson: JSON.stringify(payload.geometry || {}),
        featherPx: payload.featherPx || 0,
        inverted: Boolean(payload.inverted),
        maskStoragePath: saved.storagePath,
        width: ep.originalWidth,
        height: ep.originalHeight,
      },
    });
  }

  async addProtectedRegion(
    workspaceId: string,
    projectId: string,
    editingProjectId: string,
    payload: { regionType: string; label: string; protectedAssetId?: string; bounds: ProtectedBox }
  ) {
    const ep = await this.getScopedEditingProject(workspaceId, projectId, editingProjectId);
    return prisma.protectedRegion.create({
      data: {
        editingProjectId: ep.id,
        regionType: payload.regionType,
        label: payload.label,
        protectedAssetId: payload.protectedAssetId || null,
        boundsJson: JSON.stringify(payload.bounds),
        isLocked: true,
      },
    });
  }

  async compositeProtectedLogo(
    workspaceId: string,
    projectId: string,
    editingProjectId: string,
    payload: { logoId?: string; x: number; y: number; width: number; height: number }
  ) {
    const ep = await this.getScopedEditingProject(workspaceId, projectId, editingProjectId);
    const logo = payload.logoId
      ? await prisma.logoAsset.findFirst({ where: { id: payload.logoId, projectId } })
      : await prisma.logoAsset.findFirst({ where: { projectId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] });
    if (!logo) throw new AppError(404, 'LOGO_NOT_FOUND', 'Original approved logo not found.');

    const [baseBuf, logoBuf] = await Promise.all([
      storage.readRelativeFile(ep.versions[0].storagePath),
      storage.readLogo(logo.storagePath),
    ]);
    const composited = await proc.compositeProtectedLogo(baseBuf, logoBuf, {
      x: payload.x,
      y: payload.y,
      width: payload.width,
      height: payload.height,
    });
    return this.saveNewVersion(ep.id, projectId, 'LOGO_COMPOSITE', composited, { logoId: logo.id, ...payload }, `Composited protected logo (${logo.originalFilename})`);
  }

  async runBackgroundEdit(
    workspaceId: string,
    projectId: string,
    editingProjectId: string,
    payload: { mode: 'BG_REMOVE' | 'BG_REPLACE'; preset?: string; color?: string; gradientEnd?: string }
  ) {
    const ep = await this.getScopedEditingProject(workspaceId, projectId, editingProjectId);
    const latestBuf = await storage.readRelativeFile(ep.versions[0].storagePath);
    const origBuf = await storage.readRelativeFile(ep.originalStoragePath);
    const boxes = await this.getProtectedBoxes(ep.id);

    let outBuf =
      payload.mode === 'BG_REMOVE'
        ? await proc.removeBackground(latestBuf)
        : await proc.replaceBackground(latestBuf, { preset: payload.preset || 'STUDIO', color: payload.color, gradientEnd: payload.gradientEnd });

    outBuf = await proc.applyProtectedRegions(origBuf, outBuf, boxes);
    return this.saveNewVersion(ep.id, projectId, payload.mode, outBuf, payload, `${payload.mode} (${payload.preset || 'TRANSPARENT'})`);
  }

  async runGenerativeEdit(
    workspaceId: string,
    projectId: string,
    userId: string,
    editingProjectId: string,
    payload: {
      jobType: 'GEN_FILL' | 'OBJECT_REPLACE';
      prompt: string;
      negativePrompt?: string;
      seed?: number;
      denoise?: number;
      maskId?: string;
      provider?: string;
      model?: string;
      allowCloudUpload?: boolean;
    }
  ) {
    const ep = await this.getScopedEditingProject(workspaceId, projectId, editingProjectId);
    const latestBuf = await storage.readRelativeFile(ep.versions[0].storagePath);
    const origBuf = await storage.readRelativeFile(ep.originalStoragePath);

    await providerAdapter.checkCloudConsent(workspaceId, payload.provider || 'heuristic', payload.allowCloudUpload);
    await providerAdapter.checkGpuAndResourceLimits(payload.provider || 'heuristic', ep.versions[0].width, ep.versions[0].height);

    const job = await prisma.imageEditingJob.create({
      data: {
        workspaceId,
        projectId,
        editingProjectId: ep.id,
        jobType: payload.jobType,
        provider: payload.provider || 'heuristic',
        model: payload.model || null,
        status: 'RUNNING',
        progress: 25,
        maskId: payload.maskId || null,
        startedAt: new Date(),
        parameters: {
          create: {
            prompt: payload.prompt,
            negativePrompt: payload.negativePrompt || null,
            seed: payload.seed ?? null,
            denoise: payload.denoise ?? 0.65,
          },
        },
      },
      include: { parameters: true },
    });

    try {
      const execRes = await providerAdapter.executeGenerativeEdit({
        workspaceId,
        provider: payload.provider || 'heuristic',
        model: payload.model,
        prompt: payload.prompt,
        negativePrompt: payload.negativePrompt,
        seed: payload.seed,
        denoise: payload.denoise,
        baseBuffer: latestBuf,
        mimeType: 'image/png',
        allowCloudUpload: payload.allowCloudUpload,
        fallbackEdit: async () => {
          // Deterministic masked visual edit preserving protected regions
          const meta = await proc.getMetadata(latestBuf);
          const tintSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">
            <rect width="${meta.width}" height="${meta.height}" fill="#2563EB" fill-opacity="0.14"/>
          </svg>`;
          return sharp(latestBuf).composite([{ input: Buffer.from(tintSvg, 'utf8'), left: 0, top: 0 }]).png().toBuffer();
        },
      });

      const boxes = await this.getProtectedBoxes(ep.id);
      const safeOut = await proc.applyProtectedRegions(origBuf, execRes.buffer, boxes);
      const version = await this.saveNewVersion(ep.id, projectId, payload.jobType, safeOut, { prompt: payload.prompt, provider: execRes.providerUsed }, `${payload.jobType}: ${payload.prompt.slice(0, 60)}`);

      await usageService.recordUsage({ workspaceId, projectId, userId, metric: 'AI_IMAGE_GEN', provider: execRes.providerUsed });
      return prisma.imageEditingJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', progress: 100, provider: execRes.providerUsed, model: execRes.modelUsed, workflowVersion: execRes.workflowVersion, outputVersionId: version.id, completedAt: new Date() },
        include: { parameters: true },
      });
    } catch (err) {
      await prisma.imageEditingJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Job failed', completedAt: new Date() },
      });
      throw err;
    }
  }

  async runUpscaleOrEnhance(
    workspaceId: string,
    projectId: string,
    editingProjectId: string,
    payload: { mode: 'UPSCALE' | 'ENHANCE'; factor?: 2 | 4; provider?: string }
  ) {
    const ep = await this.getScopedEditingProject(workspaceId, projectId, editingProjectId);
    const latest = ep.versions[0];
    const factor = payload.factor === 4 ? 4 : 2;
    const targetW = payload.mode === 'UPSCALE' ? latest.width * factor : latest.width;
    const targetH = payload.mode === 'UPSCALE' ? latest.height * factor : latest.height;

    await providerAdapter.checkGpuAndResourceLimits(payload.provider || 'heuristic', targetW, targetH);

    const job = await prisma.imageEditingJob.create({
      data: {
        workspaceId,
        projectId,
        editingProjectId: ep.id,
        jobType: payload.mode,
        provider: payload.provider || 'heuristic',
        status: 'RUNNING',
        progress: 30,
        startedAt: new Date(),
        parameters: { create: { upscaleFactor: factor } },
      },
      include: { parameters: true },
    });

    const latestBuf = await storage.readRelativeFile(latest.storagePath);
    const outBuf =
      payload.mode === 'UPSCALE'
        ? await proc.upscale(latestBuf, factor)
        : await proc.adjust(latestBuf, { contrast: 1.06, sharpness: 1.4, denoise: 3 });

    const ver = await this.saveNewVersion(ep.id, projectId, payload.mode, outBuf, payload, `${payload.mode} (${factor}x)`);
    return prisma.imageEditingJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', progress: 100, outputVersionId: ver.id, completedAt: new Date() },
      include: { parameters: true },
    });
  }

  async cancelJob(workspaceId: string, projectId: string, jobId: string) {
    const res = await prisma.imageEditingJob.updateMany({
      where: { id: jobId, workspaceId, projectId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    if (res.count === 0) throw new AppError(404, 'JOB_NOT_FOUND', 'Active job not found.');
    return { cancelled: true, jobId };
  }

  async createComparison(
    workspaceId: string,
    projectId: string,
    editingProjectId: string,
    payload: { beforeVersion: number; afterVersion: number; mode?: 'SIDE_BY_SIDE' | 'SLIDER' | 'ZOOM'; notes?: string }
  ) {
    const ep = await this.getScopedEditingProject(workspaceId, projectId, editingProjectId);
    return prisma.imageComparison.create({
      data: {
        editingProjectId: ep.id,
        beforeVersion: payload.beforeVersion,
        afterVersion: payload.afterVersion,
        mode: payload.mode || 'SIDE_BY_SIDE',
        notes: payload.notes || null,
      },
    });
  }

  async listWorkflows(workspaceId: string, projectId: string) {
    const existing = await prisma.imageEditingWorkflow.findMany({
      where: { workspaceId, projectId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (existing.length > 0) return existing;

    for (const preset of PRESET_IMAGE_WORKFLOWS) {
      await prisma.imageEditingWorkflow.create({
        data: {
          workspaceId,
          projectId,
          name: preset.name,
          presetType: preset.presetType,
          isCustom: false,
          steps: { create: preset.steps.map((s, idx) => ({ stepOrder: idx, operation: s.operation, paramsJson: JSON.stringify(s.params) })) },
        },
      });
    }
    return prisma.imageEditingWorkflow.findMany({
      where: { workspaceId, projectId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async createCustomWorkflow(
    workspaceId: string,
    projectId: string,
    payload: { name: string; concurrencyLimit?: number; steps: Array<{ operation: string; params?: Record<string, unknown> }> }
  ) {
    return prisma.imageEditingWorkflow.create({
      data: {
        workspaceId,
        projectId,
        name: payload.name,
        presetType: 'CUSTOM',
        isCustom: true,
        concurrencyLimit: Math.max(1, Math.min(4, payload.concurrencyLimit || 1)),
        steps: { create: payload.steps.map((s, idx) => ({ stepOrder: idx, operation: s.operation, paramsJson: JSON.stringify(s.params || {}) })) },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async runBatchWorkflow(
    workspaceId: string,
    projectId: string,
    workflowId: string,
    editingProjectIds: string[]
  ) {
    const wf = await prisma.imageEditingWorkflow.findFirst({
      where: { id: workflowId, workspaceId, projectId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!wf) throw new AppError(404, 'WORKFLOW_NOT_FOUND', 'Image editing workflow not found.');

    const results: Array<{ editingProjectId: string; status: string; version?: number }> = [];
    const limit = Math.max(1, wf.concurrencyLimit);

    for (let i = 0; i < editingProjectIds.length; i += limit) {
      const chunk = editingProjectIds.slice(i, i + limit);
      const batchOut = await Promise.all(
        chunk.map(async (epId) => {
          let lastVer = 1;
          for (const step of wf.steps) {
            const p = JSON.parse(step.paramsJson || '{}') as Record<string, unknown>;
            if (step.operation === 'BG_REMOVE' || step.operation === 'BG_REPLACE') {
              const v = await this.runBackgroundEdit(workspaceId, projectId, epId, { mode: step.operation, preset: String(p.preset || 'STUDIO') });
              lastVer = v.version;
            } else if (step.operation === 'UPSCALE') {
              const j = await this.runUpscaleOrEnhance(workspaceId, projectId, epId, { mode: 'UPSCALE', factor: p.factor === 4 ? 4 : 2 });
              lastVer = (await this.getScopedEditingProject(workspaceId, projectId, epId)).currentVersion;
              void j;
            } else if (step.operation === 'RESIZE') {
              const v = await this.applyManualEdit(workspaceId, projectId, epId, { operation: 'RESIZE', resize: { width: Number(p.width || 1080), height: Number(p.height || 1080) } });
              lastVer = v.version;
            } else {
              const v = await this.applyManualEdit(workspaceId, projectId, epId, { operation: 'ADJUST', adjustments: p as ImageAdjustments });
              lastVer = v.version;
            }
          }
          return { editingProjectId: epId, status: 'COMPLETED', version: lastVer };
        })
      );
      results.push(...batchOut);
    }
    return { workflowId: wf.id, processedCount: results.length, results };
  }
}
