import { Router } from 'express';
import { attachAuthContext, requirePermission } from '../../middleware/tenantContext';
import { ClientPortalService } from './portal.service';

const portalService = new ClientPortalService();
export const portalRouter = Router();

portalRouter.use(attachAuthContext);

portalRouter.post('/access', requirePermission('clients:manage'), async (req, res, next) => {
  try { res.status(201).json({ data: await portalService.grantAccess(req.auth!.workspaceId, req.auth!.userId, req.body) }); } catch (e) { next(e); }
});

portalRouter.get('/projects', async (req, res, next) => {
  try { res.json({ data: await portalService.listSharedProjectsForClient(req.auth!.workspaceId, req.auth!.userId) }); } catch (e) { next(e); }
});

portalRouter.get('/projects/:projectId', async (req, res, next) => {
  try {
    const isStaff = req.auth!.workspaceRole !== 'CLIENT';
    res.json({ data: await portalService.getPortalProjectView(req.auth!.workspaceId, req.auth!.userId, String(req.params.projectId), isStaff) });
  } catch (e) { next(e); }
});

portalRouter.post('/projects/:projectId/decisions', async (req, res, next) => {
  try {
    const isStaff = req.auth!.workspaceRole !== 'CLIENT';
    res.status(201).json({ data: await portalService.submitClientDecision(req.auth!.workspaceId, req.auth!.userId, String(req.params.projectId), req.body, isStaff) });
  } catch (e) { next(e); }
});
