const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');
const { getProjectOrThrow } = require('./projects.service');
const { nextBugId, isValidBugId } = require('../lib/idGenerators');
const {
  normalizeBugSeverity, normalizeBugPriority, normalizeBugStatus, normalizeRetestStatus,
} = require('../lib/statusNormalize');
const { describeChanges } = require('../lib/describeChanges');
const { historyEntry } = require('../lib/historyEntry');
const { sendNotification } = require('../lib/notifier');
const { withRetry } = require('../lib/withRetry');

const TRACKED_FIELDS = [
  'title', 'description', 'module', 'severity', 'priority', 'status',
  'stepsToReproduce', 'expected', 'actual', 'environment', 'build',
  'fixedInBuild', 'assignedTo', 'retestStatus', 'devRemarks', 'qaRemarks',
];

function normalize(data) {
  const next = { ...data };
  if (next.severity !== undefined) next.severity = normalizeBugSeverity(next.severity);
  if (next.priority !== undefined) next.priority = normalizeBugPriority(next.priority);
  if (next.status !== undefined) next.status = normalizeBugStatus(next.status);
  if (next.retestStatus !== undefined) next.retestStatus = normalizeRetestStatus(next.retestStatus);
  return next;
}

async function listBugs(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.bug.findMany({ where: { projectId, deleted: false }, orderBy: { createdAt: 'desc' } });
}

async function getBug(workspaceId, projectId, id) {
  await getProjectOrThrow(workspaceId, projectId);
  const bug = await prisma.bug.findFirst({ where: { id, projectId, deleted: false } });
  if (!bug) throw new HttpError(404, 'Bug not found');
  return bug;
}

async function assignCanonicalId(tx, projectId, module, providedId) {
  if (isValidBugId(providedId)) return providedId;
  const existing = await tx.bug.findMany({ where: { projectId }, select: { sourceBugId: true } });
  return nextBugId(module, existing.map((r) => r.sourceBugId));
}

// linkedTestCaseId is a real FK; verify it belongs to the same project so
// a bug can never link to another project's/workspace's test case.
async function validateLinkedTestCase(tx, projectId, linkedTestCaseId) {
  if (!linkedTestCaseId) return null;
  const tc = await tx.testCase.findFirst({ where: { id: linkedTestCaseId, projectId } });
  if (!tc) throw new HttpError(400, 'linkedTestCaseId does not belong to this project');
  return linkedTestCaseId;
}

async function createBug(workspaceId, actor, projectId, data) {
  await getProjectOrThrow(workspaceId, projectId);
  const normalized = normalize(data);
  return withRetry(() => prisma.$transaction(async (tx) => {
    const sourceBugId = await assignCanonicalId(tx, projectId, normalized.module, normalized.sourceBugId);
    const linkedTestCaseId = await validateLinkedTestCase(tx, projectId, normalized.linkedTestCaseId);
    const bug = await tx.bug.create({
      data: {
        projectId,
        sourceBugId,
        title: normalized.title,
        description: normalized.description || '',
        module: normalized.module || '',
        severity: normalized.severity || 'MINOR',
        priority: normalized.priority || 'MEDIUM',
        status: normalized.status || 'OPEN',
        stepsToReproduce: normalized.stepsToReproduce || '',
        expected: normalized.expected || '',
        actual: normalized.actual || '',
        environment: normalized.environment || '',
        build: normalized.build || '',
        fixedInBuild: normalized.fixedInBuild || '',
        assignedTo: normalized.assignedTo || '',
        reportedBy: normalized.reportedBy || actor.id,
        reportedByName: normalized.reportedByName || actor.name,
        reportedDate: normalized.reportedDate || new Date().toISOString().slice(0, 10),
        retestStatus: normalized.retestStatus || 'NOT_RETESTED',
        devRemarks: normalized.devRemarks || '',
        qaRemarks: normalized.qaRemarks || '',
        linkedTestCaseId,
        linkedRequirementId: normalized.linkedRequirementId || null,
        evidenceLinks: normalized.evidenceLinks || [],
        linkedBugIds: normalized.linkedBugIds || [],
        tags: normalized.tags || [],
        createdBy: actor.id,
        createdByName: actor.name,
        updatedBy: actor.id,
        updatedByName: actor.name,
      },
    });
    await logActivity(tx, {
      workspaceId,
      projectId,
      entityType: 'bug',
      entityId: bug.id,
      action: 'created',
      title: `Bug reported: ${bug.sourceBugId} - ${bug.title}`,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { after: bug },
    });
    if (bug.assignedTo) {
      await sendNotification(tx, {
        workspaceId,
        recipient: bug.assignedTo,
        sender: actor.name,
        type: 'bug_assigned',
        entityId: bug.id,
        entityName: bug.sourceBugId,
        message: `${actor.name} assigned you bug ${bug.sourceBugId}: ${bug.title}`,
        projectId,
      });
    }
    return bug;
  }));
}

