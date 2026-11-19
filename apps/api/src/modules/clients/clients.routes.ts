import { Router } from 'express';
import { attachAuthContext, requirePermission } from '../../middleware/tenantContext';
import { ClientsService } from './clients.service';

const clientsService = new ClientsService();
export const clientsRouter = Router();

clientsRouter.use(attachAuthContext);

clientsRouter.get('/', requirePermission('projects:view'), async (req, res, next) => {
  try {
    res.json({
      data: await clientsService.listClients(req.auth!.workspaceId, {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        includeArchived: req.query.includeArchived === 'true',
      }),
    });
  } catch (e) { next(e); }
});

clientsRouter.post('/', requirePermission('clients:manage'), async (req, res, next) => {
  try { res.status(201).json({ data: await clientsService.createClient(req.auth!.workspaceId, req.auth!.userId, req.body || {}) }); } catch (e) { next(e); }
});

clientsRouter.get('/:clientId', requirePermission('projects:view'), async (req, res, next) => {
  try { res.json({ data: await clientsService.getClient(req.auth!.workspaceId, String(req.params.clientId)) }); } catch (e) { next(e); }
});

clientsRouter.patch('/:clientId', requirePermission('clients:manage'), async (req, res, next) => {
  try { res.json({ data: await clientsService.updateClient(req.auth!.workspaceId, String(req.params.clientId), req.auth!.userId, req.body || {}) }); } catch (e) { next(e); }
});

clientsRouter.post('/:clientId/projects', requirePermission('clients:manage'), async (req, res, next) => {
  try { res.status(201).json({ data: await clientsService.connectProject(req.auth!.workspaceId, String(req.params.clientId), req.auth!.userId, req.body) }); } catch (e) { next(e); }
});
