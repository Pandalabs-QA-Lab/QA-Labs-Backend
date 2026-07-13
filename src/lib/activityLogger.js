const prisma = require('./prisma');

/**
 * Writes an activity/audit-log row. Called internally by services on
 * create/update/delete - never exposed as a client-writable endpoint,
 * since the server is the sole source of truth for "what happened".
 */
async function logActivity(tx, {
  workspaceId,
  projectId = null,
  entityType,
  entityId = null,
  action,
  title,
  details = '',
  actorId = null,
  actorName = null,
  metadata = {},
}) {
  const client = tx || prisma;
  return client.activity.create({
    data: {
      workspaceId,
      projectId,
      entityType,
      entityId,
      action,
      title,
      details,
      actorId,
      actorName,
      metadata,
    },
  });
}

module.exports = { logActivity };