async function bulkCreateBugs(workspaceId, actor, projectId, rows) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.bug.findMany({ where: { projectId }, select: { sourceBugId: true } });
    const usedIds = existing.map((r) => r.sourceBugId);
    const created = [];
    for (const row of rows) {
      const normalized = normalize(row);
      const sourceBugId = isValidBugId(normalized.sourceBugId) ? normalized.sourceBugId : nextBugId(normalized.module, usedIds);
      usedIds.push(sourceBugId);
      const bug = await tx.bug.create({
        data: {
          projectId,
          sourceBugId,
          title: normalized.title,
          description: normalized.description || '',
          module: normalized.module || '',
          severity: normalized.severity || 'MINOR',
          priority: normalized.priority || 'MEDIUM',
          status: normalized.status || 'OPEN',
          stepsToReproduce: normalized.stepsToReproduce || '',
          expected: normalized.expected || '',
          actual: normalized.actual || '',
          environment: normalized.environment || '',
          build: normalized.build || '',
          assignedTo: normalized.assignedTo || '',
          reportedBy: actor.id,
          reportedByName: actor.name,
          reportedDate: normalized.reportedDate || new Date().toISOString().slice(0, 10),
          retestStatus: normalized.retestStatus || 'NOT_RETESTED',
          tags: normalized.tags || [],
          createdBy: actor.id,
          createdByName: actor.name,
          updatedBy: actor.id,
          updatedByName: actor.name,
        },
      });
      created.push(bug);
    }
    await logActivity(tx, {
      workspaceId,
      projectId,
      entityType: 'bug',
      action: 'created',
      title: `Bulk imported ${created.length} bug(s)`,
      actorId: actor.id,
      actorName: actor.name,
    });
    return created;
  });
}

