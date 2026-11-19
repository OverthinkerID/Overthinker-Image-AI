import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { env } from './config/appConfig';
import { errorHandler } from './middleware/errorHandler';
import { assertProjectTenantAccess, attachAuthContext } from './middleware/tenantContext';
import { adminRouter } from './modules/admin/admin.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { authRouter } from './modules/auth/auth.routes';
import { automationRouter } from './modules/automation/automation.routes';
import { billingRouter } from './modules/billing/billing.routes';
import { brandDnaRouter } from './modules/brand-dna/brandDna.routes';
import { clientsRouter } from './modules/clients/clients.routes';
import { collaborationRouter } from './modules/collaboration/collaboration.routes';
import { conceptAssetsRouter, projectConceptsRouter } from './modules/concepts/concepts.routes';
import { creativeDirectorRouter } from './modules/creative-director/creativeDirector.routes';
import { designEngineRouter } from './modules/design-engine/designEngine.routes';
import { imageEditorRouter } from './modules/image-editor/imageEditor.routes';
import { healthRouter } from './modules/health/health.routes';
import { logosRouter, projectLogosRouter } from './modules/logos/logos.routes';
import { marketingRouter } from './modules/marketing/marketing.routes';
import { phase5Router } from './modules/mockups/phase5.routes';
import { portalRouter } from './modules/portal/portal.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { diagnosticsRouter } from './modules/diagnostics/diagnostics.routes';
import { strategyRouter } from './modules/strategy/strategy.routes';
import { videoRouter } from './modules/video/video.routes';
import { usageRouter } from './modules/usage/usage.routes';
import { workspaceRouter } from './modules/workspaces/workspace.routes';

function guardProjectScope(req: Request, _res: Response, next: NextFunction) {
  const projectId = String((req.params as Record<string, string | string[]>).id || (req.params as Record<string, string | string[]>).projectId || '');
  if (!projectId) {
    next();
    return;
  }
  const perm = req.method === 'GET' ? 'projects:view' : 'projects:edit';
  assertProjectTenantAccess(req, projectId, perm)
    .then(() => next())
    .catch(next);
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '5mb' }));

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/workspaces', workspaceRouter);
  app.use('/api/v1/clients', clientsRouter);
  app.use('/api/v1/portal', portalRouter);
  app.use('/api/v1/collaboration', collaborationRouter);
  app.use('/api/v1/billing', billingRouter);
  app.use('/api/v1/usage', usageRouter);
  app.use('/api/v1/admin', adminRouter);

  app.use('/api/v1/ai', attachAuthContext, aiRouter);
  app.use('/api/v1/projects', attachAuthContext, projectsRouter);
  app.use('/api/v1/projects/:id/logos', attachAuthContext, guardProjectScope, projectLogosRouter);
  app.use('/api/v1/projects/:id', attachAuthContext, guardProjectScope, brandDnaRouter);
  app.use('/api/v1/projects/:id', attachAuthContext, guardProjectScope, projectConceptsRouter);
  app.use('/api/v1/projects/:id', attachAuthContext, guardProjectScope, designEngineRouter);
  app.use('/api/v1/projects/:id', attachAuthContext, guardProjectScope, phase5Router);
  app.use('/api/v1/projects/:id', attachAuthContext, guardProjectScope, automationRouter);
  app.use('/api/v1/projects/:id/creative-director', attachAuthContext, guardProjectScope, creativeDirectorRouter);
  app.use('/api/v1/projects/:id/image-editor', attachAuthContext, guardProjectScope, imageEditorRouter);
  app.use('/api/v1/projects/:id/strategy', attachAuthContext, guardProjectScope, strategyRouter);
  app.use('/api/v1/projects/:id/marketing', attachAuthContext, guardProjectScope, marketingRouter);
  app.use('/api/v1/projects/:id/video', attachAuthContext, guardProjectScope, videoRouter);
  app.use('/api/v1/diagnostics', attachAuthContext, diagnosticsRouter);
  app.use('/api/v1/logos', attachAuthContext, logosRouter);
  app.use('/api/v1/concept-assets', attachAuthContext, conceptAssetsRouter);
  app.use(errorHandler);
  return app;
}
