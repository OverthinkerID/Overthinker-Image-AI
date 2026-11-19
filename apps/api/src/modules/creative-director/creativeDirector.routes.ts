import { Router, type Request } from 'express';
import { prisma } from '../../db/client';
import { BrandIntelligenceService } from './brandIntelligence.service';
import { CreativeDirectorService } from './creativeDirector.service';
import { DirectorAiAdapter } from './directorAi.adapter';

const director = new CreativeDirectorService();
const intel = new BrandIntelligenceService();
const aiAdapter = new DirectorAiAdapter();
const p = (req: Request, key: string) => String((req.params as Record<string, string | string[]>)[key] || '');

export const creativeDirectorRouter = Router({ mergeParams: true });

creativeDirectorRouter.get('/context', async (req, res, next) => {
  try { res.json({ data: (await director.getProjectContext(req.auth!.workspaceId, p(req, 'id'))).summary }); } catch (e) { next(e); }
});

creativeDirectorRouter.get('/capabilities', async (_req, res) => {
  res.json({ data: aiAdapter.listCapabilities() });
});

creativeDirectorRouter.get('/sessions', async (req, res, next) => {
  try { res.json({ data: await director.listSessions(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});

creativeDirectorRouter.post('/chat', async (req, res, next) => {
  try { res.status(201).json({ data: await director.sendMessage(req.auth!.workspaceId, p(req, 'id'), req.auth!.userId, req.body || {}) }); } catch (e) { next(e); }
});

creativeDirectorRouter.post('/logo-intelligence', async (req, res, next) => {
  try { res.status(201).json({ data: await director.evaluateLogo(req.auth!.workspaceId, p(req, 'id'), req.auth!.userId, req.body || {}) }); } catch (e) { next(e); }
});

creativeDirectorRouter.get('/assessments', async (req, res, next) => {
  try {
    res.json({
      data: await prisma.creativeAssessment.findMany({
        where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') },
        include: { categories: true, evidence: true },
        orderBy: { createdAt: 'desc' },
      }),
    });
  } catch (e) { next(e); }
});

creativeDirectorRouter.post('/design-critic', async (req, res, next) => {
  try { res.status(201).json({ data: await director.critiqueDesign(req.auth!.workspaceId, p(req, 'id'), req.auth!.userId, req.body) }); } catch (e) { next(e); }
});

creativeDirectorRouter.get('/critic-reports', async (req, res, next) => {
  try {
    res.json({ data: await prisma.designCriticReport.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) });
  } catch (e) { next(e); }
});

creativeDirectorRouter.post('/consistency', async (req, res, next) => {
  try { res.status(201).json({ data: await director.analyzeConsistency(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});

creativeDirectorRouter.get('/consistency-reports', async (req, res, next) => {
  try {
    res.json({ data: await prisma.brandConsistencyReport.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) });
  } catch (e) { next(e); }
});

creativeDirectorRouter.post('/recommendations/generate', async (req, res, next) => {
  try { res.status(201).json({ data: await intel.generateRecommendations(req.auth!.workspaceId, p(req, 'id'), req.body?.direction) }); } catch (e) { next(e); }
});

creativeDirectorRouter.get('/recommendations', async (req, res, next) => {
  try {
    res.json({ data: await prisma.creativeRecommendation.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) });
  } catch (e) { next(e); }
});

creativeDirectorRouter.patch('/recommendations/:recId', async (req, res, next) => {
  try { res.json({ data: await intel.updateRecommendationStatus(req.auth!.workspaceId, p(req, 'id'), p(req, 'recId'), req.body) }); } catch (e) { next(e); }
});

creativeDirectorRouter.post('/briefs/generate', async (req, res, next) => {
  try { res.status(201).json({ data: await intel.generateCreativeBrief(req.auth!.workspaceId, p(req, 'id'), req.body?.direction) }); } catch (e) { next(e); }
});

creativeDirectorRouter.get('/briefs', async (req, res, next) => {
  try {
    res.json({ data: await prisma.creativeBrief.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, orderBy: { version: 'desc' } }) });
  } catch (e) { next(e); }
});

creativeDirectorRouter.post('/comparisons', async (req, res, next) => {
  try { res.status(201).json({ data: await intel.compareItems(req.auth!.workspaceId, p(req, 'id'), req.body) }); } catch (e) { next(e); }
});

creativeDirectorRouter.get('/comparisons', async (req, res, next) => {
  try {
    res.json({ data: await prisma.brandComparison.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) });
  } catch (e) { next(e); }
});

creativeDirectorRouter.post('/reports/generate', async (req, res, next) => {
  try { res.status(201).json({ data: await intel.generateIntelligenceReport(req.auth!.workspaceId, p(req, 'id')) }); } catch (e) { next(e); }
});

creativeDirectorRouter.get('/reports', async (req, res, next) => {
  try {
    res.json({ data: await prisma.brandIntelligenceReport.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, orderBy: { version: 'desc' } }) });
  } catch (e) { next(e); }
});

creativeDirectorRouter.patch('/reports/:reportId', async (req, res, next) => {
  try {
    const existing = await prisma.brandIntelligenceReport.findFirst({ where: { id: p(req, 'reportId'), workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') } });
    if (!existing) return res.status(404).json({ error: { message: 'Report not found.' } });
    const updated = await prisma.brandIntelligenceReport.update({
      where: { id: existing.id },
      data: { sectionsJson: JSON.stringify(req.body.sections || []), isEdited: true },
    });
    res.json({ data: updated });
  } catch (e) { next(e); }
});

creativeDirectorRouter.post('/reports/:reportId/export/pdf', async (req, res, next) => {
  try {
    const { buffer, filename } = await intel.exportIntelligenceReportPdf(req.auth!.workspaceId, p(req, 'id'), p(req, 'reportId'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) { next(e); }
});

creativeDirectorRouter.get('/history', async (req, res, next) => {
  try {
    res.json({ data: await prisma.assessmentHistory.findMany({ where: { workspaceId: req.auth!.workspaceId, projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' }, take: 50 }) });
  } catch (e) { next(e); }
});
