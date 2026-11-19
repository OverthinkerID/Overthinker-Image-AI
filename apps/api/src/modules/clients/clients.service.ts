import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';

export class ClientsService {
  async listClients(workspaceId: string, params?: { search?: string; includeArchived?: boolean }) {
    const where: Record<string, unknown> = { workspaceId };
    if (!params?.includeArchived) where.isArchived = false;
    if (params?.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q } },
        { companyName: { contains: q } },
        { contactPerson: { contains: q } },
        { industry: { contains: q } },
      ];
    }
    return prisma.client.findMany({
      where,
      include: { contacts: true, projects: { include: { project: { select: { id: true, name: true, status: true } } } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getClient(workspaceId: string, clientId: string) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, workspaceId },
      include: {
        contacts: true,
        projects: { include: { project: true } },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found in workspace.');
    return client;
  }

  async createClient(workspaceId: string, actorId: string, input: Record<string, unknown>) {
    const name = String(input.name || '').trim();
    if (!name) throw new AppError(400, 'INVALID_CLIENT', 'Client name is required.');
    const client = await prisma.client.create({
      data: {
        workspaceId,
        name,
        companyName: input.companyName ? String(input.companyName) : null,
        contactPerson: input.contactPerson ? String(input.contactPerson) : null,
        email: input.email ? String(input.email) : null,
        phone: input.phone ? String(input.phone) : null,
        address: input.address ? String(input.address) : null,
        website: input.website ? String(input.website) : null,
        industry: input.industry ? String(input.industry) : null,
        description: input.description ? String(input.description) : null,
        internalNotes: input.internalNotes ? String(input.internalNotes) : null,
      },
      include: { contacts: true, projects: true },
    });
    await prisma.activityLog.create({
      data: { workspaceId, actorId, clientId: client.id, action: 'CLIENT_CREATED', entityType: 'CLIENT', entityId: client.id, summary: `Created client "${client.name}"` },
    });
    return client;
  }

  async updateClient(workspaceId: string, clientId: string, actorId: string, input: Record<string, unknown>) {
    await this.getClient(workspaceId, clientId);
    const updated = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(input.name !== undefined ? { name: String(input.name) } : {}),
        ...(input.companyName !== undefined ? { companyName: input.companyName ? String(input.companyName) : null } : {}),
        ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson ? String(input.contactPerson) : null } : {}),
        ...(input.email !== undefined ? { email: input.email ? String(input.email) : null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ? String(input.phone) : null } : {}),
        ...(input.address !== undefined ? { address: input.address ? String(input.address) : null } : {}),
        ...(input.website !== undefined ? { website: input.website ? String(input.website) : null } : {}),
        ...(input.industry !== undefined ? { industry: input.industry ? String(input.industry) : null } : {}),
        ...(input.description !== undefined ? { description: input.description ? String(input.description) : null } : {}),
        ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes ? String(input.internalNotes) : null } : {}),
        ...(input.isArchived !== undefined ? { isArchived: Boolean(input.isArchived) } : {}),
      },
    });
    await prisma.activityLog.create({
      data: { workspaceId, actorId, clientId, action: 'CLIENT_UPDATED', entityType: 'CLIENT', entityId: clientId, summary: `Updated client "${updated.name}"` },
    });
    return updated;
  }

  async connectProject(workspaceId: string, clientId: string, actorId: string, input: { projectId: string; status?: string; notes?: string }) {
    await this.getClient(workspaceId, clientId);
    const project = await prisma.project.findFirst({ where: { id: input.projectId, workspaceId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found in active workspace.');

    const link = await prisma.clientProject.upsert({
      where: { clientId_projectId: { clientId, projectId: project.id } },
      update: { status: input.status || 'IN_PROGRESS', notes: input.notes || null },
      create: { workspaceId, clientId, projectId: project.id, status: input.status || 'IN_PROGRESS', notes: input.notes || null },
      include: { project: true },
    });
    await prisma.activityLog.create({
      data: { workspaceId, actorId, clientId, projectId: project.id, action: 'CLIENT_PROJECT_LINKED', entityType: 'CLIENT_PROJECT', entityId: link.id, summary: `Linked project "${project.name}" (${link.status})` },
    });
    return link;
  }
}
