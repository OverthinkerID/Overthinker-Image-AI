import crypto from 'node:crypto';
import { prisma } from '../../db/client';
import { env } from '../../config/appConfig';
import { AppError } from '../../middleware/errorHandler';
import { LocalStorageService } from '../../services/storage.service';
import type { CreateProjectDto, UpdateProjectDto } from './projects.validation';

const storage = new LocalStorageService(env.storageRoot);

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'brand-project';
}

export class ProjectsService {
  async listProjects(params?: { search?: string; status?: string; workspaceId?: string }) {
    const where: Record<string, unknown> = {};
    if (params?.workspaceId) {
      where.workspaceId = params.workspaceId;
    }
    if (params?.status && ['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(params.status)) {
      where.status = params.status;
    }
    if (params?.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q } },
        { industry: { contains: q } },
        { description: { contains: q } },
      ];
    }

    return prisma.project.findMany({
      where,
      include: {
        logos: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getProjectById(id: string, workspaceId?: string) {
    const project = await prisma.project.findFirst({
      where: { id, ...(workspaceId ? { workspaceId } : {}) },
      include: {
        logos: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
    if (!project) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', `Project "${id}" not found.`);
    }
    return project;
  }

  async createProject(dto: CreateProjectDto & { workspaceId?: string }) {
    const baseSlug = slugify(dto.name);
    const suffix = crypto.randomBytes(3).toString('hex');
    const slug = `${baseSlug}-${suffix}`;

    return prisma.project.create({
      data: {
        workspaceId: dto.workspaceId || 'ws_local_default',
        name: dto.name,
        slug,
        description: dto.description || null,
        industry: dto.industry || null,
        status: dto.status || 'DRAFT',
      },
      include: { logos: true },
    });
  }

  async updateProject(id: string, dto: UpdateProjectDto, workspaceId?: string) {
    await this.getProjectById(id, workspaceId);
    return prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        logos: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
  }

  async deleteProject(id: string, workspaceId?: string) {
    await this.getProjectById(id, workspaceId);
    await prisma.project.delete({ where: { id } });
    await storage.deleteProjectStorage(id);
    return { deleted: true, id };
  }
}
