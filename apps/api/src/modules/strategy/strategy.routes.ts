import { Router, type Request } from 'express';
import { prisma } from '../../db/client';
import { requirePermission } from '../../middleware/tenantContext';
import { WorkflowAutomationService } from '../automation/workflow.service';
import { BrandStrategyService } from './brandStrategy.service';
import { MarketResearchService } from './marketResearch.service';
import { StrategyAiAdapter } from './strategyAi.adapter';
import { StrategyWorkflowService } from './strategyWorkflow.service';

const research = new MarketResearchService();
const strategy = new BrandStrategyService();
const wfService = new StrategyWorkflowService();
const baseWf = new WorkflowAutomationService();
const aiAdapter = new StrategyAiAdapter();
const p = (req: Request, key: string) => String((req.params as Record<string, string | string[]>)[key] || '');

export const strategyRouter = Router({ mergeParams: true });

strategyRouter.get('/capabilities', (_req, res) => {
  res.json({
    data: {
      ai: aiAdapter.listCapabilities(),
      webResearch: aiAdapter.webResearch.getStatus(),
      domainCheck: aiAdapter.domainCheck.getStatus(),
    },
  });
});

// Market Research
strategyRouter.post('/market-research/projects', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await research.createResearchProject(req.auth!.workspaceId, p(req, 'id'), req.auth!.userId, req.body) }); } catch (e) { next(e); }
});
strategyRouter.get('/market-research/projects', async (req, res, next) => {
  try { res.json({ data: await research.listResearchProjects(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});
strategyRouter.get('/market-research/projects/:researchId', async (req, res, next) => {
  try { res.json({ data: await research.getResearchProject(req.auth!.workspaceId, p(req, 'id'), p(req, 'researchId')) }); } catch (e) { next(e); }
});
strategyRouter.post('/market-research/projects/:researchId/sources', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await research.addSource(req.auth!.workspaceId, p(req, 'id'), p(req, 'researchId'), req.body) }); } catch (e) { next(e); }
});
strategyRouter.post('/market-research/projects/:researchId/analyze', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await research.analyzeResearch(req.auth!.workspaceId, p(req, 'id'), p(req, 'researchId'), req.body || {}) }); } catch (e) { next(e); }
});

