import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';

export class DesignDocumentService {
  async listDocuments(projectId: string) { return prisma.designDocument.findMany({ where: { projectId }, include: { versions: { orderBy: { version: 'desc' }, take: 10 } }, orderBy: { updatedAt: 'desc' } }); }
  async getDocument(projectId: string, documentId: string) {
    const doc = await prisma.designDocument.findFirst({ where: { id: documentId, projectId }, include: { versions: { orderBy: { version: 'desc' } } } });
    if (!doc) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Design document not found.');
    return doc;
  }
  async createDocument(projectId: string, payload: { title: string; category?: string; width?: number; height?: number; canvasJson: string; conceptId?: string }) {
    return prisma.designDocument.create({
      data: { projectId, conceptId: payload.conceptId || null, title: payload.title, category: payload.category || 'CUSTOM', width: payload.width || 1080, height: payload.height || 1080, canvasJson: payload.canvasJson, currentVersion: 1, versions: { create: { version: 1, canvasJson: payload.canvasJson, changeNote: 'Initial design' } } },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
  }
  async saveDocumentVersion(projectId: string, documentId: string, payload: { title?: string; canvasJson: string; changeNote?: string; width?: number; height?: number }) {
    const existing = await prisma.designDocument.findFirst({ where: { id: documentId, projectId } });
    if (!existing) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Design document not found.');
    const nextVersion = existing.currentVersion + 1;
    return prisma.designDocument.update({
      where: { id: documentId },
      data: { ...(payload.title ? { title: payload.title } : {}), ...(payload.width ? { width: payload.width } : {}), ...(payload.height ? { height: payload.height } : {}), canvasJson: payload.canvasJson, currentVersion: nextVersion, versions: { create: { version: nextVersion, canvasJson: payload.canvasJson, changeNote: payload.changeNote || `Saved version v${nextVersion}` } } },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
  }
  async restoreVersion(projectId: string, documentId: string, version: number) {
    const doc = await this.getDocument(projectId, documentId);
    const target = doc.versions.find((v) => v.version === version);
    if (!target) throw new AppError(404, 'VERSION_NOT_FOUND', `Version v${version} not found.`);
    return this.saveDocumentVersion(projectId, documentId, { canvasJson: target.canvasJson, changeNote: `Restored from v${version}` });
  }
  async duplicateDocument(projectId: string, documentId: string) {
    const doc = await this.getDocument(projectId, documentId);
    return this.createDocument(projectId, { title: `${doc.title} (Copy)`, category: doc.category, width: doc.width, height: doc.height, canvasJson: doc.canvasJson, conceptId: doc.conceptId || undefined });
  }
}
