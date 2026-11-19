import { Router, type Request } from 'express';
import { prisma } from '../../db/client';
import { BrandGuidelinesService } from '../guidelines/guidelines.service';
import { BrandPresentationsService } from '../presentations/presentations.service';
import { MockupLibraryService } from './mockupLibrary.service';
import { Phase5ExportService } from './phase5Export.service';
import { SmartMockupService } from './smartMockup.service';

const mockupLibrary = new MockupLibraryService();
const smartMockup = new SmartMockupService();
const guidelinesService = new BrandGuidelinesService();
const presentationsService = new BrandPresentationsService();
const phase5Export = new Phase5ExportService();
const p = (req: Request, key: string) => String((req.params as Record<string, string | string[]>)[key] || '');

export const phase5Router = Router({ mergeParams: true });

phase5Router.get('/mockup-templates', async (req, res, next) => {
  try { res.json({ data: await mockupLibrary.listMockupTemplates(p(req, 'id'), { category: typeof req.query.category === 'string' ? req.query.category : undefined, search: typeof req.query.search === 'string' ? req.query.search : undefined, favoritesOnly: req.query.favoritesOnly === 'true' }) }); } catch (e) { next(e); }
});
phase5Router.patch('/mockup-templates/:templateId/favorite', async (req, res, next) => {
  try { res.json({ data: await mockupLibrary.toggleTemplateFavorite(p(req, 'templateId')) }); } catch (e) { next(e); }
});

phase5Router.get('/mockups', async (req, res, next) => { try { res.json({ data: await smartMockup.listMockups(p(req, 'id')) }); } catch (e) { next(e); } });
phase5Router.post('/mockups', async (req, res, next) => { try { res.status(201).json({ data: await smartMockup.createMockupFromTemplate(p(req, 'id'), req.body) }); } catch (e) { next(e); } });
phase5Router.patch('/mockups/:mockupId', async (req, res, next) => { try { res.json({ data: await smartMockup.updateAndRenderMockup(p(req, 'id'), p(req, 'mockupId'), req.body) }); } catch (e) { next(e); } });
phase5Router.get('/mockups/:mockupId/render', async (req, res, next) => {
  try { const buf = await smartMockup.readMockupRender(p(req, 'id'), p(req, 'mockupId')); res.setHeader('Content-Type', 'image/png'); res.send(buf); } catch (e) { next(e); }
});
phase5Router.post('/mockups/ai-generate', async (req, res, next) => { try { res.status(201).json({ data: await smartMockup.generateAiMockupScene(p(req, 'id'), req.body) }); } catch (e) { next(e); } });
phase5Router.get('/mockups/ai-jobs', async (req, res, next) => {
  try { res.json({ data: await prisma.mockupRenderJob.findMany({ where: { projectId: p(req, 'id') }, orderBy: { createdAt: 'desc' } }) }); } catch (e) { next(e); }
});
phase5Router.post('/mockups/:mockupId/export', async (req, res, next) => {
  try { const { buffer, mimeType, filename } = await phase5Export.exportMockupImage(p(req, 'id'), p(req, 'mockupId'), req.body?.format === 'WEBP' ? 'WEBP' : 'PNG'); res.setHeader('Content-Type', mimeType); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); res.send(buffer); } catch (e) { next(e); }
});
phase5Router.post('/mockups/export/zip', async (req, res, next) => {
  try { const { buffer, filename } = await phase5Export.exportMockupsZip(p(req, 'id')); res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); res.send(buffer); } catch (e) { next(e); }
});

phase5Router.get('/guidelines', async (req, res, next) => { try { res.json({ data: await guidelinesService.getProjectGuidelines(p(req, 'id')) }); } catch (e) { next(e); } });
phase5Router.post('/guidelines/generate', async (req, res, next) => { try { res.status(201).json({ data: await guidelinesService.generateGuidelines(p(req, 'id'), req.body?.conceptId) }); } catch (e) { next(e); } });
phase5Router.patch('/guidelines/:guidelineId/sections/:sectionId', async (req, res, next) => {
  try { res.json({ data: await guidelinesService.updateSectionAndSaveVersion(p(req, 'id'), p(req, 'guidelineId'), p(req, 'sectionId'), req.body) }); } catch (e) { next(e); }
});
phase5Router.post('/guidelines/:guidelineId/export/pdf', async (req, res, next) => {
  try { const { buffer, filename } = await phase5Export.exportGuidelinesPdf(p(req, 'id'), p(req, 'guidelineId')); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); res.send(buffer); } catch (e) { next(e); }
});

phase5Router.get('/presentations', async (req, res, next) => { try { res.json({ data: await presentationsService.listPresentations(p(req, 'id')) }); } catch (e) { next(e); } });
phase5Router.post('/presentations/generate', async (req, res, next) => { try { res.status(201).json({ data: await presentationsService.generatePresentation(p(req, 'id'), req.body?.conceptId) }); } catch (e) { next(e); } });
phase5Router.patch('/presentations/:presentationId/slides/:slideId', async (req, res, next) => {
  try { res.json({ data: await presentationsService.updateSlideAndSaveVersion(p(req, 'id'), p(req, 'presentationId'), p(req, 'slideId'), req.body) }); } catch (e) { next(e); }
});
phase5Router.post('/presentations/:presentationId/slides', async (req, res, next) => {
  try { res.status(201).json({ data: await presentationsService.addSlide(p(req, 'id'), p(req, 'presentationId'), req.body) }); } catch (e) { next(e); }
});
phase5Router.delete('/presentations/:presentationId/slides/:slideId', async (req, res, next) => {
  try { res.json({ data: await presentationsService.deleteSlide(p(req, 'id'), p(req, 'presentationId'), p(req, 'slideId')) }); } catch (e) { next(e); }
});
phase5Router.post('/presentations/:presentationId/export/pdf', async (req, res, next) => {
  try { const { buffer, filename } = await phase5Export.exportPresentationPdf(p(req, 'id'), p(req, 'presentationId')); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); res.send(buffer); } catch (e) { next(e); }
});
