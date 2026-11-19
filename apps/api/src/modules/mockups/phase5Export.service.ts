import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';

const storage = new LocalStorageService(env.storageRoot);

export class Phase5ExportService {
  async exportGuidelinesPdf(projectId: string, guidelineId: string) {
    const guideline = await prisma.brandGuideline.findFirst({ where: { id: guidelineId, projectId }, include: { sections: { orderBy: { orderIndex: 'asc' } } } });
    if (!guideline) throw new AppError(404, 'GUIDELINE_NOT_FOUND', 'Brand guideline not found.');
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: guideline.title } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
      doc.fontSize(24).fillColor('#0F172A').text(guideline.title);
      doc.fontSize(10).fillColor('#64748B').text(`Version v${guideline.currentVersion}`);
      doc.moveDown(1.5);
      for (const sec of guideline.sections) {
        if (doc.y > 700) doc.addPage();
        doc.fontSize(14).fillColor('#1E293B').text(sec.title);
        doc.moveDown(0.3);
        doc.fontSize(10.5).fillColor(sec.isPlaceholder ? '#B45309' : '#334155').text(sec.content, { lineGap: 3 });
        doc.moveDown(1);
      }
      doc.end();
    });
    return { buffer, filename: `${guideline.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` };
  }

  async exportPresentationPdf(projectId: string, presentationId: string) {
    const pres = await prisma.brandPresentation.findFirst({ where: { id: presentationId, projectId }, include: { slides: { orderBy: { orderIndex: 'asc' } } } });
    if (!pres) throw new AppError(404, 'PRESENTATION_NOT_FOUND', 'Presentation not found.');
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: [960, 540], margin: 56, info: { Title: pres.title } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
      pres.slides.forEach((slide, idx) => {
        if (idx > 0) doc.addPage({ size: [960, 540], margin: 56 });
        doc.rect(0, 0, 960, 540).fill('#0F172A');
        doc.fontSize(11).fillColor('#38BDF8').text(`SLIDE ${idx + 1} · ${slide.slideType}`, 56, 48);
        doc.fontSize(32).fillColor('#F8FAFC').text(slide.title, 56, 92, { width: 848 });
        if (slide.subtitle) doc.fontSize(16).fillColor('#94A3B8').text(slide.subtitle, 56, 144, { width: 848 });
        doc.fontSize(14).fillColor('#E2E8F0').text(slide.body, 56, 200, { width: 848, lineGap: 5 });
      });
      doc.end();
    });
    return { buffer, filename: `${pres.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` };
  }

  async exportMockupImage(projectId: string, mockupId: string, format: 'PNG' | 'WEBP') {
    const mockup = await prisma.mockupDocument.findFirst({ where: { id: mockupId, projectId } });
    if (!mockup || !mockup.renderedPath) throw new AppError(404, 'MOCKUP_NOT_FOUND', 'Mockup render not found.');
    const pngBuffer = await storage.readRelativeFile(mockup.renderedPath);
    const outBuffer = format === 'WEBP' ? await sharp(pngBuffer).webp({ quality: 92 }).toBuffer() : pngBuffer;
    return { buffer: outBuffer, mimeType: format === 'WEBP' ? 'image/webp' : 'image/png', filename: `${mockup.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${format.toLowerCase()}` };
  }

  async exportMockupsZip(projectId: string) {
    const mockups = await prisma.mockupDocument.findMany({ where: { projectId } });
    const archive = archiver('zip', { zlib: { level: 9 } }), stream = new PassThrough(), chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => { stream.on('end', () => resolve(Buffer.concat(chunks))); archive.on('error', reject); });
    archive.pipe(stream);
    for (const m of mockups) {
      if (!m.renderedPath) continue;
      const buf = await storage.readRelativeFile(m.renderedPath).catch(() => null);
      if (buf) archive.append(buf, { name: `mockups/${m.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.png` });
    }
    await archive.finalize();
    return { buffer: await done, filename: `project-${projectId}-mockups.zip` };
  }
}
