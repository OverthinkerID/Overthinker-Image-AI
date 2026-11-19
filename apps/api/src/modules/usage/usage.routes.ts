import { Router } from 'express';
import { attachAuthContext, requirePermission } from '../../middleware/tenantContext';
import { UsageService } from './usage.service';

const usageService = new UsageService();
export const usageRouter = Router();

usageRouter.use(attachAuthContext);

usageRouter.get('/summary', requirePermission('projects:view'), async (req, res, next) => {
  try { res.json({ data: await usageService.getWorkspaceUsageSummary(req.auth!.workspaceId) }); } catch (e) { next(e); }
});

usageRouter.get('/history', requirePermission('projects:view'), async (req, res, next) => {
  try { res.json({ data: await usageService.getUsageHistory(req.auth!.workspaceId) }); } catch (e) { next(e); }
});
