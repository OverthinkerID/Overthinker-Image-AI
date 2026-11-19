import crypto from 'node:crypto';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';

const storage = new LocalStorageService(env.storageRoot);

export class LogosService {
  async uploadOriginalLogo(params: {
    projectId: string;
    file: Express.Multer.File;
    isPrimary?: boolean;
  }) {
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: { _count: { select: { logos: true } } },
    });
    if (!project) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', `Project "${params.projectId}" not found.`);
    }

    const logoId = `logo_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const saved = await storage.saveOriginalLogo({
      projectId: params.projectId,
      logoId,
      buffer: params.file.buffer,
      mimeType: params.file.mimetype,
      originalFilename: params.file.originalname,
    });

    const shouldBePrimary = params.isPrimary ?? project._count.logos === 0;

    return prisma.$transaction(async (tx) => {
      if (shouldBePrimary) {
        await tx.logoAsset.updateMany({
          where: { projectId: params.projectId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.logoAsset.create({
        data: {
          id: logoId,
          projectId: params.projectId,
          originalFilename: params.file.originalname,
          storedFilename: saved.storedFilename,
          storagePath: saved.storagePath,
          mimeType: params.file.mimetype,
          fileSize: saved.fileSize,
          sha256: saved.sha256,
          isOriginal: true,
          isPrimary: shouldBePrimary,
        },
      });
    });
  }

  async listProjectLogos(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', `Project "${projectId}" not found.`);
    }
    return prisma.logoAsset.findMany({
      where: { projectId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async setPrimaryLogo(projectId: string, logoId: string) {
    const logo = await prisma.logoAsset.findFirst({
      where: { id: logoId, projectId },
    });
    if (!logo) {
      throw new AppError(404, 'LOGO_NOT_FOUND', `Logo "${logoId}" not found in project.`);
    }

    return prisma.$transaction(async (tx) => {
      await tx.logoAsset.updateMany({
        where: { projectId, isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.logoAsset.update({
        where: { id: logoId },
        data: { isPrimary: true },
      });
    });
  }

  async getLogoFile(logoId: string) {
    const logo = await prisma.logoAsset.findUnique({ where: { id: logoId } });
    if (!logo) {
      throw new AppError(404, 'LOGO_NOT_FOUND', `Logo "${logoId}" not found.`);
    }
    const buffer = await storage.readLogo(logo.storagePath);
    return { logo, buffer };
  }
}
