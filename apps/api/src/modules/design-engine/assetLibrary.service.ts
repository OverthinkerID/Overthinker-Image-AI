import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';

const storage = new LocalStorageService(env.storageRoot);

export class AssetLibraryService {
  async listAssets(projectId: string, filters?: { search?: string; category?: string; assetType?: string; conceptId?: string }) {
    return prisma.brandAsset.findMany({
      where: { projectId, ...(filters?.category && filters.category !== 'ALL' ? { category: filters.category } : {}), ...(filters?.assetType && filters.assetType !== 'ALL' ? { assetType: filters.assetType } : {}), ...(filters?.conceptId ? { conceptId: filters.conceptId } : {}), ...(filters?.search?.trim() ? { name: { contains: filters.search.trim() } } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }
  async renameAsset(projectId: string, assetId: string, name: string) {
    const asset = await prisma.brandAsset.findFirst({ where: { id: assetId, projectId } });
    if (!asset) throw new AppError(404, 'ASSET_NOT_FOUND', 'Asset not found.');
    return prisma.brandAsset.update({ where: { id: assetId }, data: { name } });
  }
  async duplicateAsset(projectId: string, assetId: string) {
    const asset = await prisma.brandAsset.findFirst({ where: { id: assetId, projectId } });
    if (!asset) throw new AppError(404, 'ASSET_NOT_FOUND', 'Asset not found.');
    const buffer = await storage.readRelativeFile(asset.storagePath);
    const saved = await storage.saveProjectScopedAsset({ projectId, folder: 'elements', filename: `copy-${Date.now()}.${asset.assetType.toLowerCase()}`, buffer });
    return prisma.brandAsset.create({ data: { projectId, conceptId: asset.conceptId, name: `${asset.name} (Copy)`, category: asset.category, assetType: asset.assetType, storagePath: saved.storagePath, mimeType: asset.mimeType, width: asset.width, height: asset.height, version: 1, aiProvider: asset.aiProvider } });
  }
  async deleteAsset(projectId: string, assetId: string) {
    const asset = await prisma.brandAsset.findFirst({ where: { id: assetId, projectId } });
    if (!asset) throw new AppError(404, 'ASSET_NOT_FOUND', 'Asset not found.');
    await prisma.brandAsset.delete({ where: { id: assetId } });
    await storage.deleteRelativeFile(asset.storagePath).catch(() => {});
    return { deleted: true, id: assetId };
  }
  async readAssetFile(projectId: string, assetId: string) {
    const asset = await prisma.brandAsset.findFirst({ where: { id: assetId, projectId } });
    if (!asset) throw new AppError(404, 'ASSET_NOT_FOUND', 'Asset not found.');
    return { asset, buffer: await storage.readRelativeFile(asset.storagePath) };
  }
}
