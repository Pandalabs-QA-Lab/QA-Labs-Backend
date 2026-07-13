const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');
const { getProjectOrThrow } = require('./projects.service');

async function listRequirements(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.requirement.findMany({ where: { projectId, deleted: false }, orderBy: { createdAt: 'asc' } });
}

async function createRequirement(workspaceId, actor, projectId, data) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const req = await tx.requirement.create({
      data: { projectId, ...data, createdBy: actor.id, createdByName: actor.name },
    });
    await logActivity(tx, {
      workspaceId, projectId, entityType: 'requirement', entityId: req.id, action: 'created',
      title: `Requirement created: ${req.title}`, actorId: actor.id, actorName: actor.name,
    });
    return req;
  });
}

async function bulkCreateRequirements(workspaceId, actor, projectId, rows) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const row of rows) {
      created.push(await tx.requirement.create({
        data: { projectId, ...row, createdBy: actor.id, createdByName: actor.name },
      }));
    }
    await logActivity(tx, {
      workspaceId, projectId, entityType: 'requirement', action: 'created',
      title: `Bulk imported ${created.length} requirement(s)`, actorId: actor.id, actorName: actor.name,
    });
    return created;
  });
}

async function updateRequirement(workspaceId, actor, projectId, id, data) {
  await getProjectOrThrow(workspaceId, projectId);
  const before = await prisma.requirement.findFirst({ where: { id, projectId, deleted: false } });
  if (!before) throw new HttpError(404, 'Requirement not found');
  const updated = await prisma.requirement.update({ where: { id }, data });
  await logActivity(prisma, {
    workspaceId, projectId, entityType: 'requirement', entityId: id, action: 'updated',
    title: `Requirement updated: ${updated.title}`, actorId: actor.id, actorName: actor.name,
    metadata: { before, after: updated },
  });
  return updated;
}

async function deleteRequirement(workspaceId, actor, projectId, id) {
  await getProjectOrThrow(workspaceId, projectId);
  const req = await prisma.requirement.findFirst({ where: { id, projectId, deleted: false } });
  if (!req) throw new HttpError(404, 'Requirement not found');
  await prisma.requirement.update({ where: { id }, data: { deleted: true, deletedAt: new Date() } });
  await logActivity(prisma, {
    workspaceId, projectId, entityType: 'requirement', entityId: id, action: 'deleted',
    title: `Requirement deleted: ${req.title}`, actorId: actor.id, actorName: actor.name,
  });
}

module.exports = { listRequirements, createRequirement, bulkCreateRequirements, updateRequirement, deleteRequirement };