async function updateBug(workspaceId, actor, projectId, id, data) {
  await getProjectOrThrow(workspaceId, projectId);
  const normalized = normalize(data);
  return prisma.$transaction(async (tx) => {
    const before = await tx.bug.findFirst({ where: { id, projectId, deleted: false } });
    if (!before) throw new HttpError(404, 'Bug not found');

    if (normalized.linkedTestCaseId !== undefined) {
      normalized.linkedTestCaseId = await validateLinkedTestCase(tx, projectId, normalized.linkedTestCaseId);
    }

    const changes = describeChanges(before, normalized, TRACKED_FIELDS);
    const history = Array.isArray(before.history) ? [...before.history] : [];
    for (const change of changes) {
      history.push(historyEntry('update', actor.name, `${change.field} changed`, change.from, change.to));
    }

    const updated = await tx.bug.update({
      where: { id },
      data: { ...normalized, history, updatedBy: actor.id, updatedByName: actor.name },
    });

    if (changes.length > 0) {
      const statusChanged = changes.some((c) => c.field === 'status');
      const priorityChanged = changes.some((c) => c.field === 'priority');
      const severityChanged = changes.some((c) => c.field === 'severity');
      const action = statusChanged ? 'status_changed' : priorityChanged ? 'priority_changed' : severityChanged ? 'severity_changed' : 'updated';
      await logActivity(tx, {
        workspaceId,
        projectId,
        entityType: 'bug',
        entityId: id,
        action,
        title: `Bug updated: ${updated.sourceBugId} - ${updated.title}`,
        details: changes.map((c) => `${c.field}: "${c.from}" -> "${c.to}"`).join(', '),
        actorId: actor.id,
        actorName: actor.name,
        metadata: { before, after: updated },
      });
    }

    const assigneeChange = changes.find((c) => c.field === 'assignedTo');
    if (assigneeChange && assigneeChange.to) {
      await sendNotification(tx, {
        workspaceId,
        recipient: assigneeChange.to,
        sender: actor.name,
        type: 'bug_assigned',
        entityId: updated.id,
        entityName: updated.sourceBugId,
        message: `${actor.name} assigned you bug ${updated.sourceBugId}: ${updated.title}`,
        projectId,
      });
    }
    return updated;
  });
}

// Strips a deleted bug's id out of every TestRun's linkedBugIds/cases[] and
// the project's active RunDraft, so no stale references linger after
// deletion. Runs inside the same transaction as the delete itself.
async function cleanupBugReferences(tx, projectId, bugId) {
  if (!tx.testRun) return; // TestRun/RunDraft models land in Stage 5
  const runs = await tx.testRun.findMany({ where: { projectId, deleted: false } });
  for (const run of runs) {
    const linkedBugIds = (run.linkedBugIds || []).filter((id) => id !== bugId);
    const cases = Array.isArray(run.cases)
      ? run.cases.map((c) => {
        if (c.bugId === bugId || c.linkedBugId === bugId || (c.linkedBugIds || []).includes(bugId)) {
          return {
            ...c,
            bugId: c.bugId === bugId ? null : c.bugId,
            linkedBugId: c.linkedBugId === bugId ? null : c.linkedBugId,
            linkedBugIds: (c.linkedBugIds || []).filter((id) => id !== bugId),
          };
        }
        return c;
      })
      : run.cases;
    if (linkedBugIds.length !== (run.linkedBugIds || []).length || cases !== run.cases) {
      await tx.testRun.update({
        where: { id: run.id },
        data: { linkedBugIds, cases, bugsLogged: linkedBugIds.length },
      });
    }
  }

  const draft = await tx.runDraft.findUnique({ where: { projectId } });
  if (draft) {
    const loggedBugIds = (draft.loggedBugIds || []).filter((id) => id !== bugId);
    const results = { ...(draft.results || {}) };
    let changed = loggedBugIds.length !== (draft.loggedBugIds || []).length;
    for (const caseId of Object.keys(results)) {
      if (results[caseId]?.bugId === bugId) {
        results[caseId] = { ...results[caseId], bugId: null };
        changed = true;
      }
    }
    if (changed) {
      await tx.runDraft.update({
        where: { projectId },
        data: { loggedBugIds, results, bugsLogged: loggedBugIds.length },
      });
    }
  }
}

async function deleteBug(workspaceId, actor, projectId, id) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const bug = await tx.bug.findFirst({ where: { id, projectId, deleted: false } });
    if (!bug) throw new HttpError(404, 'Bug not found');
    await tx.bug.update({ where: { id }, data: { deleted: true, deletedAt: new Date() } });
    await cleanupBugReferences(tx, projectId, id);
    await logActivity(tx, {
      workspaceId,
      projectId,
      entityType: 'bug',
      entityId: id,
      action: 'deleted',
      title: `Bug deleted: ${bug.sourceBugId} - ${bug.title}`,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { before: bug },
    });
  });
}

module.exports = { listBugs, getBug, createBug, bulkCreateBugs, updateBug, deleteBug };
