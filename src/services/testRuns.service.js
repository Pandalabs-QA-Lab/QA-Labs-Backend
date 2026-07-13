const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');
const { getProjectOrThrow } = require('./projects.service');
const { computeRunCounts } = require('../lib/testRunCounts');

async function listTestRuns(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.testRun.findMany({ where: { projectId, deleted: false }, orderBy: { createdAt: 'desc' } });
}

async function getTestRun(workspaceId, projectId, id) {
  await getProjectOrThrow(workspaceId, projectId);
  const run = await prisma.testRun.findFirst({ where: { id, projectId, deleted: false } });
  if (!run) throw new HttpError(404, 'Test run not found');
  return run;
}

async function createTestRun(workspaceId, actor, projectId, data) {
  await getProjectOrThrow(workspaceId, projectId);
  const counts = computeRunCounts(data.cases || []);
  return prisma.$transaction(async (tx) => {
    const run = await tx.testRun.create({
      data: {
        projectId,
        name: data.name,
        build: data.build || '',
        environment: data.environment || '',
        notes: data.notes || '',
        cases: data.cases || [],
        linkedBugIds: data.linkedBugIds || [],
        bugsLogged: (data.linkedBugIds || []).length,
        completedAt: data.completedAt ? new Date(data.completedAt) : new Date(),
        executedById: actor.id,
        executedByName: actor.name,
        ...counts,
      },
    });
    await logActivity(tx, {
      workspaceId,
      projectId,
      entityType: 'test_run',
      entityId: run.id,
      action: 'run_completed',
      title: `Test run completed: ${run.name} (${counts.passed}/${counts.total} passed)`,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { after: run },
    });
    return run;
  });
}

async function updateTestRun(workspaceId, actor, projectId, id, data) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const before = await tx.testRun.findFirst({ where: { id, projectId, deleted: false } });
    if (!before) throw new HttpError(404, 'Test run not found');
    const nextCases = data.cases !== undefined ? data.cases : before.cases;
    const counts = data.cases !== undefined ? computeRunCounts(nextCases) : {};
    const updated = await tx.testRun.update({
      where: { id },
      data: {
        ...data,
        ...(data.completedAt ? { completedAt: new Date(data.completedAt) } : {}),
        ...counts,
        ...(data.linkedBugIds !== undefined ? { bugsLogged: data.linkedBugIds.length } : {}),
      },
    });
    return updated;
  });
}

async function getRunDraft(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.runDraft.findUnique({ where: { projectId } });
}

async function saveRunDraft(workspaceId, projectId, data) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.runDraft.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: { ...data },
  });
}

async function deleteRunDraft(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  await prisma.runDraft.deleteMany({ where: { projectId } });
}

module.exports = { listTestRuns, getTestRun, createTestRun, updateTestRun, getRunDraft, saveRunDraft, deleteRunDraft };
