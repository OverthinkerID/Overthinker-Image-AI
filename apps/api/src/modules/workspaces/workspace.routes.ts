import { Router } from 'express';
import { prisma } from '../../db/client';
import { attachAuthContext, requirePermission } from '../../middleware/tenantContext';
import { WorkspaceService } from './workspace.service';

const wsService = new WorkspaceService();
export const workspaceRouter = Router();

workspaceRouter.use(attachAuthContext);

workspaceRouter.get('/', async (req, res, next) => {
  try { res.json({ data: await wsService.listUserWorkspaces(req.auth!.userId) }); } catch (e) { next(e); }
});

workspaceRouter.post('/', async (req, res, next) => {
  try { res.status(201).json({ data: await wsService.createWorkspace(req.auth!.userId, req.body) }); } catch (e) { next(e); }
});

workspaceRouter.post('/:workspaceId/switch', async (req, res, next) => {
  try { res.json({ data: await wsService.switchWorkspace(req.auth!.userId, req.auth!.sessionId, String(req.params.workspaceId)) }); } catch (e) { next(e); }
});

workspaceRouter.patch('/current', requirePermission('workspace:manage'), async (req, res, next) => {
  try { res.json({ data: await wsService.updateWorkspace(req.auth!.workspaceId, req.auth!.userId, req.body || {}) }); } catch (e) { next(e); }
});

workspaceRouter.patch('/current/settings', requirePermission('workspace:manage'), async (req, res, next) => {
  try { res.json({ data: await wsService.updateWorkspaceSettings(req.auth!.workspaceId, req.auth!.userId, req.body || {}) }); } catch (e) { next(e); }
});

workspaceRouter.delete('/current', requirePermission('workspace:delete'), async (req, res, next) => {
  try { res.json({ data: await wsService.deleteWorkspace(req.auth!.workspaceId, String(req.body?.confirmName || '')) }); } catch (e) { next(e); }
});

workspaceRouter.get('/current/activity', requirePermission('projects:view'), async (req, res, next) => {
  try {
    const logs = await prisma.activityLog.findMany({ where: { workspaceId: req.auth!.workspaceId }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ data: logs });
  } catch (e) { next(e); }
});

workspaceRouter.get('/current/members', requirePermission('projects:view'), async (req, res, next) => {
  try { res.json({ data: await wsService.listMembers(req.auth!.workspaceId) }); } catch (e) { next(e); }
});

workspaceRouter.get('/current/invitations', requirePermission('members:manage'), async (req, res, next) => {
  try {
    const invs = await prisma.workspaceInvitation.findMany({ where: { workspaceId: req.auth!.workspaceId }, orderBy: { createdAt: 'desc' } });
    res.json({ data: invs });
  } catch (e) { next(e); }
});

workspaceRouter.post('/current/invitations', requirePermission('members:manage'), async (req, res, next) => {
  try { res.status(201).json({ data: await wsService.inviteMember(req.auth!.workspaceId, req.auth!.userId, req.body) }); } catch (e) { next(e); }
});

workspaceRouter.post('/invitations/accept', async (req, res, next) => {
  try { res.json({ data: await wsService.acceptInvitation(String(req.body?.token || ''), req.auth!.userId, req.auth!.userEmail) }); } catch (e) { next(e); }
});

workspaceRouter.delete('/current/invitations/:invitationId', requirePermission('members:manage'), async (req, res, next) => {
  try { res.json({ data: await wsService.revokeInvitation(req.auth!.workspaceId, String(req.params.invitationId)) }); } catch (e) { next(e); }
});

workspaceRouter.patch('/current/members/:memberId/role', requirePermission('members:manage'), async (req, res, next) => {
  try { res.json({ data: await wsService.changeMemberRole(req.auth!.workspaceId, String(req.params.memberId), String(req.body?.role || 'DESIGNER')) }); } catch (e) { next(e); }
});

workspaceRouter.delete('/current/members/:memberId', requirePermission('members:manage'), async (req, res, next) => {
  try { res.json({ data: await wsService.removeMember(req.auth!.workspaceId, String(req.params.memberId)) }); } catch (e) { next(e); }
});
