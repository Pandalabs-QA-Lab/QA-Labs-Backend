const crypto = require('node:crypto');
const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');

const normalizeEmail = (email) => email.trim().toLowerCase();
const isPending = (invite) => invite?.status === 'PENDING' && invite.expiresAt > new Date();

async function create(workspaceId, actor, { email, projectId = null }) {
  const address = normalizeEmail(email);
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new HttpError(404, 'Workspace not found');
    const project = projectId
      ? await tx.project.findFirst({ where: { id: projectId, workspaceId, deleted: false } })
      : null;
    if (projectId && !project) throw new HttpError(404, 'Project not found');
    await tx.invitation.updateMany({
      where: { workspaceId, projectId, email: address, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    const invite = await tx.invitation.create({
      data: {
        workspaceId, projectId, kind: project ? 'PROJECT' : 'WORKSPACE', email: address,
        token: crypto.randomBytes(24).toString('hex'), createdById: actor.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await logActivity(tx, {
      workspaceId, projectId, entityType: 'invitation', entityId: invite.id, action: 'created',
      title: `${actor.name} invited ${address} to ${project?.name || workspace.name}`,
      actorId: actor.id, actorName: actor.name,
    });
    return { ...invite, workspaceName: workspace.name, projectName: project?.name || null };
  });
}

async function listManaged(workspaceId, projectId = null) {
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId, deleted: false } });
    if (!project) throw new HttpError(404, 'Project not found');
  }
  return prisma.invitation.findMany({
    where: { workspaceId, projectId, status: 'PENDING', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
}

async function revoke(workspaceId, id) {
  const result = await prisma.invitation.updateMany({
    where: { id, workspaceId, status: 'PENDING' }, data: { status: 'REVOKED' },
  });
  if (result.count !== 1) throw new HttpError(404, 'Pending invitation not found');
}

async function pending(email) {
  const rows = await prisma.invitation.findMany({
    where: { email: normalizeEmail(email), status: 'PENDING', expiresAt: { gt: new Date() } },
    include: { workspace: { select: { name: true } }, project: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((invite) => ({
    id: invite.id, token: invite.token, kind: invite.kind,
    workspaceName: invite.workspace.name, projectName: invite.project?.name || null,
    expiresAt: invite.expiresAt,
  }));
}

async function resolve(token) {
  const invite = await prisma.invitation.findUnique({
    where: { token }, include: { workspace: true, project: true },
  });
  if (!invite) return null;
  if (!isPending(invite) || invite.project?.deleted) {
    throw new HttpError(404, 'This invitation has expired or been revoked');
  }
  return {
    kind: invite.kind, workspaceId: invite.workspaceId, workspaceName: invite.workspace.name,
    projectId: invite.projectId, projectName: invite.project?.name || null, email: invite.email,
  };
}

async function linkMember(tx, workspaceId, actor, role) {
  let member = await tx.teamMember.findFirst({ where: { workspaceId, userId: actor.id, deleted: false } });
  if (!member) {
    member = await tx.teamMember.findFirst({
      where: { workspaceId, email: actor.email, userId: null, deleted: false },
    });
  }
  if (member) {
    return tx.teamMember.update({
      where: { id: member.id },
      data: { userId: actor.id, name: actor.name, email: actor.email, role, status: 'active' },
    });
  }
  return tx.teamMember.create({
    data: { workspaceId, userId: actor.id, name: actor.name, email: actor.email, role, status: 'active' },
  });
}

async function accept(invite, actor) {
  if (!isPending(invite)) throw new HttpError(404, 'This invitation has expired or been revoked');
  if (normalizeEmail(actor.email) !== invite.email) {
    throw new HttpError(403, `Sign in with ${invite.email} to accept this invitation`);
  }
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: { id: invite.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    if (claimed.count !== 1) throw new HttpError(409, 'This invitation was already used');
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: invite.workspaceId } });
    const removed = await tx.teamMember.findFirst({
      where: { workspaceId: workspace.id, userId: actor.id, deleted: true },
    });
    if (removed) throw new HttpError(403, 'Your workspace access was removed');
    const existing = await tx.membership.findUnique({
      where: { userId_workspaceId: { userId: actor.id, workspaceId: workspace.id } },
    });
    const role = existing?.role || 'VIEWER';
    const scope = invite.kind === 'WORKSPACE' ? 'WORKSPACE' : (existing?.scope || 'PROJECT');
    if (!existing) {
      await tx.membership.create({ data: { userId: actor.id, workspaceId: workspace.id, role, scope } });
    } else if (invite.kind === 'WORKSPACE' && existing.scope === 'PROJECT') {
      await tx.membership.update({
        where: { userId_workspaceId: { userId: actor.id, workspaceId: workspace.id } },
        data: { scope: 'WORKSPACE' },
      });
    }
    const member = await linkMember(tx, workspace.id, actor, role);
    let project = null;
    if (invite.projectId) {
      project = await tx.project.findFirst({
        where: { id: invite.projectId, workspaceId: workspace.id, deleted: false },
      });
      if (!project) throw new HttpError(404, 'Project not found');
      if (!project.memberIds.includes(member.id)) {
        await tx.project.update({ where: { id: project.id }, data: { memberIds: [...project.memberIds, member.id] } });
      }
    }
    await logActivity(tx, {
      workspaceId: workspace.id, projectId: project?.id, entityType: 'invitation', entityId: invite.id,
      action: 'accepted', title: `${actor.name} joined ${project?.name || workspace.name}`,
      actorId: actor.id, actorName: actor.name,
    });
    return {
      kind: invite.kind, workspaceId: workspace.id, workspaceName: workspace.name,
      projectId: project?.id || null, projectName: project?.name || null, role, scope,
    };
  });
}

module.exports = { create, listManaged, revoke, pending, resolve, accept, linkMember };
