import { Router, type Request } from 'express';
import multer from 'multer';
import { AssetLibraryService } from './assetLibrary.service';
import { ColorSystemService } from './colorSystem.service';
import { DesignDocumentService } from './designDocument.service';
import { ExportEngineService } from './exportEngine.service';
import { GraphicElementsService } from './graphicElements.service';
import { LogoSystemService } from './logoSystem.service';
import { TemplateEngineService } from './templateEngine.service';
import { TypographySystemService } from './typographySystem.service';

const logoSystem = new LogoSystemService();
const colorSystem = new ColorSystemService();
const typographySystem = new TypographySystemService();
const graphicElements = new GraphicElementsService();
const templateEngine = new TemplateEngineService();
const designDocs = new DesignDocumentService();
const assetLibrary = new AssetLibraryService();
const exportEngine = new ExportEngineService();
const fontUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const p = (req: Request, key: string) => String((req.params as Record<string, string | string[]>)[key] || '');

export const designEngineRouter = Router({ mergeParams: true });

designEngineRouter.get('/logo-variations', async (req, res, next) => { try { res.json({ data: await logoSystem.listVariations(p(req, 'id')) }); } catch (e) { next(e); } });
designEngineRouter.post('/logo-variations/generate', async (req, res, next) => { try { res.status(201).json({ data: await logoSystem.generateVariationSet(p(req, 'id'), req.body || {}) }); } catch (e) { next(e); } });
designEngineRouter.patch('/logo-variations/:variationId', async (req, res, next) => { try { res.json({ data: await logoSystem.updateVariation(p(req, 'id'), p(req, 'variationId'), req.body || {}) }); } catch (e) { next(e); } });

designEngineRouter.get('/color-systems', async (req, res, next) => { try { res.json({ data: await colorSystem.listColorSystems(p(req, 'id')) }); } catch (e) { next(e); } });
designEngineRouter.post('/color-systems/generate', async (req, res, next) => { try { res.status(201).json({ data: await colorSystem.generateOrGetColorSystem(p(req, 'id'), req.body?.conceptId) }); } catch (e) { next(e); } });
designEngineRouter.post('/color-systems', async (req, res, next) => { try { res.status(201).json({ data: await colorSystem.saveEditedColorSystem(p(req, 'id'), req.body.palettes) }); } catch (e) { next(e); } });

designEngineRouter.get('/typography-systems', async (req, res, next) => { try { res.json({ data: await typographySystem.listTypographySystems(p(req, 'id')) }); } catch (e) { next(e); } });
designEngineRouter.post('/typography-systems/generate', async (req, res, next) => { try { res.status(201).json({ data: await typographySystem.generateOrGetTypographySystem(p(req, 'id'), req.body?.conceptId) }); } catch (e) { next(e); } });
designEngineRouter.post('/typography-systems', async (req, res, next) => { try { res.status(201).json({ data: await typographySystem.saveEditedTypographySystem(p(req, 'id'), req.body.roles) }); } catch (e) { next(e); } });
designEngineRouter.post('/typography-systems/fonts', fontUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: { message: 'Missing font file' } });
    res.status(201).json({ data: await typographySystem.registerLocalFont(p(req, 'id'), req.file, req.body.fontFamily || req.file.originalname, req.body.license) });
  } catch (e) { next(e); }
});

designEngineRouter.get('/graphic-elements', async (req, res, next) => { try { res.json({ data: await graphicElements.listElements(p(req, 'id')) }); } catch (e) { next(e); } });
designEngineRouter.post('/graphic-elements/generate', async (req, res, next) => { try { res.status(201).json({ data: await graphicElements.generateElementSet(p(req, 'id'), req.body || {}) }); } catch (e) { next(e); } });

