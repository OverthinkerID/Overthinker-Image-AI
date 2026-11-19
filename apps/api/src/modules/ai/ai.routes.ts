import { Router } from 'express';
import { prisma } from '../../db/client';
import { ComfyUiService } from './comfyui.service';
import { AiProviderManager } from './provider.manager';

export const aiRouter = Router();
const providerManager = new AiProviderManager();
const comfyService = new ComfyUiService();

aiRouter.get('/providers', async (_req, res, next) => {
  try { res.json({ data: await providerManager.listProviders() }); } catch (err) { next(err); }
});
aiRouter.patch('/providers/:providerType', async (req, res, next) => {
  try { res.json({ data: await providerManager.updateProviderConfig(req.params.providerType, req.body || {}) }); } catch (err) { next(err); }
});
aiRouter.post('/providers/:providerType/test', async (req, res, next) => {
  try { res.json({ data: await providerManager.testConnection(req.params.providerType) }); } catch (err) { next(err); }
});
aiRouter.get('/workflows', async (_req, res, next) => {
  try { await comfyService.ensureDefaultWorkflows(); res.json({ data: await prisma.comfyWorkflowTemplate.findMany({ orderBy: { createdAt: 'asc' } }) }); } catch (err) { next(err); }
});
