const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');

async function requestWorkspace(userId, data) {
  const pending = await prisma.workspaceRequest.findFirst({ where: { userId, status: 'PENDING' } });
  if (pending) throw new HttpError(409, 'You already have a pending request');
  return prisma.workspaceRequest.create({ data: { userId, ...data } });
}

async function myRequests(userId) {
  return prisma.workspaceRequest.findMany({
    where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
  });
}

async function listRequests() {
  return prisma.workspaceRequest.findMany({
    where: { status: 'PENDING' }, include: { user: { select: { email: true, displayName: true } } },
    orderBy: { createdAt: 'asc' }, take: 100,
  });
}

async function reviewRequest(requestId, adminId, approve) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.workspaceRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== 'PENDING') throw new HttpError(404, 'Pending request not found');
    const claimed = await tx.workspaceRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status: approve ? 'APPROVED' : 'REJECTED', reviewedAt: new Date(), reviewedById: adminId },
    });
    if (claimed.count !== 1) throw new HttpError(409, 'Request has already been reviewed');
    if (!approve) return { status: 'REJECTED' };

    const user = await tx.user.findUniqueOrThrow({ where: { id: request.userId } });
    const workspace = await tx.workspace.create({
      data: { name: request.workspaceName, ownerId: request.userId },
    });
    await tx.membership.create({
      data: { workspaceId: workspace.id, userId: user.id, role: 'QA_LEAD' },
    });
    await tx.teamMember.create({
      data: { workspaceId: workspace.id, userId: user.id, email: user.email, name: user.displayName, role: 'QA_LEAD' },
    });
    const project = await tx.project.create({
      data: { workspaceId: workspace.id, name: request.projectName, createdBy: user.id, createdByName: user.displayName },
    });
    await tx.workspaceRequest.update({ where: { id: requestId }, data: { workspaceId: workspace.id } });
    return { status: 'APPROVED', workspace: { id: workspace.id, name: workspace.name }, projectId: project.id };
  });
}