designEngineRouter.get('/templates', async (req, res, next) => { try { res.json({ data: await templateEngine.listTemplates(p(req, 'id'), typeof req.query.category === 'string' ? req.query.category : undefined) }); } catch (e) { next(e); } });
designEngineRouter.post('/templates/:templateId/instantiate', async (req, res, next) => { try { res.status(201).json({ data: await templateEngine.instantiateTemplateForProject(p(req, 'id'), p(req, 'templateId'), req.body || {}) }); } catch (e) { next(e); } });
designEngineRouter.post('/templates', async (req, res, next) => { try { res.status(201).json({ data: await templateEngine.saveCustomTemplate(p(req, 'id'), req.body) }); } catch (e) { next(e); } });

designEngineRouter.get('/documents', async (req, res, next) => { try { res.json({ data: await designDocs.listDocuments(p(req, 'id')) }); } catch (e) { next(e); } });
designEngineRouter.post('/documents', async (req, res, next) => { try { res.status(201).json({ data: await designDocs.createDocument(p(req, 'id'), req.body) }); } catch (e) { next(e); } });
designEngineRouter.get('/documents/:documentId', async (req, res, next) => { try { res.json({ data: await designDocs.getDocument(p(req, 'id'), p(req, 'documentId')) }); } catch (e) { next(e); } });
designEngineRouter.patch('/documents/:documentId', async (req, res, next) => { try { res.json({ data: await designDocs.saveDocumentVersion(p(req, 'id'), p(req, 'documentId'), req.body) }); } catch (e) { next(e); } });
designEngineRouter.post('/documents/:documentId/duplicate', async (req, res, next) => { try { res.status(201).json({ data: await designDocs.duplicateDocument(p(req, 'id'), p(req, 'documentId')) }); } catch (e) { next(e); } });
designEngineRouter.post('/documents/:documentId/versions/:version/restore', async (req, res, next) => { try { res.json({ data: await designDocs.restoreVersion(p(req, 'id'), p(req, 'documentId'), Number(p(req, 'version'))) }); } catch (e) { next(e); } });

designEngineRouter.get('/assets', async (req, res, next) => {
  try { res.json({ data: await assetLibrary.listAssets(p(req, 'id'), { search: typeof req.query.search === 'string' ? req.query.search : undefined, category: typeof req.query.category === 'string' ? req.query.category : undefined, assetType: typeof req.query.assetType === 'string' ? req.query.assetType : undefined }) }); } catch (e) { next(e); }
});
designEngineRouter.patch('/assets/:assetId', async (req, res, next) => { try { res.json({ data: await assetLibrary.renameAsset(p(req, 'id'), p(req, 'assetId'), req.body.name) }); } catch (e) { next(e); } });
designEngineRouter.post('/assets/:assetId/duplicate', async (req, res, next) => { try { res.status(201).json({ data: await assetLibrary.duplicateAsset(p(req, 'id'), p(req, 'assetId')) }); } catch (e) { next(e); } });
designEngineRouter.delete('/assets/:assetId', async (req, res, next) => { try { res.json({ data: await assetLibrary.deleteAsset(p(req, 'id'), p(req, 'assetId')) }); } catch (e) { next(e); } });
designEngineRouter.get('/assets/:assetId/file', async (req, res, next) => {
  try { const { asset, buffer } = await assetLibrary.readAssetFile(p(req, 'id'), p(req, 'assetId')); res.setHeader('Content-Type', asset.mimeType); res.send(buffer); } catch (e) { next(e); }
});

designEngineRouter.post('/documents/:documentId/export', async (req, res, next) => {
  try { const { buffer, mimeType, filename } = await exportEngine.exportDocument(p(req, 'id'), p(req, 'documentId'), req.body); res.setHeader('Content-Type', mimeType); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); res.send(buffer); } catch (e) { next(e); }
});
designEngineRouter.post('/export/package', async (req, res, next) => {
  try { const { buffer, filename } = await exportEngine.exportProjectZipPackage(p(req, 'id'), req.body?.assetIds); res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); res.send(buffer); } catch (e) { next(e); }
});
