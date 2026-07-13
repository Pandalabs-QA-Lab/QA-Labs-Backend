const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');
const { getProjectOrThrow } = require('./projects.service');
const { nextTcId, isValidTcId } = require('../lib/idGenerators');
const { normalizeTestStatus, normalizePriority } = require('../lib/statusNormalize');
const { describeTestCaseChanges } = require('../lib/describeTestCaseChanges');
const { historyEntry } = require('../lib/historyEntry');
const { sendNotification } = require('../lib/notifier');
const { withRetry } = require('../lib/withRetry');

async function listTestCases(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.testCase.findMany({
    where: { projectId, deleted: false },
    orderBy: { createdAt: 'asc' },
  });
}

async function getTestCase(workspaceId, projectId, id) {
  await getProjectOrThrow(workspaceId, projectId);
  const tc = await prisma.testCase.findFirst({ where: { id, projectId, deleted: false } });
  if (!tc) throw new HttpError(404, 'Test case not found');
  return tc;
}

// Reading the current max ID and inserting aren't atomic against a
// concurrent transaction doing the same read, so two concurrent creates in
// the same module can still compute the same next sequence number - the
// (projectId, sourceTcId) unique constraint catches that as a P2002, which
// createTestCase retries via withRetry() to recompute against committed data.
async function assignCanonicalId(tx, projectId, module, providedId) {
  if (isValidTcId(providedId)) return providedId;
  const existing = await tx.testCase.findMany({
    where: { projectId },
    select: { sourceTcId: true },
  });
  return nextTcId(module, existing.map((r) => r.sourceTcId));
}

async function createTestCase(workspaceId, actor, projectId, data) {
  await getProjectOrThrow(workspaceId, projectId);
  return withRetry(() => prisma.$transaction(async (tx) => {
    const sourceTcId = await assignCanonicalId(tx, projectId, data.module, data.sourceTcId);
    const tc = await tx.testCase.create({
      data: {
        projectId,
        sourceTcId,
        title: data.title,
        module: data.module || '',
        folder: data.folder || '',
        scenario: data.scenario || '',
        preconditions: data.preconditions || '',
        steps: data.steps || [],
        testData: data.testData || '',
        expected: data.expected || '',
        actual: data.actual || '',
        status: normalizeTestStatus(data.status),
        priority: normalizePriority(data.priority),
        assignee: data.assignee || '',
        devRemarks: data.devRemarks || '',
        qaRemarks: data.qaRemarks || '',
        evidenceLinks: data.evidenceLinks || [],
        tags: data.tags || [],
        createdBy: actor.id,
        createdByName: actor.name,
        updatedBy: actor.id,
        updatedByName: actor.name,
      },
    });
    await logActivity(tx, {
      workspaceId,
      projectId,
      entityType: 'test_case',
      entityId: tc.id,
      action: 'created',
      title: `Test case created: ${tc.sourceTcId} - ${tc.title}`,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { after: tc },
    });
    if (tc.assignee) {
      await sendNotification(tx, {
        workspaceId,
        recipient: tc.assignee,
        sender: actor.name,
        type: 'test_case_assigned',
        entityId: tc.id,
        entityName: tc.sourceTcId,
        message: `${actor.name} assigned you test case ${tc.sourceTcId}: ${tc.title}`,
        projectId,
      });
    }
    return tc;
  }));
}

async function bulkCreateTestCases(workspaceId, actor, projectId, rows) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testCase.findMany({ where: { projectId }, select: { sourceTcId: true } });
    const usedIds = existing.map((r) => r.sourceTcId);
    const created = [];
    for (const row of rows) {
      const sourceTcId = isValidTcId(row.sourceTcId) ? row.sourceTcId : nextTcId(row.module, usedIds);
      usedIds.push(sourceTcId);
      const tc = await tx.testCase.create({
        data: {
          projectId,
          sourceTcId,
          title: row.title,
          module: row.module || '',
          folder: row.folder || '',
          scenario: row.scenario || '',
          preconditions: row.preconditions || '',
          steps: row.steps || [],
          testData: row.testData || '',
          expected: row.expected || '',
          actual: row.actual || '',
          status: normalizeTestStatus(row.status),
          priority: normalizePriority(row.priority),
          assignee: row.assignee || '',
          devRemarks: row.devRemarks || '',
          qaRemarks: row.qaRemarks || '',
          tags: row.tags || [],
          createdBy: actor.id,
          createdByName: actor.name,
          updatedBy: actor.id,
          updatedByName: actor.name,
        },
      });
      created.push(tc);
    }
    await logActivity(tx, {
      workspaceId,
      projectId,
      entityType: 'test_case',
      action: 'created',
      title: `Bulk imported ${created.length} test case(s)`,
      actorId: actor.id,
      actorName: actor.name,
    });
    return created;
  });
}

async function updateTestCase(workspaceId, actor, projectId, id, data) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const before = await tx.testCase.findFirst({ where: { id, projectId, deleted: false } });
    if (!before) throw new HttpError(404, 'Test case not found');

    const nextData = { ...data };
    if (nextData.status !== undefined) nextData.status = normalizeTestStatus(nextData.status);
    if (nextData.priority !== undefined) nextData.priority = normalizePriority(nextData.priority);

    const changes = describeTestCaseChanges(before, nextData);
    const history = Array.isArray(before.history) ? [...before.history] : [];
    for (const change of changes) {
      history.push(historyEntry('update', actor.name, `${change.field} changed`, change.from, change.to));
    }

    const updated = await tx.testCase.update({
      where: { id },
      data: {
        ...nextData,
        history,
        updatedBy: actor.id,
        updatedByName: actor.name,
      },
    });

    const statusChanged = changes.some((c) => c.field === 'status');
    if (changes.length > 0) {
      await logActivity(tx, {
        workspaceId,
        projectId,
        entityType: 'test_case',
        entityId: id,
        action: statusChanged ? 'status_changed' : 'updated',
        title: `Test case updated: ${updated.sourceTcId} - ${updated.title}`,
        details: changes.map((c) => `${c.field}: "${c.from}" -> "${c.to}"`).join(', '),
        actorId: actor.id,
        actorName: actor.name,
        metadata: { before, after: updated },
      });
    }

    const assigneeChange = changes.find((c) => c.field === 'assignee');
    if (assigneeChange && assigneeChange.to) {
      await sendNotification(tx, {
        workspaceId,
        recipient: assigneeChange.to,
        sender: actor.name,
        type: 'test_case_assigned',
        entityId: updated.id,
        entityName: updated.sourceTcId,
        message: `${actor.name} assigned you test case ${updated.sourceTcId}: ${updated.title}`,
        projectId,
      });
    }
    return updated;
  });
}

async function deleteTestCase(workspaceId, actor, projectId, id) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const tc = await tx.testCase.findFirst({ where: { id, projectId, deleted: false } });
    if (!tc) throw new HttpError(404, 'Test case not found');
    await tx.testCase.update({ where: { id }, data: { deleted: true, deletedAt: new Date() } });
    await logActivity(tx, {
      workspaceId,
      projectId,
      entityType: 'test_case',
      entityId: id,
      action: 'deleted',
      title: `Test case deleted: ${tc.sourceTcId} - ${tc.title}`,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { before: tc },
    });
  });
}

async function deleteTestCases(workspaceId, actor, projectId, ids) {
  for (const id of ids) {
    await deleteTestCase(workspaceId, actor, projectId, id);
  }
}

module.exports = {
  listTestCases,
  getTestCase,
  createTestCase,
  bulkCreateTestCases,
  updateTestCase,
  deleteTestCase,
  deleteTestCases,
};
