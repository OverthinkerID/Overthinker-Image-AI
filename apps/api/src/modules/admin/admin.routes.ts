import { Router } from 'express';
import { attachAuthContext, requirePlatformAdmin } from '../../middleware/tenantContext';
import { BillingService } from '../billing/billing.service';
import { AdminService } from './admin.service';

const adminService = new AdminService();
const billingService = new BillingService();
export const adminRouter = Router();

adminRouter.use(attachAuthContext, requirePlatformAdmin);

adminRouter.get('/overview', async (_req, res, next) => {
  try { res.json({ data: await adminService.getPlatformOverview() }); } catch (e) { next(e); }
});

adminRouter.get('/users', async (_req, res, next) => {
  try { res.json({ data: await adminService.listUsers() }); } catch (e) { next(e); }
});

adminRouter.get('/workspaces', async (_req, res, next) => {
  try { res.json({ data: await adminService.listWorkspaces() }); } catch (e) { next(e); }
});

adminRouter.get('/audit-logs', async (req, res, next) => {
  try { res.json({ data: await adminService.listAuditLogs(req.auth!.userId) }); } catch (e) { next(e); }
});

adminRouter.post('/plans', async (req, res, next) => {
  try { res.status(201).json({ data: await billingService.upsertPlan(req.body) }); } catch (e) { next(e); }
});
