import { Router } from 'express';
import { attachAuthContext, requirePermission } from '../../middleware/tenantContext';
import { BillingService } from './billing.service';

const billing = new BillingService();
export const billingRouter = Router();

billingRouter.get('/plans', async (_req, res, next) => {
  try { res.json({ data: await billing.listPlans() }); } catch (e) { next(e); }
});

billingRouter.post('/webhooks', async (req, res, next) => {
  try {
    const sig = String(req.headers['x-payment-signature'] || '');
    const raw = JSON.stringify(req.body || {});
    res.json({ data: await billing.processWebhook(raw, sig, req.body || {}) });
  } catch (e) { next(e); }
});

billingRouter.use(attachAuthContext);

billingRouter.get('/subscription', async (req, res, next) => {
  try { res.json({ data: await billing.getWorkspaceSubscription(req.auth!.workspaceId) }); } catch (e) { next(e); }
});

billingRouter.post('/subscription', requirePermission('billing:manage'), async (req, res, next) => {
  try { res.json({ data: await billing.assignOrChangePlan(req.auth!.workspaceId, req.body) }); } catch (e) { next(e); }
});

billingRouter.post('/subscription/cancel', requirePermission('billing:manage'), async (req, res, next) => {
  try { res.json({ data: await billing.cancelSubscription(req.auth!.workspaceId) }); } catch (e) { next(e); }
});

billingRouter.get('/entitlements/:resource', async (req, res, next) => {
  try {
    const resource = String(req.params.resource) as 'PROJECTS' | 'MEMBERS' | 'AI_IMAGE_GEN' | 'AI_TEXT_GEN' | 'EXPORTS';
    res.json({ data: await billing.checkEntitlement(req.auth!.workspaceId, resource) });
  } catch (e) { next(e); }
});
