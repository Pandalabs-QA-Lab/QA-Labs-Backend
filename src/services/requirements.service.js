const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');
const { getProjectOrThrow } = require('./projects.service');
const { resolveFolderId } = require('./folders.service');

async function validateLinks(tx, projectId, testCaseIds = []) {
  const uniqueIds = [...new Set(testCaseIds)];
  if (!uniqueIds.length) return;
  const found = await tx.testCase.count({ where: { id: { in: uniqueIds }, projectId, deleted: false } });
  if (found !== uniqueIds.length) throw new HttpError(400, 'One or more linked test cases do not belong to this project');
}

async function validateKey(tx, projectId, key, exceptId = null) {
  if (!key?.trim()) return;
  const existing = await tx.requirement.findFirst({ where: {
    projectId, deleted: false, key: { equals: key.trim(), mode: 'insensitive' },
    ...(exceptId ? { id: { not: exceptId } } : {}),
  } });
  if (existing) throw new HttpError(409, `Requirement key ${key} is already used in this project`);
}

async function listRequirements(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.requirement.findMany({ where: { projectId, deleted: false }, orderBy: { createdAt: 'asc' } });
}

async function createRequirement(workspaceId, actor, projectId, data) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    await validateLinks(tx, projectId, data.testCaseIds);
    await validateKey(tx, projectId, data.key);
    const folderId = await resolveFolderId(tx, projectId, data.folderId);
    const req = await tx.requirement.create({
      data: { projectId, ...data, folderId, createdBy: actor.id, createdByName: actor.name },
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
      await validateLinks(tx, projectId, row.testCaseIds);
      await validateKey(tx, projectId, row.key);
      const folderId = await resolveFolderId(tx, projectId, row.folderId);
      created.push(await tx.requirement.create({
        data: { projectId, ...row, folderId, createdBy: actor.id, createdByName: actor.name },
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
  if (data.testCaseIds !== undefined) {
    const addedIds = data.testCaseIds.filter((caseId) => !(before.testCaseIds || []).includes(caseId));
    await validateLinks(prisma, projectId, addedIds);
  }
  if (data.key !== undefined && data.key?.trim().toLowerCase() !== before.key?.trim().toLowerCase()) {
    await validateKey(prisma, projectId, data.key, id);
  }
  if (data.folderId !== undefined) await resolveFolderId(prisma, projectId, data.folderId);
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
