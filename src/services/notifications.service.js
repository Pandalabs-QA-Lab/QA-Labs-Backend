const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');

// Matches by TeamMember name first (recipient/sender are stored as name
// strings, matching the frontend's existing convention), falling back to
// nothing if the caller has no team-member record yet.
async function currentUserName(workspaceId, userId) {
  const member = await prisma.teamMember.findFirst({ where: { workspaceId, userId, deleted: false } });
  return member ? member.name : null;
}

function projectFilter(allowedProjectIds) {
  return allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {};
}

async function listNotifications(workspaceId, userId, allowedProjectIds) {
  const name = await currentUserName(workspaceId, userId);
  if (!name) return [];
  return prisma.notification.findMany({
    where: { workspaceId, deleted: false, recipient: { equals: name, mode: 'insensitive' }, ...projectFilter(allowedProjectIds) },
    orderBy: { createdAt: 'desc' },
  });
}

async function markAsRead(workspaceId, userId, id, allowedProjectIds) {
  const name = await currentUserName(workspaceId, userId);
  const notification = await prisma.notification.findFirst({
    where: { id, workspaceId, recipient: { equals: name || '', mode: 'insensitive' }, ...projectFilter(allowedProjectIds) },
  });
  if (!notification) throw new HttpError(404, 'Notification not found');
  return prisma.notification.update({ where: { id }, data: { read: true } });
}

async function markAllAsRead(workspaceId, userId, allowedProjectIds) {
  const name = await currentUserName(workspaceId, userId);
  if (!name) return;
  await prisma.notification.updateMany({
    where: { workspaceId, deleted: false, recipient: { equals: name, mode: 'insensitive' }, read: false, ...projectFilter(allowedProjectIds) },
    data: { read: true },
  });
}

async function clearAll(workspaceId, userId, allowedProjectIds) {
  const name = await currentUserName(workspaceId, userId);
  if (!name) return;
  await prisma.notification.updateMany({
    where: { workspaceId, deleted: false, recipient: { equals: name, mode: 'insensitive' }, ...projectFilter(allowedProjectIds) },
    data: { deleted: true, deletedAt: new Date() },
  });
}

module.exports = { listNotifications, markAsRead, markAllAsRead, clearAll };
