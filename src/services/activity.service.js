const prisma = require('../lib/prisma');

const HISTORY_LIMIT = 1000;

async function listActivity(workspaceId, { projectId, entityType, entityId, limit, allowedProjectIds } = {}) {
  return prisma.activity.findMany({
    where: {
      workspaceId,
      ...(projectId ? { projectId } : allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || HISTORY_LIMIT, HISTORY_LIMIT),
  });
}

module.exports = { listActivity };
