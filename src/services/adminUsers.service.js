const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { hashPassword } = require('../lib/passwords');
const { logActivity } = require('../lib/activityLogger');

async function createAccount(adminId, { email, displayName, password, workspaceId }) {
  const address = email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: address }, select: { id: true } })) {
    throw new HttpError(409, 'An account with this email already exists');
  }
  const passwordHash = await hashPassword(password);
  try {
    return await prisma.$transaction(async (tx) => {
      const workspace = workspaceId
        ? await tx.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true } })
        : null;
      if (workspaceId && !workspace) throw new HttpError(404, 'Workspace not found');
      const user = await tx.user.create({
        data: { email: address, displayName: displayName.trim(), passwordHash, mustChangePassword: true },
        select: { id: true, email: true, displayName: true, createdAt: true },
      });
      if (workspace) {
        await tx.membership.create({ data: { userId: user.id, workspaceId, role: 'VIEWER', scope: 'WORKSPACE' } });
        await tx.teamMember.create({ data: { userId: user.id, workspaceId, name: user.displayName, email: user.email, role: 'VIEWER' } });
        await logActivity(tx, {
          workspaceId, entityType: 'member', entityId: user.id, action: 'created',
          title: `Account created for ${user.email}`, actorId: adminId, actorName: 'Platform admin',
        });
      }
      return { ...user, workspaceId: workspace?.id || null };
    });
  } catch (error) {
    if (error.code === 'P2002') throw new HttpError(409, 'An account with this email already exists');
    throw error;
  }
}

async function deleteAccount(adminId, userId) {
  if (adminId === userId) throw new HttpError(403, 'You cannot delete your own admin account');
  return prisma.$transaction(async (tx) => {
    const [target, ownedWorkspaces, admin] = await Promise.all([
      tx.user.findUnique({ where: { id: userId } }),
      tx.workspace.findMany({ where: { ownerId: userId }, select: { id: true } }),
      tx.user.findUnique({ where: { id: adminId }, select: { displayName: true, email: true } }),
    ]);
    if (!target) throw new HttpError(404, 'User account not found');

    for (const workspace of ownedWorkspaces) {
      await tx.membership.upsert({
        where: { userId_workspaceId: { userId: adminId, workspaceId: workspace.id } },
        update: { role: 'QA_LEAD', scope: 'WORKSPACE' },
        create: { userId: adminId, workspaceId: workspace.id, role: 'QA_LEAD', scope: 'WORKSPACE' },
      });
      const linked = await tx.teamMember.updateMany({
        where: { workspaceId: workspace.id, userId: adminId },
        data: { name: admin.displayName, email: admin.email, role: 'QA_LEAD', status: 'active', deleted: false, deletedAt: null },
      });
      if (linked.count === 0) {
        await tx.teamMember.create({
          data: { workspaceId: workspace.id, userId: adminId, name: admin.displayName, email: admin.email, role: 'QA_LEAD' },
        });
      }
      await tx.workspace.update({ where: { id: workspace.id }, data: { ownerId: adminId } });
    }

    const members = await tx.teamMember.findMany({ where: { userId }, select: { id: true, workspaceId: true } });
    const memberIds = members.map((member) => member.id);
    if (memberIds.length) {
      const projects = await tx.project.findMany({
        where: { memberIds: { hasSome: memberIds } }, select: { id: true, memberIds: true },
      });
      for (const project of projects) {
        await tx.project.update({ where: { id: project.id }, data: { memberIds: project.memberIds.filter((id) => !memberIds.includes(id)) } });
      }
    }
    await tx.presence.deleteMany({ where: { userId } });
    await tx.invitation.updateMany({ where: { email: target.email, status: 'PENDING' }, data: { status: 'REVOKED' } });
    await tx.invitation.updateMany({ where: { createdById: userId, status: 'PENDING' }, data: { status: 'REVOKED' } });
    await tx.teamMember.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
    for (const workspaceId of new Set([...members.map((member) => member.workspaceId), ...ownedWorkspaces.map((workspace) => workspace.id)])) {
      await logActivity(tx, {
        workspaceId, entityType: 'member', entityId: userId, action: 'deleted',
        title: `Account deleted: ${target.email}`, actorId: adminId, actorName: admin?.displayName || 'Platform admin',
      });
    }
    return { deleted: true, userId, transferredWorkspaces: ownedWorkspaces.length };
  });
}

module.exports = { createAccount, deleteAccount };
