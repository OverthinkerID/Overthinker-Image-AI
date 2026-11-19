import crypto from 'node:crypto';
import { prisma } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { hashToken } from '../auth/auth.service';

export type WorkspaceType = 'PERSONAL' | 'AGENCY' | 'COMPANY' | 'CLIENT';

export class WorkspaceService {
  async listUserWorkspaces(userId: string) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: { include: { settings: true, subscription: { include: { plan: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }

  async createWorkspace(userId: string, input: { name: string; type?: WorkspaceType }) {
    const cleanName = input.name.trim();
    if (!cleanName) throw new AppError(400, 'INVALID_NAME', 'Workspace name is required.');
    const slug = `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${crypto.randomBytes(3).toString('hex')}`;
    const ws = await prisma.workspace.create({
      data: {
        name: cleanName,
        slug,
        type: input.type || 'PERSONAL',
        ownerId: userId,
        members: { create: { userId, role: 'OWNER' } },
        settings: { create: { aiMode: 'HYBRID', defaultProvider: 'heuristic', storageProvider: 'LOCAL' } },
      },
      include: { settings: true },
    });
    await prisma.activityLog.create({
      data: { workspaceId: ws.id, actorId: userId, action: 'WORKSPACE_CREATED', entityType: 'WORKSPACE', entityId: ws.id, summary: `Created workspace "${ws.name}"` },
    });
    return ws;
  }

  async switchWorkspace(userId: string, sessionId: string | null, workspaceId: string) {
    const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, include: { workspace: true } });
    if (!member) throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'You are not a member of this workspace.');
    if (sessionId) {
      await prisma.userSession.update({ where: { id: sessionId }, data: { activeWorkspaceId: workspaceId } });
    }
    return { activeWorkspaceId: workspaceId, role: member.role, workspace: member.workspace };
  }

  async updateWorkspace(workspaceId: string, actorId: string, data: { name?: string; logoPath?: string | null; isArchived?: boolean }) {
    const ws = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.logoPath !== undefined ? { logoPath: data.logoPath } : {}),
        ...(data.isArchived !== undefined ? { isArchived: data.isArchived } : {}),
      },
      include: { settings: true },
    });
    await prisma.activityLog.create({
      data: { workspaceId, actorId, action: 'WORKSPACE_UPDATED', entityType: 'WORKSPACE', entityId: workspaceId, summary: `Updated workspace "${ws.name}"` },
    });
    return ws;
  }

  async updateWorkspaceSettings(workspaceId: string, actorId: string, data: { aiMode?: string; defaultProvider?: string; storageProvider?: string; customDomain?: string | null }) {
    const settings = await prisma.workspaceSetting.upsert({
      where: { workspaceId },
      update: {
        ...(data.aiMode ? { aiMode: data.aiMode } : {}),
        ...(data.defaultProvider ? { defaultProvider: data.defaultProvider } : {}),
        ...(data.storageProvider ? { storageProvider: data.storageProvider } : {}),
        ...(data.customDomain !== undefined ? { customDomain: data.customDomain } : {}),
      },
      create: { workspaceId, aiMode: data.aiMode || 'HYBRID', defaultProvider: data.defaultProvider || 'heuristic', storageProvider: data.storageProvider || 'LOCAL', customDomain: data.customDomain || null },
    });
    await prisma.activityLog.create({
      data: { workspaceId, actorId, action: 'WORKSPACE_SETTINGS_UPDATED', entityType: 'WORKSPACE_SETTING', entityId: settings.id, summary: 'Updated workspace AI & storage settings' },
    });
    return settings;
  }

  async deleteWorkspace(workspaceId: string, confirmName: string) {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.');
    if (ws.id === 'ws_local_default') throw new AppError(400, 'CANNOT_DELETE_LOCAL_DEFAULT', 'Default local workspace cannot be deleted.');
    if (confirmName.trim() !== ws.name) throw new AppError(400, 'CONFIRMATION_MISMATCH', 'Confirmation name does not match workspace name.');
    await prisma.workspace.delete({ where: { id: workspaceId } });
    return { deleted: true, id: workspaceId };
  }

  async listMembers(workspaceId: string) {
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async inviteMember(workspaceId: string, invitedById: string, input: { email: string; role: 'ADMIN' | 'DESIGNER' | 'REVIEWER' | 'CLIENT' }) {
    const email = input.email.trim().toLowerCase();
    const rawToken = crypto.randomBytes(24).toString('hex');
    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role: input.role,
        tokenHash: hashToken(rawToken),
        invitedById,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.activityLog.create({
      data: { workspaceId, actorId: invitedById, action: 'MEMBER_INVITED', entityType: 'INVITATION', entityId: invitation.id, summary: `Invited ${email} as ${input.role}` },
    });
    return { invitation, inviteToken: rawToken };
  }

  async acceptInvitation(rawToken: string, userId: string, userEmail: string) {
    const inv = await prisma.workspaceInvitation.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!inv || inv.status !== 'PENDING' || inv.expiresAt <= new Date()) {
      throw new AppError(400, 'INVALID_INVITATION', 'Invitation is invalid or expired.');
    }
    if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new AppError(403, 'INVITATION_EMAIL_MISMATCH', 'This invitation was issued to a different email address.');
    }
    const member = await prisma.$transaction(async (tx) => {
      await tx.workspaceInvitation.update({ where: { id: inv.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      return tx.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId } },
        update: { role: inv.role },
        create: { workspaceId: inv.workspaceId, userId, role: inv.role },
      });
    });
    await prisma.activityLog.create({
      data: { workspaceId: inv.workspaceId, actorId: userId, action: 'INVITATION_ACCEPTED', entityType: 'WORKSPACE_MEMBER', entityId: member.id, summary: `${userEmail} joined as ${inv.role}` },
    });
    return member;
  }

  async revokeInvitation(workspaceId: string, invitationId: string) {
    const res = await prisma.workspaceInvitation.updateMany({ where: { id: invitationId, workspaceId }, data: { status: 'REVOKED' } });
    if (res.count === 0) throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.');
    return { revoked: true };
  }

  async changeMemberRole(workspaceId: string, memberId: string, role: string) {
    const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
    return prisma.workspaceMember.update({ where: { id: memberId }, data: { role } });
  }

  async removeMember(workspaceId: string, memberId: string) {
    const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
    if (member.role === 'OWNER') throw new AppError(400, 'CANNOT_REMOVE_OWNER', 'Workspace owner cannot be removed.');
    await prisma.workspaceMember.delete({ where: { id: memberId } });
    return { removed: true };
  }
}
