import { Router, type Request } from 'express';
import { prisma } from '../../db/client';
import { BatchGenerationService } from './batch.service';
import { CommercialExportService } from './commercialExport.service';
import { QualityConsistencyService } from './qualityConsistency.service';
import { WorkflowAutomationService } from './workflow.service';

const workflowService = new WorkflowAutomationService();
const batchService = new BatchGenerationService();
const qcService = new QualityConsistencyService();
const commercialExport = new CommercialExportService();
const p = (req: Request, key: string) => String((req.params as Record<string, string | string[]>)[key] || '');

export const automationRouter = Router({ mergeParams: true });

// Workflows
automationRouter.get('/workflows', async (req, res, next) => { try { res.json({ data: await workflowService.listWorkflows(p(req, 'id')) }); } catch (e) { next(e); } });
automationRouter.post('/workflows', async (req, res, next) => { try { res.status(201).json({ data: await workflowService.createWorkflow(p(req, 'id'), req.body) }); } catch (e) { next(e); } });
automationRouter.post('/workflows/:workflowId/start', async (req, res, next) => { try { res.json({ data: await workflowService.runWorkflow(p(req, 'workflowId')) }); } catch (e) { next(e); } });
automationRouter.post('/workflows/:workflowId/pause', async (req, res, next) => { try { res.json({ data: await workflowService.pauseWorkflow(p(req, 'workflowId')) }); } catch (e) { next(e); } });
automationRouter.post('/workflows/:workflowId/resume', async (req, res, next) => { try { res.json({ data: await workflowService.runWorkflow(p(req, 'workflowId')) }); } catch (e) { next(e); } });
automationRouter.post('/workflows/:workflowId/cancel', async (req, res, next) => { try { res.json({ data: await workflowService.cancelWorkflow(p(req, 'workflowId')) }); } catch (e) { next(e); } });
automationRouter.post('/workflows/:workflowId/steps/:stepKey/retry', async (req, res, next) => { try { res.json({ data: await workflowService.retryStep(p(req, 'workflowId'), p(req, 'stepKey')) }); } catch (e) { next(e); } });
automationRouter.post('/workflows/:workflowId/steps/:stepKey/skip', async (req, res, next) => { try { res.json({ data: await workflowService.skipStep(p(req, 'workflowId'), p(req, 'stepKey')) }); } catch (e) { next(e); } });
automationRouter.post('/workflows/:workflowId/restart/:stepOrder', async (req, res, next) => { try { res.json({ data: await workflowService.restartFromStep(p(req, 'workflowId'), Number(p(req, 'stepOrder'))) }); } catch (e) { next(e); } });
automationRouter.post('/workflows/:workflowId/approvals/:approvalId', async (req, res, next) => { try { res.json({ data: await workflowService.decideCheckpoint(p(req, 'workflowId'), p(req, 'approvalId'), req.body.decision, req.body.comment) }); } catch (e) { next(e); } });

// Batch Generation
automationRouter.get('/batch-jobs', async (req, res, next) => { try { res.json({ data: await batchService.listBatchJobs(p(req, 'id')) }); } catch (e) { next(e); } });
automationRouter.post('/batch-jobs', async (req, res, next) => { try { res.status(201).json({ data: await batchService.createAndRunBatch(p(req, 'id'), req.body) }); } catch (e) { next(e); } });

// Quality & Consistency Reports
automationRouter.get('/quality-reports', async (req, res, next) => { try { res.json({ data: await prisma.qualityReport.findMany({ where: { projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) }); } catch (e) { next(e); } });
automationRouter.post('/quality-reports/run', async (req, res, next) => { try { res.status(201).json({ data: await qcService.runQualityChecks(p(req, 'id')) }); } catch (e) { next(e); } });
automationRouter.get('/consistency-reports', async (req, res, next) => { try { res.json({ data: await prisma.consistencyReport.findMany({ where: { projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) }); } catch (e) { next(e); } });
automationRouter.post('/consistency-reports/run', async (req, res, next) => { try { res.status(201).json({ data: await qcService.runConsistencyCheck(p(req, 'id')) }); } catch (e) { next(e); } });

// Asset Approvals & Locking
automationRouter.get('/approvals', async (req, res, next) => { try { res.json({ data: await prisma.assetApproval.findMany({ where: { projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) }); } catch (e) { next(e); } });
automationRouter.post('/approvals', async (req, res, next) => {
  try {
    const projectId = p(req, 'id');
    const approval = await prisma.assetApproval.create({ data: { projectId, targetType: req.body.targetType, targetId: req.body.targetId, version: req.body.version || 1, status: req.body.status, isLocked: req.body.status === 'APPROVED', comment: req.body.comment || null } });
    if (req.body.targetType === 'BRAND_ASSET') {
      await prisma.brandAsset.updateMany({ where: { id: req.body.targetId, projectId }, data: { isApproved: req.body.status === 'APPROVED', isLocked: req.body.status === 'APPROVED' } });
    }
    res.status(201).json({ data: approval });
  } catch (e) { next(e); }
});

// Commercial Export Packages
automationRouter.get('/export-packages', async (req, res, next) => { try { res.json({ data: await commercialExport.listPackages(p(req, 'id')) }); } catch (e) { next(e); } });
automationRouter.post('/export-packages', async (req, res, next) => { try { res.status(201).json({ data: await commercialExport.buildCommercialPackage(p(req, 'id')) }); } catch (e) { next(e); } });
automationRouter.get('/export-packages/:packageId/download', async (req, res, next) => {
  try { const { pkg, buffer } = await commercialExport.downloadPackage(p(req, 'id'), p(req, 'packageId')); res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Disposition', `attachment; filename="${pkg.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.zip"`); res.send(buffer); } catch (e) { next(e); }
});
