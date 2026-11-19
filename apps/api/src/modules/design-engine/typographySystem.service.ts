import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';

const storage = new LocalStorageService(env.storageRoot);

export interface TypographyRoleSpec {
  role: 'display' | 'heading' | 'subheading' | 'body' | 'caption';
  fontFamily: string; fontSizePx: number; fontWeight: number; letterSpacingEm: number; lineHeight: number;
  source: 'google-fonts' | 'system' | 'local-upload'; license: string; available: boolean;
}

export class TypographySystemService {
  async generateOrGetTypographySystem(projectId: string, conceptId?: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { brandDnas: { include: { typography: true }, orderBy: [{ isApproved: 'desc' }, { version: 'desc' }] }, concepts: { orderBy: [{ isApproved: 'desc' }, { isPrimary: 'desc' }] } } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    const dna = project.brandDnas[0] || null;
    const concept = conceptId ? project.concepts.find((c) => c.id === conceptId) || project.concepts[0] : project.concepts[0] || null;
    const heading = dna?.typography?.headingFont || 'Plus Jakarta Sans', body = dna?.typography?.bodyFont || 'Inter';
    const roles: Record<TypographyRoleSpec['role'], TypographyRoleSpec> = {
      display: { role: 'display', fontFamily: heading, fontSizePx: 48, fontWeight: 700, letterSpacingEm: -0.02, lineHeight: 1.1, source: 'google-fonts', license: 'SIL Open Font License 1.1', available: true },
      heading: { role: 'heading', fontFamily: heading, fontSizePx: 32, fontWeight: 700, letterSpacingEm: -0.015, lineHeight: 1.2, source: 'google-fonts', license: 'SIL Open Font License 1.1', available: true },
      subheading: { role: 'subheading', fontFamily: heading, fontSizePx: 20, fontWeight: 600, letterSpacingEm: 0, lineHeight: 1.35, source: 'google-fonts', license: 'SIL Open Font License 1.1', available: true },
      body: { role: 'body', fontFamily: body, fontSizePx: 16, fontWeight: 400, letterSpacingEm: 0, lineHeight: 1.6, source: 'google-fonts', license: 'SIL Open Font License 1.1', available: true },
      caption: { role: 'caption', fontFamily: body, fontSizePx: 12, fontWeight: 500, letterSpacingEm: 0.02, lineHeight: 1.4, source: 'google-fonts', license: 'SIL Open Font License 1.1', available: true },
    };
    const maxVer = await prisma.typographySystem.aggregate({ where: { projectId }, _max: { version: true } });
    const nextVersion = (maxVer._max.version || 0) + 1;
    return prisma.$transaction(async (tx) => {
      await tx.typographySystem.updateMany({ where: { projectId, isActive: true }, data: { isActive: false } });
      return tx.typographySystem.create({ data: { projectId, brandDnaId: dna?.id || null, conceptId: concept?.id || null, name: `${project.name} Typography v${nextVersion}`, version: nextVersion, rolesJson: JSON.stringify(roles), isActive: true } });
    });
  }

  async listTypographySystems(projectId: string) { return prisma.typographySystem.findMany({ where: { projectId }, orderBy: { version: 'desc' } }); }

  async saveEditedTypographySystem(projectId: string, roles: Record<string, TypographyRoleSpec>) {
    const maxVer = await prisma.typographySystem.aggregate({ where: { projectId }, _max: { version: true } });
    const nextVersion = (maxVer._max.version || 0) + 1;
    return prisma.$transaction(async (tx) => {
      await tx.typographySystem.updateMany({ where: { projectId, isActive: true }, data: { isActive: false } });
      return tx.typographySystem.create({ data: { projectId, name: `Custom Typography v${nextVersion}`, version: nextVersion, rolesJson: JSON.stringify(roles), isActive: true } });
    });
  }

  async registerLocalFont(projectId: string, file: { originalname: string; buffer: Buffer; mimetype: string }, fontFamilyName: string, license = 'User-provided local license') {
    const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'fonts', filename: file.originalname, buffer: file.buffer });
    const latest = await prisma.typographySystem.findFirst({ where: { projectId, isActive: true }, orderBy: { version: 'desc' } });
    const fontEntry = { fontFamily: fontFamilyName, filename: file.originalname, storagePath: saved.storagePath, license, uploadedAt: new Date().toISOString() };
    if (latest) {
      const existingFonts = JSON.parse(latest.customFontsJson || '[]') as unknown[];
      existingFonts.push(fontEntry);
      await prisma.typographySystem.update({ where: { id: latest.id }, data: { customFontsJson: JSON.stringify(existingFonts) } });
    }
    return fontEntry;
  }
}
