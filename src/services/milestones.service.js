const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');
const { getProjectOrThrow } = require('./projects.service');

async function listMilestones(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.milestone.findMany({ where: { projectId, deleted: false }, orderBy: { createdAt: 'asc' } });
}

// Milestone.testPlanIds is the source of truth for the relationship;
// this rewrites TestPlan.milestoneId on both sides to match it -
// mirrors the frontend's syncPlanMilestoneLinks().
async function syncPlanMilestoneLinks(tx, projectId, milestoneId, testPlanIds) {
  await tx.testPlan.updateMany({
    where: { projectId, id: { in: testPlanIds } },
    data: { milestoneId },
  });
  await tx.testPlan.updateMany({
    where: { projectId, milestoneId, id: { notIn: testPlanIds.length ? testPlanIds : ['__none__'] } },
    data: { milestoneId: null },
  });
}

async function createMilestone(workspaceId, actor, projectId, data) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const milestone = await tx.milestone.create({
      data: {
        projectId,
        name: data.name,
        description: data.description || '',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        testPlanIds: data.testPlanIds || [],
        status: data.status || 'Open',
        createdBy: actor.id,
        createdByName: actor.name,
      },
    });
    if (milestone.testPlanIds.length > 0) {
      await syncPlanMilestoneLinks(tx, projectId, milestone.id, milestone.testPlanIds);
    }
    await logActivity(tx, {
      workspaceId, projectId, entityType: 'milestone', entityId: milestone.id, action: 'created',
      title: `Milestone created: ${milestone.name}`, actorId: actor.id, actorName: actor.name,
    });
    return milestone;
  });
}

async function updateMilestone(workspaceId, actor, projectId, id, data) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const before = await tx.milestone.findFirst({ where: { id, projectId, deleted: false } });
    if (!before) throw new HttpError(404, 'Milestone not found');
    const updated = await tx.milestone.update({
      where: { id },
      data: {
        ...data,
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
        // Frontend sends '' (not null) to clear completedAt when reopening a
        // milestone - normalize any falsy value to null for the DateTime column.
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt || null } : {}),
      },
    });
    if (data.testPlanIds !== undefined) {
      await syncPlanMilestoneLinks(tx, projectId, id, updated.testPlanIds);
    }
    await logActivity(tx, {
      workspaceId, projectId, entityType: 'milestone', entityId: id, action: 'updated',
      title: `Milestone updated: ${updated.name}`, actorId: actor.id, actorName: actor.name,
      metadata: { before, after: updated },
    });
    return updated;
  });
}

async function deleteMilestone(workspaceId, actor, projectId, id) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const milestone = await tx.milestone.findFirst({ where: { id, projectId, deleted: false } });
    if (!milestone) throw new HttpError(404, 'Milestone not found');
    await tx.testPlan.updateMany({ where: { projectId, milestoneId: id }, data: { milestoneId: null } });
    await tx.milestone.update({ where: { id }, data: { deleted: true, deletedAt: new Date() } });
    await logActivity(tx, {
      workspaceId, projectId, entityType: 'milestone', entityId: id, action: 'deleted',
      title: `Milestone deleted: ${milestone.name}`, actorId: actor.id, actorName: actor.name,
    });
  });
}

module.exports = { listMilestones, createMilestone, updateMilestone, deleteMilestone };
