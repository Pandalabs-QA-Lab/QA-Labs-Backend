const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');

async function listTeamMembers(workspaceId, allowedTeamMemberIds) {
  return prisma.teamMember.findMany({
    where: { workspaceId, deleted: false, ...(allowedTeamMemberIds ? { id: { in: allowedTeamMemberIds } } : {}) },
    orderBy: { name: 'asc' },
  });
}

// If an email is provided, this creates a pending directory entry. Signup
// never grants access from an email match; the person must use an invite link
// and starts as a Viewer. Without an email this is a local profile.
async function createTeamMember(workspaceId, actor, data) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.teamMember.create({
      data: {
        workspaceId,
        name: data.name,
        email: data.email || null,
        role: data.role || 'VIEWER',
        status: data.email ? 'invited' : 'active',
      },
    });
    await logActivity(tx, {
      workspaceId, entityType: 'member', entityId: member.id, action: 'created',
      title: `Team member added: ${member.name}`, actorId: actor.id, actorName: actor.name,
    });
    return member;
  });
}

async function updateTeamMember(workspaceId, actor, id, data) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.teamMember.findFirst({ where: { id, workspaceId, deleted: false } });
    if (!before) throw new HttpError(404, 'Team member not found');
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    if (before.userId === workspace.ownerId && data.role && data.role !== 'QA_LEAD') {
      throw new HttpError(403, 'Workspace owner must remain a QA Lead');
    }
    if (before.userId && data.role && data.role !== 'QA_LEAD') {
      const linkedUser = await tx.user.findUnique({ where: { id: before.userId }, select: { isPlatformAdmin: true } });
      if (linkedUser?.isPlatformAdmin) throw new HttpError(403, 'Platform admins must remain QA Leads');
    }
    const updated = await tx.teamMember.update({ where: { id }, data });

    // TeamMember.role and Membership.role are separate rows (a TeamMember
    // can exist before a user ever registers). Permission checks
    // (requireRole) read Membership, so a role change must propagate
    // there too whenever this member is linked to a real user account.
    if (data.role !== undefined && before.userId) {
      await tx.membership.updateMany({
        where: { userId: before.userId, workspaceId },
        data: { role: data.role },
      });
    }

    const changes = [];
    if (data.role !== undefined && data.role !== before.role) changes.push(`role: ${before.role} -> ${data.role}`);
    if (data.name !== undefined && data.name !== before.name) changes.push(`name: ${before.name} -> ${data.name}`);
    if (changes.length > 0) {
      await logActivity(tx, {
        workspaceId, entityType: 'member', entityId: id, action: 'updated',
        title: `Team member updated: ${updated.name}`, details: changes.join(', '),
        actorId: actor.id, actorName: actor.name,
      });
    }
    return updated;
  });
}

// Never deletes the underlying User account - only removes this
// workspace's TeamMember record (soft-delete tombstone).
async function deleteTeamMember(workspaceId, actor, id) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.teamMember.findFirst({ where: { id, workspaceId, deleted: false } });
    if (!member) throw new HttpError(404, 'Team member not found');
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    if (member.userId === workspace.ownerId) throw new HttpError(403, 'Workspace owner cannot be removed');
    if (member.userId) {
      const linkedUser = await tx.user.findUnique({ where: { id: member.userId }, select: { isPlatformAdmin: true } });
      if (linkedUser?.isPlatformAdmin) throw new HttpError(403, 'Platform admin access cannot be removed here');
    }
    await tx.teamMember.update({ where: { id }, data: { deleted: true, deletedAt: new Date() } });
    if (member.userId) {
      await tx.membership.deleteMany({ where: { userId: member.userId, workspaceId } });
    }
    await logActivity(tx, {
      workspaceId, entityType: 'member', entityId: id, action: 'deleted',
      title: `Team member removed: ${member.name}`, actorId: actor.id, actorName: actor.name,
    });
  });
}

async function getWorkspace(workspaceId) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new HttpError(404, 'Workspace not found');
  return workspace;
}

async function updateWorkspace(workspaceId, actor, data) {
  const updated = await prisma.workspace.update({ where: { id: workspaceId }, data: { name: data.name } });
  await logActivity(prisma, {
    workspaceId, entityType: 'workspace', entityId: workspaceId, action: 'updated',
    title: `Workspace renamed to ${updated.name}`, actorId: actor.id, actorName: actor.name,
  });
  return updated;
}

module.exports = {
  listTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  getWorkspace,
  updateWorkspace,
};
