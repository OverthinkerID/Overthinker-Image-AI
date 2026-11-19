import { Router } from 'express';
import { attachAuthContext } from '../../middleware/tenantContext';
import { CollaborationService } from './collaboration.service';

const collab = new CollaborationService();
export const collaborationRouter = Router();

collaborationRouter.use(attachAuthContext);

collaborationRouter.get('/projects/:projectId/comments', async (req, res, next) => {
  try { res.json({ data: await collab.listProjectComments(req, String(req.params.projectId)) }); } catch (e) { next(e); }
});

collaborationRouter.post('/projects/:projectId/comments', async (req, res, next) => {
  try { res.status(201).json({ data: await collab.addProjectComment(req, String(req.params.projectId), req.body) }); } catch (e) { next(e); }
});

collaborationRouter.get('/projects/:projectId/assets/:assetId/comments', async (req, res, next) => {
  try { res.json({ data: await collab.listAssetComments(req, String(req.params.projectId), String(req.params.assetId)) }); } catch (e) { next(e); }
});

collaborationRouter.post('/projects/:projectId/assets/:assetId/comments', async (req, res, next) => {
  try { res.status(201).json({ data: await collab.addAssetComment(req, String(req.params.projectId), { ...req.body, assetId: String(req.params.assetId) }) }); } catch (e) { next(e); }
});

collaborationRouter.get('/notifications', async (req, res, next) => {
  try { res.json({ data: await collab.listNotifications(req.auth!.userId) }); } catch (e) { next(e); }
});

collaborationRouter.post('/notifications/:notificationId/read', async (req, res, next) => {
  try { res.json({ data: await collab.markNotificationRead(req.auth!.userId, String(req.params.notificationId)) }); } catch (e) { next(e); }
});
