const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');
const { getProjectOrThrow } = require('./projects.service');

async function listTestPlans(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.testPlan.findMany({ where: { projectId, deleted: false }, orderBy: { createdAt: 'asc' } });
}

async function createTestPlan(workspaceId, actor, projectId, data) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const plan = await tx.testPlan.create({
      data: { projectId, ...data, createdBy: actor.id, createdByName: actor.name },
    });
    await logActivity(tx, {
      workspaceId, projectId, entityType: 'test_plan', entityId: plan.id, action: 'created',
      title: `Test plan created: ${plan.name}`, actorId: actor.id, actorName: actor.name,
    });
    return plan;
  });
}

async function updateTestPlan(workspaceId, actor, projectId, id, data) {
  await getProjectOrThrow(workspaceId, projectId);
  const before = await prisma.testPlan.findFirst({ where: { id, projectId, deleted: false } });
  if (!before) throw new HttpError(404, 'Test plan not found');
  const updated = await prisma.testPlan.update({
    where: { id },
    data: {
      ...data,
      // Frontend sends '' (not null) to clear completedAt when reopening a
      // plan - normalize any falsy value to null for the DateTime column.
      ...(data.completedAt !== undefined ? { completedAt: data.completedAt || null } : {}),
    },
  });
  await logActivity(prisma, {
    workspaceId, projectId, entityType: 'test_plan', entityId: id, action: 'updated',
    title: `Test plan updated: ${updated.name}`, actorId: actor.id, actorName: actor.name,
    metadata: { before, after: updated },
  });
  return updated;
}

// Deleting a plan orphans its runs (clears testPlanId) rather than
// deleting the runs themselves - mirrors the frontend's removePlan().
async function deleteTestPlan(workspaceId, actor, projectId, id) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const plan = await tx.testPlan.findFirst({ where: { id, projectId, deleted: false } });
    if (!plan) throw new HttpError(404, 'Test plan not found');
    await tx.testRun.updateMany({ where: { projectId, testPlanId: id }, data: { testPlanId: null } });
    await tx.testPlan.update({ where: { id }, data: { deleted: true, deletedAt: new Date() } });
    await logActivity(tx, {
      workspaceId, projectId, entityType: 'test_plan', entityId: id, action: 'deleted',
      title: `Test plan deleted: ${plan.name}`, actorId: actor.id, actorName: actor.name,
    });
  });
}

async function linkRunToPlan(workspaceId, projectId, planId, runId) {
  await getProjectOrThrow(workspaceId, projectId);
  const plan = await prisma.testPlan.findFirst({ where: { id: planId, projectId, deleted: false } });
  if (!plan) throw new HttpError(404, 'Test plan not found');
  const run = await prisma.testRun.findFirst({ where: { id: runId, projectId, deleted: false } });
  if (!run) throw new HttpError(404, 'Test run not found');
  return prisma.testRun.update({ where: { id: runId }, data: { testPlanId: planId } });
}

module.exports = { listTestPlans, createTestPlan, updateTestPlan, deleteTestPlan, linkRunToPlan };