async function overview() {
  const [workspaces, users, activity, activePresence] = await Promise.all([
    prisma.workspace.findMany({
      select: { id: true, name: true, ownerId: true, createdAt: true, memberships: { select: { userId: true, role: true } }, _count: { select: { projects: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    }),
    prisma.user.findMany({ select: { id: true, email: true, displayName: true, createdAt: true, isPlatformAdmin: true, memberships: { select: { workspaceId: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.activity.findMany({ select: { id: true, workspaceId: true, actorName: true, title: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.presence.findMany({
      where: { lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      select: { userId: true, userName: true, lastSeenAt: true, projectId: true, project: { select: { name: true } } },
    }),
  ]);
  const [workspaceCount, userCount] = await Promise.all([prisma.workspace.count(), prisma.user.count()]);
  const activeUsers = [...new Map(activePresence.map((presence) => [presence.userId, presence])).values()];
  return {
    counts: { workspaces: workspaceCount, users: userCount, activeUsers: activeUsers.length },
    workspaces, users, activity, activeUsers,
  };
}

async function listAdminUsers(search = '', page = 1) {
  const where = search ? { OR: [
    { email: { contains: search, mode: 'insensitive' } },
    { displayName: { contains: search, mode: 'insensitive' } },
  ] } : {};
  const pageSize = 25;
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where, select: { id: true, email: true, displayName: true, createdAt: true, isPlatformAdmin: true,
        mustChangePassword: true, memberships: { select: { workspaceId: true, role: true, scope: true,
          workspace: { select: { name: true, ownerId: true } } } } },
      orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function listAdminWorkspaces(search = '', page = 1) {
  const where = search ? { name: { contains: search, mode: 'insensitive' } } : {};
  const pageSize = 25;
  const [items, total] = await Promise.all([
    prisma.workspace.findMany({
      where, select: { id: true, name: true, ownerId: true, createdAt: true,
        _count: { select: { memberships: true, projects: true } } },
      orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.workspace.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function changeMemberRole(workspaceId, userId, role, adminId) {
  return prisma.$transaction(async (tx) => {
    const [workspace, member, admin, target] = await Promise.all([
      tx.workspace.findUnique({ where: { id: workspaceId } }),
      tx.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } }),
      tx.user.findUnique({ where: { id: adminId } }),
      tx.user.findUnique({ where: { id: userId } }),
    ]);
    if (!workspace || !member) throw new HttpError(404, 'Workspace member not found');
    if (workspace.ownerId === userId && role !== 'QA_LEAD') {
      throw new HttpError(403, 'Workspace owner must remain a QA Lead');
    }
    if (target?.isPlatformAdmin && role !== 'QA_LEAD') {
      throw new HttpError(403, 'Platform admins must remain QA Leads');
    }
    const updated = await tx.membership.update({
      where: { userId_workspaceId: { userId, workspaceId } }, data: { role },
    });
    await tx.teamMember.updateMany({ where: { workspaceId, userId, deleted: false }, data: { role } });
    await logActivity(tx, {
      workspaceId, entityType: 'member', entityId: userId, action: 'updated',
      title: `Member role changed to ${role}`, details: `${member.role} -> ${role}`,
      actorId: adminId, actorName: admin?.displayName || 'Platform admin',
    });
    return { workspaceId, userId, role: updated.role };
  });
}

async function enterWorkspace(workspaceId, adminId) {
  return prisma.$transaction(async (tx) => {
    const [workspace, admin] = await Promise.all([
      tx.workspace.findUnique({ where: { id: workspaceId } }),
      tx.user.findUnique({ where: { id: adminId } }),
    ]);
    if (!workspace) throw new HttpError(404, 'Workspace not found');
    if (!admin?.isPlatformAdmin) throw new HttpError(403, 'Platform admin access required');

    const existing = await tx.membership.findUnique({
      where: { userId_workspaceId: { userId: adminId, workspaceId } },
    });
    await tx.membership.upsert({
      where: { userId_workspaceId: { userId: adminId, workspaceId } },
      update: { role: 'QA_LEAD', scope: 'WORKSPACE' },
      create: { userId: adminId, workspaceId, role: 'QA_LEAD', scope: 'WORKSPACE' },
    });
    const linked = await tx.teamMember.updateMany({
      where: { workspaceId, userId: adminId },
      data: { name: admin.displayName, email: admin.email, role: 'QA_LEAD', status: 'active', deleted: false, deletedAt: null },
    });
    if (linked.count === 0) {
      await tx.teamMember.create({
        data: { workspaceId, userId: adminId, name: admin.displayName, email: admin.email, role: 'QA_LEAD' },
      });
    }
    if (!existing || existing.role !== 'QA_LEAD') {
      await logActivity(tx, {
        workspaceId, entityType: 'member', entityId: adminId, action: 'updated',
        title: `Platform admin joined workspace: ${admin.displayName}`,
        actorId: adminId, actorName: admin.displayName,
      });
    }
    return { workspaceId, role: 'QA_LEAD' };
  });
}

async function removeMember(workspaceId, userId, adminId) {
  return prisma.$transaction(async (tx) => {
    const [workspace, member, target, admin] = await Promise.all([
      tx.workspace.findUnique({ where: { id: workspaceId } }),
      tx.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } }),
      tx.user.findUnique({ where: { id: userId } }),
      tx.user.findUnique({ where: { id: adminId } }),
    ]);
    if (!workspace || !member) throw new HttpError(404, 'Workspace member not found');
    if (workspace.ownerId === userId) throw new HttpError(403, 'Workspace owner cannot be removed');
    if (target?.isPlatformAdmin) throw new HttpError(403, 'Platform admin access cannot be removed here');

    await tx.membership.delete({ where: { userId_workspaceId: { userId, workspaceId } } });
    await tx.teamMember.updateMany({
      where: { workspaceId, userId, deleted: false },
      data: { deleted: true, deletedAt: new Date() },
    });
    await logActivity(tx, {
      workspaceId, entityType: 'member', entityId: userId, action: 'deleted',
      title: `Workspace access removed: ${target?.displayName || 'User'}`,
      actorId: adminId, actorName: admin?.displayName || 'Platform admin',
    });
    return { workspaceId, userId, removed: true };
  });
}

module.exports = { requestWorkspace, myRequests, listRequests, reviewRequest, overview, listAdminUsers, listAdminWorkspaces, changeMemberRole, enterWorkspace, removeMember };