// Competitors
strategyRouter.post('/competitors', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await research.createCompetitor(req.auth!.workspaceId, p(req, 'id'), req.body || {}) }); } catch (e) { next(e); }
});
strategyRouter.get('/competitors', async (req, res, next) => {
  try { res.json({ data: await research.listCompetitors(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});
strategyRouter.patch('/competitors/:competitorId', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.json({ data: await research.updateCompetitor(req.auth!.workspaceId, p(req, 'id'), p(req, 'competitorId'), req.body || {}) }); } catch (e) { next(e); }
});
strategyRouter.delete('/competitors/:competitorId', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.json({ data: await research.deleteCompetitor(req.auth!.workspaceId, p(req, 'id'), p(req, 'competitorId')) }); } catch (e) { next(e); }
});
strategyRouter.post('/competitors/:competitorId/analyze', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await research.analyzeCompetitor(req.auth!.workspaceId, p(req, 'id'), p(req, 'competitorId')) }); } catch (e) { next(e); }
});
strategyRouter.post('/competitors/compare', async (req, res, next) => {
  try { res.status(201).json({ data: await research.compareCompetitors(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});

// Audience & Personas
strategyRouter.post('/audience/segments', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await research.createSegment(req.auth!.workspaceId, p(req, 'id'), req.body || {}) }); } catch (e) { next(e); }
});
strategyRouter.get('/audience/segments', async (req, res, next) => {
  try { res.json({ data: await research.listSegments(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});
strategyRouter.post('/audience/personas/generate', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await research.generatePersonas(req.auth!.workspaceId, p(req, 'id'), req.body || {}) }); } catch (e) { next(e); }
});
strategyRouter.get('/audience/personas', async (req, res, next) => {
  try { res.json({ data: await research.listPersonas(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});
strategyRouter.patch('/audience/personas/:personaId', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.json({ data: await research.updatePersona(req.auth!.workspaceId, p(req, 'id'), p(req, 'personaId'), req.body || {}) }); } catch (e) { next(e); }
});
strategyRouter.get('/audience/journeys', async (req, res, next) => {
  try { res.json({ data: await prisma.customerJourney.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) }); } catch (e) { next(e); }
});

// Brand Positioning
strategyRouter.post('/brand-positioning/generate', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await strategy.generatePositioning(req.auth!.workspaceId, p(req, 'id'), req.body || {}) }); } catch (e) { next(e); }
});
strategyRouter.get('/brand-positioning', async (req, res, next) => {
  try { res.json({ data: await strategy.listPositionings(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});
strategyRouter.patch('/brand-positioning/:positioningId', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.json({ data: await strategy.updatePositioning(req.auth!.workspaceId, p(req, 'id'), p(req, 'positioningId'), req.body || {}) }); } catch (e) { next(e); }
});
strategyRouter.post('/brand-positioning/:positioningId/approve', requirePermission('assets:approve'), async (req, res, next) => {
  try { res.json({ data: await strategy.approvePositioning(req.auth!.workspaceId, p(req, 'id'), p(req, 'positioningId')) }); } catch (e) { next(e); }
});

// Naming & Taglines
strategyRouter.post('/naming/generate', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await strategy.generateNames(req.auth!.workspaceId, p(req, 'id'), req.body || {}) }); } catch (e) { next(e); }
});
strategyRouter.get('/naming', async (req, res, next) => {
  try { res.json({ data: await prisma.brandNamingCandidate.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) }); } catch (e) { next(e); }
});
strategyRouter.post('/naming/:nameId/favorite', requirePermission('projects:edit'), async (req, res, next) => {
  try {
    const existing = await prisma.brandNamingCandidate.findFirst({ where: { id: p(req, 'nameId'), workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') } });
    if (!existing) return res.status(404).json({ error: { message: 'Naming candidate not found' } });
    res.json({ data: await prisma.brandNamingCandidate.update({ where: { id: existing.id }, data: { isFavorite: !existing.isFavorite } }) });
  } catch (e) { next(e); }
});
strategyRouter.post('/naming/:nameId/approve', requirePermission('assets:approve'), async (req, res, next) => {
  try {
    const existing = await prisma.brandNamingCandidate.findFirst({ where: { id: p(req, 'nameId'), workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') } });
    if (!existing) return res.status(404).json({ error: { message: 'Naming candidate not found' } });
    res.json({ data: await prisma.brandNamingCandidate.update({ where: { id: existing.id }, data: { isApproved: true } }) });
  } catch (e) { next(e); }
});

strategyRouter.post('/taglines/generate', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await strategy.generateTaglines(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});
strategyRouter.get('/taglines', async (req, res, next) => {
  try { res.json({ data: await prisma.brandTaglineCandidate.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) }); } catch (e) { next(e); }
});
strategyRouter.post('/taglines/:taglineId/favorite', requirePermission('projects:edit'), async (req, res, next) => {
  try {
    const existing = await prisma.brandTaglineCandidate.findFirst({ where: { id: p(req, 'taglineId'), workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') } });
    if (!existing) return res.status(404).json({ error: { message: 'Tagline candidate not found' } });
    res.json({ data: await prisma.brandTaglineCandidate.update({ where: { id: existing.id }, data: { isFavorite: !existing.isFavorite } }) });
  } catch (e) { next(e); }
});
strategyRouter.post('/taglines/:taglineId/approve', requirePermission('assets:approve'), async (req, res, next) => {
  try {
    const existing = await prisma.brandTaglineCandidate.findFirst({ where: { id: p(req, 'taglineId'), workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') } });
    if (!existing) return res.status(404).json({ error: { message: 'Tagline candidate not found' } });
    res.json({ data: await prisma.brandTaglineCandidate.update({ where: { id: existing.id }, data: { isApproved: true } }) });
  } catch (e) { next(e); }
});

// Strategy Reports
strategyRouter.post('/strategy-reports/generate', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await strategy.generateStrategyReport(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});
strategyRouter.get('/strategy-reports', async (req, res, next) => {
  try { res.json({ data: await prisma.brandStrategyReport.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, include: { versions: true }, orderBy: { version: 'desc' } }) }); } catch (e) { next(e); }
});
strategyRouter.patch('/strategy-reports/:reportId', requirePermission('projects:edit'), async (req, res, next) => {
  try {
    const existing = await prisma.brandStrategyReport.findFirst({ where: { id: p(req, 'reportId'), workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, include: { versions: true } });
    if (!existing) return res.status(404).json({ error: { message: 'Strategy report not found' } });
    const nextSnapshotVer = existing.versions.length + 1;
    const updated = await prisma.brandStrategyReport.update({
      where: { id: existing.id },
      data: {
        sectionsJson: JSON.stringify(req.body.sections || []),
        versions: { create: { version: nextSnapshotVer, snapshotJson: JSON.stringify(req.body.sections || []), changeNote: req.body.changeNote || 'Edited report' } },
      },
      include: { versions: true },
    });
    res.json({ data: updated });
  } catch (e) { next(e); }
});
strategyRouter.post('/strategy-reports/:reportId/approve', requirePermission('assets:approve'), async (req, res, next) => {
  try {
    const existing = await prisma.brandStrategyReport.findFirst({ where: { id: p(req, 'reportId'), workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') } });
    if (!existing) return res.status(404).json({ error: { message: 'Strategy report not found' } });
    res.json({ data: await prisma.brandStrategyReport.update({ where: { id: existing.id }, data: { isApproved: true, approvedAt: new Date() } }) });
  } catch (e) { next(e); }
});
strategyRouter.get('/strategy-reports/:reportId/export', async (req, res, next) => {
  try {
    const fmt = (['PDF', 'DOCX', 'JSON'].includes(String(req.query.format).toUpperCase()) ? String(req.query.format).toUpperCase() : 'PDF') as 'PDF' | 'DOCX' | 'JSON';
    const out = await strategy.exportReport(req.auth!.workspaceId, p(req, 'id'), p(req, 'reportId'), fmt);
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.send(out.buffer);
  } catch (e) { next(e); }
});

// Strategy Workflows
strategyRouter.post('/workflows', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.status(201).json({ data: await wfService.createWorkflow(req.auth!.workspaceId, p(req, 'id'), req.body?.mode || 'AUTOMATIC', req.body?.config) }); } catch (e) { next(e); }
});
strategyRouter.post('/workflows/:workflowId/start', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.json({ data: await wfService.runWorkflow(p(req, 'workflowId')) }); } catch (e) { next(e); }
});
strategyRouter.post('/workflows/:workflowId/pause', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.json({ data: await baseWf.pauseWorkflow(p(req, 'workflowId')) }); } catch (e) { next(e); }
});
strategyRouter.post('/workflows/:workflowId/resume', requirePermission('projects:edit'), async (req, res, next) => {
  try { res.json({ data: await wfService.runWorkflow(p(req, 'workflowId')) }); } catch (e) { next(e); }
});
strategyRouter.post('/workflows/:workflowId/approvals/:approvalId', requirePermission('assets:approve'), async (req, res, next) => {
  try {
    await prisma.workflowApproval.update({ where: { id: p(req, 'approvalId') }, data: { status: req.body.decision || 'APPROVED', decidedAt: new Date() } });
    await prisma.workflowStep.updateMany({ where: { workflowId: p(req, 'workflowId'), status: 'WAITING_APPROVAL' }, data: { status: 'COMPLETED', completedAt: new Date() } });
    res.json({ data: await wfService.runWorkflow(p(req, 'workflowId')) });
  } catch (e) { next(e); }
});
