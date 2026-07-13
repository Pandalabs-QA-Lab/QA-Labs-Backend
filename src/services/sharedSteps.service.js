const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { getProjectOrThrow } = require('./projects.service');

async function listSharedSteps(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.sharedStep.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
}

async function createSharedStep(workspaceId, projectId, data) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.sharedStep.create({ data: { projectId, ...data } });
}

async function updateSharedStep(workspaceId, projectId, id, data) {
  await getProjectOrThrow(workspaceId, projectId);
  const existing = await prisma.sharedStep.findFirst({ where: { id, projectId } });
  if (!existing) throw new HttpError(404, 'Shared step group not found');
  return prisma.sharedStep.update({ where: { id }, data });
}

async function deleteSharedStep(workspaceId, projectId, id) {
  await getProjectOrThrow(workspaceId, projectId);
  const existing = await prisma.sharedStep.findFirst({ where: { id, projectId } });
  if (!existing) throw new HttpError(404, 'Shared step group not found');
  await prisma.sharedStep.delete({ where: { id } }); // hard delete, matches current behavior
}

module.exports = { listSharedSteps, createSharedStep, updateSharedStep, deleteSharedStep };
