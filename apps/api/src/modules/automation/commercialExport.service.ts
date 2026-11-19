import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';
import { fabricJsonToSvg } from '../design-engine/exportEngine.service';
import { Phase5ExportService } from '../mockups/phase5Export.service';

const storage = new LocalStorageService(env.storageRoot);
const phase5Export = new Phase5ExportService();

export class CommercialExportService {
  async buildCommercialPackage(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        logos: true, logoVariations: true, colorSystems: true, typographySystems: true,
        graphicElements: true, designDocuments: true, mockupDocuments: true,
        brandGuidelines: true, brandPresentations: true, concepts: true,
      },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');

    const pkg = await prisma.exportPackage.create({ data: { projectId, name: `${project.name} Commercial BrandPackage`, status: 'BUILDING' } });

    try {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const stream = new PassThrough();
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      const done = new Promise<Buffer>((resolve, reject) => { stream.on('end', () => resolve(Buffer.concat(chunks))); archive.on('error', reject); });
      archive.pipe(stream);

      const manifestItems: Array<{ folderPath: string; assetName: string; category: string; format: string; dimensions: string; version: number; sourceConcept: string | null; aiProvider: string; aiModel: string | null; createdAt: string }> = [];
      const addBuffer = (folder: string, filename: string, buf: Buffer, meta: { category: string; format: string; dimensions?: string; version?: number; sourceConcept?: string | null; aiProvider?: string; aiModel?: string | null }) => {
        const fullPath = `BrandPackage/${folder}/${filename}`;
        archive.append(buf, { name: fullPath });
        manifestItems.push({ folderPath: fullPath, assetName: filename, category: meta.category, format: meta.format, dimensions: meta.dimensions || 'auto', version: meta.version || 1, sourceConcept: meta.sourceConcept || null, aiProvider: meta.aiProvider || 'manual', aiModel: meta.aiModel || null, createdAt: new Date().toISOString() });
      };

      // 01_Original_Logo
      for (const l of project.logos) {
        if (await storage.fileExists(l.storagePath)) {
          addBuffer('01_Original_Logo', l.originalFilename, await storage.readLogo(l.storagePath), { category: 'ORIGINAL_LOGO', format: l.mimeType, dimensions: `${l.width || 0}x${l.height || 0}` });
        }
      }
      // 02_Logo_System
      for (const lv of project.logoVariations) {
        if (await storage.fileExists(lv.storagePath)) {
          addBuffer('02_Logo_System', `${lv.variationType.toLowerCase()}-v${lv.version}.${lv.format.toLowerCase()}`, await storage.readRelativeFile(lv.storagePath), { category: 'LOGO_SYSTEM', format: lv.format, dimensions: `${lv.width}x${lv.height}`, version: lv.version, sourceConcept: lv.conceptId });
        }
      }
      // 03_Color_System
      for (const cs of project.colorSystems) {
        addBuffer('03_Color_System', `color-system-v${cs.version}.json`, Buffer.from(cs.palettesJson, 'utf8'), { category: 'COLOR_SYSTEM', format: 'JSON', version: cs.version, sourceConcept: cs.conceptId });
      }
      // 04_Typography
      for (const ts of project.typographySystems) {
        addBuffer('04_Typography', `typography-v${ts.version}.json`, Buffer.from(ts.rolesJson, 'utf8'), { category: 'TYPOGRAPHY', format: 'JSON', version: ts.version, sourceConcept: ts.conceptId });
      }
      // 05_Icons_Patterns
      for (const ge of project.graphicElements) {
        if (await storage.fileExists(ge.storagePath)) {
          addBuffer('05_Icons_Patterns', `${ge.elementType.toLowerCase()}-${ge.id}.${ge.format.toLowerCase()}`, await storage.readRelativeFile(ge.storagePath), { category: 'GRAPHIC_ELEMENT', format: ge.format, version: ge.version, sourceConcept: ge.conceptId, aiProvider: ge.aiProvider });
        }
      }
      // 06_Stationery, 07_Social_Media, 08_Marketing, 09_Packaging + 13_Editable_Sources
      const catFolderMap: Record<string, string> = { STATIONERY: '06_Stationery', SOCIAL_MEDIA: '07_Social_Media', MARKETING: '08_Marketing', PACKAGING: '09_Packaging' };
      for (const doc of project.designDocuments) {
        const folder = catFolderMap[doc.category] || '08_Marketing';
        const svg = fabricJsonToSvg(doc.canvasJson, doc.width, doc.height);
        addBuffer(folder, `${doc.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.svg`, Buffer.from(svg, 'utf8'), { category: doc.category, format: 'SVG', dimensions: `${doc.width}x${doc.height}`, version: doc.currentVersion, sourceConcept: doc.conceptId });
        addBuffer('13_Editable_Sources', `${doc.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`, Buffer.from(doc.canvasJson, 'utf8'), { category: 'EDITABLE_SOURCE', format: 'JSON', dimensions: `${doc.width}x${doc.height}`, version: doc.currentVersion, sourceConcept: doc.conceptId });
      }
      // 10_Mockups
      for (const m of project.mockupDocuments) {
        if (m.renderedPath && (await storage.fileExists(m.renderedPath))) {
          addBuffer('10_Mockups', `${m.title.replace(/[^a-zA-Z0-9._-]/g, '_')}-v${m.currentVersion}.png`, await storage.readRelativeFile(m.renderedPath), { category: 'MOCKUP', format: 'PNG', dimensions: `${m.width}x${m.height}`, version: m.currentVersion, sourceConcept: m.conceptId });
        }
      }
      // 11_Brand_Guidelines
      for (const g of project.brandGuidelines) {
        const pdf = await phase5Export.exportGuidelinesPdf(projectId, g.id);
        addBuffer('11_Brand_Guidelines', pdf.filename, pdf.buffer, { category: 'BRAND_GUIDELINES', format: 'PDF', version: g.currentVersion, sourceConcept: g.conceptId });
      }
      // 12_Presentation
      for (const p of project.brandPresentations) {
        const pdf = await phase5Export.exportPresentationPdf(projectId, p.id);
        addBuffer('12_Presentation', pdf.filename, pdf.buffer, { category: 'PRESENTATION', format: 'PDF', dimensions: '16:9', version: p.currentVersion, sourceConcept: p.conceptId });
      }
      // 14_Metadata
      const manifest = { projectId, projectName: project.name, generatedAt: new Date().toISOString(), totalItems: manifestItems.length, items: manifestItems };
      archive.append(JSON.stringify(manifest, null, 2), { name: 'BrandPackage/14_Metadata/manifest.json' });

      await archive.finalize();
      const zipBuffer = await done;
      const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'exports', filename: `BrandPackage-${Date.now()}.zip`, buffer: zipBuffer });

      return prisma.exportPackage.update({
        where: { id: pkg.id },
        data: {
          status: 'COMPLETED', storagePath: saved.storagePath, fileSize: zipBuffer.length, manifestJson: JSON.stringify(manifest),
          items: { create: manifestItems.map((it) => ({ folderPath: it.folderPath, assetName: it.assetName, category: it.category, format: it.format, dimensions: it.dimensions, version: it.version, sourceConcept: it.sourceConcept, aiProvider: it.aiProvider, aiModel: it.aiModel })) },
        },
        include: { items: true },
      });
    } catch (err) {
      await prisma.exportPackage.update({ where: { id: pkg.id }, data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Export failed' } });
      throw err;
    }
  }

  async listPackages(projectId: string) {
    return prisma.exportPackage.findMany({ where: { projectId }, include: { items: true }, orderBy: { createdAt: 'desc' } });
  }

  async downloadPackage(projectId: string, packageId: string) {
    const pkg = await prisma.exportPackage.findFirst({ where: { id: packageId, projectId } });
    if (!pkg || !pkg.storagePath) throw new AppError(404, 'EXPORT_NOT_FOUND', 'Export package not found.');
    return { pkg, buffer: await storage.readRelativeFile(pkg.storagePath) };
  }
}
