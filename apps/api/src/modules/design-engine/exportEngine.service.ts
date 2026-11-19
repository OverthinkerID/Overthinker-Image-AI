import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';

const storage = new LocalStorageService(env.storageRoot);
function escXml(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function fabricJsonToSvg(canvasJson: string, width: number, height: number, transparent = false): string {
  const parsed = JSON.parse(canvasJson) as { background?: string; objects?: Array<Record<string, unknown>> };
  const elements: string[] = [];
  if (!transparent) elements.push(`<rect width="${width}" height="${height}" fill="${escXml(String(parsed.background || '#FFFFFF'))}"/>`);
  for (const obj of parsed.objects || []) {
    const type = String(obj.type || '').toLowerCase(), left = Number(obj.left || 0), top = Number(obj.top || 0), fill = String(obj.fill || '#0F172A');
    const opacity = obj.opacity !== undefined ? ` fill-opacity="${Number(obj.opacity)}"` : '';
    if (type === 'rect') elements.push(`<rect x="${left}" y="${top}" width="${Number(obj.width || 100)}" height="${Number(obj.height || 100)}" rx="${Number(obj.rx || 0)}" fill="${escXml(fill)}"${opacity}/>`);
    else if (type === 'circle') { const r = Number(obj.radius || 40); elements.push(`<circle cx="${left + r}" cy="${top + r}" r="${r}" fill="${escXml(fill)}"${opacity}/>`); }
    else if (type === 'textbox' || type === 'text' || type === 'i-text') {
      const fs = Number(obj.fontSize || 24);
      elements.push(`<text x="${left}" y="${top + fs}" font-family="${escXml(String(obj.fontFamily || 'sans-serif'))}" font-size="${fs}" font-weight="${String(obj.fontWeight || 'normal')}" fill="${escXml(fill)}">${escXml(String(obj.text || ''))}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  ${elements.join('\n  ')}\n</svg>`;
}

export class ExportEngineService {
  async exportDocument(projectId: string, documentId: string, opts: { format: 'PNG' | 'SVG' | 'WEBP' | 'PDF' | 'JSON'; width?: number; height?: number; dpi?: number; transparent?: boolean }) {
    const doc = await prisma.designDocument.findFirst({ where: { id: documentId, projectId } });
    if (!doc) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Design document not found.');
    const width = opts.width || doc.width, height = opts.height || doc.height, dpi = opts.dpi || 72, transparent = Boolean(opts.transparent);
    const svg = fabricJsonToSvg(doc.canvasJson, doc.width, doc.height, transparent);
    let outBuffer: Buffer, ext = opts.format.toLowerCase(), mimeType = 'application/octet-stream';
    if (opts.format === 'JSON') { outBuffer = Buffer.from(doc.canvasJson, 'utf8'); mimeType = 'application/json'; }
    else if (opts.format === 'SVG') { outBuffer = Buffer.from(svg, 'utf8'); mimeType = 'image/svg+xml'; }
    else if (opts.format === 'PNG') { outBuffer = await sharp(Buffer.from(svg, 'utf8'), { density: dpi }).resize(width, height).png().toBuffer(); mimeType = 'image/png'; }
    else if (opts.format === 'WEBP') { outBuffer = await sharp(Buffer.from(svg, 'utf8'), { density: dpi }).resize(width, height).webp({ quality: 92 }).toBuffer(); mimeType = 'image/webp'; }
    else { outBuffer = await this.renderDocumentPdf(doc.title, doc.canvasJson, width, height); ext = 'pdf'; mimeType = 'application/pdf'; }
    const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'exports', filename: `${doc.id}-${Date.now()}.${ext}`, buffer: outBuffer });
    const record = await prisma.assetExport.create({ data: { projectId, documentId: doc.id, format: opts.format, width, height, dpi, transparent, storagePath: saved.storagePath, fileSize: outBuffer.length } });
    return { record, buffer: outBuffer, mimeType, filename: `${doc.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}` };
  }

  private renderDocumentPdf(title: string, canvasJson: string, width: number, height: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [width, height], margin: 0, info: { Title: title } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
      const parsed = JSON.parse(canvasJson) as { background?: string; objects?: Array<Record<string, unknown>> };
      if (parsed.background) doc.rect(0, 0, width, height).fill(String(parsed.background));
      for (const obj of parsed.objects || []) {
        const type = String(obj.type || '').toLowerCase(), left = Number(obj.left || 0), top = Number(obj.top || 0), fill = String(obj.fill || '#0F172A');
        if (type === 'rect') doc.rect(left, top, Number(obj.width || 100), Number(obj.height || 100)).fill(fill);
        else if (type === 'circle') { const r = Number(obj.radius || 40); doc.circle(left + r, top + r, r).fill(fill); }
        else if (type === 'textbox' || type === 'text' || type === 'i-text') doc.fillColor(fill).fontSize(Number(obj.fontSize || 24)).text(String(obj.text || ''), left, top, { width: Number(obj.width || width - left) });
      }
      doc.end();
    });
  }

  async exportProjectZipPackage(projectId: string, assetIds?: string[]) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const assets = await prisma.brandAsset.findMany({ where: { projectId, ...(assetIds?.length ? { id: { in: assetIds } } : {}) } });
    const docs = await prisma.designDocument.findMany({ where: { projectId } });
    const archive = archiver('zip', { zlib: { level: 9 } }), stream = new PassThrough(), chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => { stream.on('end', () => resolve(Buffer.concat(chunks))); archive.on('error', reject); });
    archive.pipe(stream);
    for (const asset of assets) {
      const buf = await storage.readRelativeFile(asset.storagePath).catch(() => null);
      if (buf) archive.append(buf, { name: `${asset.category.toLowerCase()}/${asset.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${asset.assetType.toLowerCase()}` });
    }
    for (const d of docs) {
      archive.append(d.canvasJson, { name: `documents/${d.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.json` });
      archive.append(fabricJsonToSvg(d.canvasJson, d.width, d.height), { name: `documents/${d.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.svg` });
    }
    await archive.finalize();
    const zipBuffer = await done;
    const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'exports', filename: `brand-package-${Date.now()}.zip`, buffer: zipBuffer });
    await prisma.assetExport.create({ data: { projectId, format: 'ZIP', storagePath: saved.storagePath, fileSize: zipBuffer.length } });
    return { buffer: zipBuffer, filename: `${project.slug}-brand-package.zip` };
  }
}
