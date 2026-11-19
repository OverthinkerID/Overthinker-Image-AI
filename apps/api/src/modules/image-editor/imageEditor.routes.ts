import { Router, type Request } from 'express';
import multer from 'multer';
import { ImageEditorService } from './imageEditor.service';
import { ImageEditorProviderAdapter } from './imageEditorProvider.adapter';
import { ImageProcessingService } from './imageProcessing.service';

const service = new ImageEditorService();
const adapter = new ImageEditorProviderAdapter();
const proc = new ImageProcessingService();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const p = (req: Request, key: string) => String((req.params as Record<string, string | string[]>)[key] || '');

export const imageEditorRouter = Router({ mergeParams: true });

imageEditorRouter.get('/capabilities', (_req, res) => {
  res.json({ data: adapter.listCapabilities() });
});

imageEditorRouter.get('/projects', async (req, res, next) => {
  try { res.json({ data: await service.listProjects(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/projects/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: { message: 'Image file is required under field "file".' } });
    res.status(201).json({ data: await service.createFromUpload(req.auth!.workspaceId, p(req, 'id'), req.auth!.userId, req.file, req.body?.title) });
  } catch (e) { next(e); }
});

imageEditorRouter.get('/projects/:editingProjectId', async (req, res, next) => {
  try { res.json({ data: await service.getProject(req.auth!.workspaceId, p(req, 'id'), p(req, 'editingProjectId')) }); } catch (e) { next(e); }
});

imageEditorRouter.get('/projects/:editingProjectId/versions/:version/file', async (req, res, next) => {
  try {
    const { version, buffer } = await service.readVersionBuffer(req.auth!.workspaceId, p(req, 'id'), p(req, 'editingProjectId'), Number(p(req, 'version')));
    res.setHeader('Content-Type', version.mimeType);
    res.send(buffer);
  } catch (e) { next(e); }
});

imageEditorRouter.post('/projects/:editingProjectId/manual-edit', async (req, res, next) => {
  try { res.status(201).json({ data: await service.applyManualEdit(req.auth!.workspaceId, p(req, 'id'), p(req, 'editingProjectId'), req.body) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/projects/:editingProjectId/masks', async (req, res, next) => {
  try { res.status(201).json({ data: await service.saveMask(req.auth!.workspaceId, p(req, 'id'), p(req, 'editingProjectId'), req.body) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/projects/:editingProjectId/protected-regions', async (req, res, next) => {
  try { res.status(201).json({ data: await service.addProtectedRegion(req.auth!.workspaceId, p(req, 'id'), p(req, 'editingProjectId'), req.body) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/projects/:editingProjectId/composite-logo', async (req, res, next) => {
  try { res.status(201).json({ data: await service.compositeProtectedLogo(req.auth!.workspaceId, p(req, 'id'), p(req, 'editingProjectId'), req.body) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/projects/:editingProjectId/background', async (req, res, next) => {
  try { res.status(201).json({ data: await service.runBackgroundEdit(req.auth!.workspaceId, p(req, 'id'), p(req, 'editingProjectId'), req.body) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/projects/:editingProjectId/generative-edit', async (req, res, next) => {
  try { res.status(201).json({ data: await service.runGenerativeEdit(req.auth!.workspaceId, p(req, 'id'), req.auth!.userId, p(req, 'editingProjectId'), req.body) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/projects/:editingProjectId/enhance', async (req, res, next) => {
  try { res.status(201).json({ data: await service.runUpscaleOrEnhance(req.auth!.workspaceId, p(req, 'id'), p(req, 'editingProjectId'), req.body) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/jobs/:jobId/cancel', async (req, res, next) => {
  try { res.json({ data: await service.cancelJob(req.auth!.workspaceId, p(req, 'id'), p(req, 'jobId')) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/projects/:editingProjectId/comparisons', async (req, res, next) => {
  try { res.status(201).json({ data: await service.createComparison(req.auth!.workspaceId, p(req, 'id'), p(req, 'editingProjectId'), req.body) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/projects/:editingProjectId/export', async (req, res, next) => {
  try {
    const { buffer } = await service.readVersionBuffer(req.auth!.workspaceId, p(req, 'id'), p(req, 'editingProjectId'), req.body?.version ? Number(req.body.version) : undefined);
    const fmt = (['PNG', 'JPG', 'WEBP'].includes(String(req.body?.format)) ? req.body.format : 'PNG') as 'PNG' | 'JPG' | 'WEBP';
    const out = await proc.exportImage(buffer, fmt);
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="edited-image.${out.ext}"`);
    res.send(out.buffer);
  } catch (e) { next(e); }
});

imageEditorRouter.get('/workflows', async (req, res, next) => {
  try { res.json({ data: await service.listWorkflows(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/workflows', async (req, res, next) => {
  try { res.status(201).json({ data: await service.createCustomWorkflow(req.auth!.workspaceId, p(req, 'id'), req.body) }); } catch (e) { next(e); }
});

imageEditorRouter.post('/workflows/:workflowId/batch', async (req, res, next) => {
  try { res.json({ data: await service.runBatchWorkflow(req.auth!.workspaceId, p(req, 'id'), p(req, 'workflowId'), req.body?.editingProjectIds || []) }); } catch (e) { next(e); }
});
