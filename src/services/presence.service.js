const prisma = require('../lib/prisma');
const { getProjectOrThrow } = require('./projects.service');

const STALE_MS = 30 * 1000;

async function heartbeat(workspaceId, projectId, userId, userName, currentPage) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.presence.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, userName, currentPage: currentPage || '' },
    update: { userName, currentPage: currentPage || '', lastSeenAt: new Date() },
  });
}

async function listActive(workspaceId, projectId, excludeUserId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.presence.findMany({
    where: {
      projectId,
      userId: { not: excludeUserId },
      lastSeenAt: { gte: new Date(Date.now() - STALE_MS) },
    },
  });
}

async function leave(workspaceId, projectId, userId) {
  await getProjectOrThrow(workspaceId, projectId);
  await prisma.presence.deleteMany({ where: { projectId, userId } });
}

module.exports = { heartbeat, listActive, leave };
