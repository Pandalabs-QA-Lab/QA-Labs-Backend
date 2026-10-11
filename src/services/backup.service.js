const crypto = require('crypto');
const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { normalizeTestStatus, normalizePriority, normalizeBugSeverity, normalizeBugPriority, normalizeBugStatus, normalizeRetestStatus } = require('../lib/statusNormalize');

const BACKUP_APP = 'qa-lab';
const BACKUP_VERSION = 1;

async function exportWorkspace(workspaceId, actor) {
  const [teamMembers, projects] = await Promise.all([
    prisma.teamMember.findMany({ where: { workspaceId, deleted: false } }),
    prisma.project.findMany({ where: { workspaceId, deleted: false } }),
  ]);

  const projectData = {};
  for (const project of projects) {
    const [testCases, bugs, runs, requirements, testPlans, milestones, sharedSteps, folders] = await Promise.all([
      prisma.testCase.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.bug.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.testRun.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.requirement.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.testPlan.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.milestone.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.sharedStep.findMany({ where: { projectId: project.id } }),
      prisma.projectFolder.findMany({ where: { projectId: project.id } }),
    ]);
    projectData[project.id] = { testCases, bugs, runs, requirements, testPlans, milestones, sharedSteps, folders };
  }

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { currentUser: actor.name, teamMembers, projects, projectData },
  };
}

function validateBackup(backup) {
  if (!backup || typeof backup !== 'object') throw new HttpError(400, 'Invalid backup file');
  if (!backup.data || !Array.isArray(backup.data.projects)) throw new HttpError(400, 'Backup is missing project data');
  if (backup.app && !['qa-lab', 'qa-manager'].includes(backup.app)) throw new HttpError(400, 'This is not a QA Lab backup');
  if (backup.version && backup.version > BACKUP_VERSION) throw new HttpError(400, 'Backup version is newer than this server supports');
  const ids = new Set();
  for (const project of backup.data.projects) {
    if (!project?.id || !project.name || ids.has(project.id)) throw new HttpError(400, 'Backup contains an invalid or duplicate project');
    ids.add(project.id);
    const data = backup.data.projectData?.[project.id] || {};
    for (const key of ['testCases', 'bugs', 'runs', 'requirements', 'testPlans', 'milestones', 'sharedSteps', 'folders']) {
      if (data[key] !== undefined && !Array.isArray(data[key])) throw new HttpError(400, `Invalid ${key} list in ${project.name}`);
      const entityIds = new Set();
      for (const row of data[key] || []) {
        if (!row || typeof row !== 'object' || (row.id && entityIds.has(row.id))) throw new HttpError(400, `Invalid or duplicate ${key} record`);
        if (row.id) entityIds.add(row.id);
        for (const field of ['date', 'completedAt', 'dueDate', 'createdAt', 'updatedAt']) {
          if (row[field] && Number.isNaN(new Date(row[field]).getTime())) throw new HttpError(400, `Invalid ${field} in ${key}`);
        }
      }
    }
  }
  return backup;
}

function timestamps(record) {
  return Object.fromEntries(['createdAt', 'updatedAt'].filter((key) => record[key]).map((key) => [key, new Date(record[key])]));
}

// Always regenerates IDs and remaps internal cross-references (bug ->
// linkedTestCaseId, testPlan <-> milestone, run -> testPlanId, run
// cases[].testCaseId) so restoring never collides with existing rows
// and stays internally consistent, whether merging into existing data
// or restoring into an empty workspace.
async function importWorkspace(workspaceId, actor, backup, mode) {
  validateBackup(backup);
  if (!['merge', 'replace'].includes(mode)) throw new HttpError(400, 'Choose merge or replace');

  const { projects = [], projectData = {}, teamMembers = [] } = backup.data;

  return prisma.$transaction(async (tx) => {
    if (mode === 'replace') {
      await tx.project.deleteMany({ where: { workspaceId } });
    }
    for (const member of teamMembers) {
      const existing = await tx.teamMember.findFirst({ where: { workspaceId, name: member.name, deleted: false } });
      if (!existing) {
        await tx.teamMember.create({
          data: { workspaceId, name: member.name, email: member.email || null, role: member.role || 'VIEWER' },
        });
      }
    }

    let importedProjects = 0;
    let importedEntities = 0;

    for (const oldProject of projects) {
      const newProjectId = crypto.randomUUID();
      await tx.project.create({
        data: {
          id: newProjectId,
          workspaceId,
          name: oldProject.name,
          description: oldProject.description || '',
          memberIds: [],
          createdBy: actor.id,
          createdByName: actor.name,
        },
      });
      importedProjects += 1;

      const data = projectData[oldProject.id] || {};
      const tcIdMap = new Map();
      const folderIdMap = new Map();
      const planIdMap = new Map();
      const milestoneIdMap = new Map();
      const requirementIdMap = new Map();
      const bugIdMap = new Map();
      const sharedStepIdMap = new Map();

      for (const tc of data.testCases || []) {
        const newId = crypto.randomUUID();
        tcIdMap.set(tc.id, newId);
      }
      for (const plan of data.testPlans || []) planIdMap.set(plan.id, crypto.randomUUID());
      for (const ms of data.milestones || []) milestoneIdMap.set(ms.id, crypto.randomUUID());
      for (const req of data.requirements || []) requirementIdMap.set(req.id, crypto.randomUUID());
      for (const bug of data.bugs || []) bugIdMap.set(bug.id, crypto.randomUUID());
      for (const group of data.sharedSteps || []) sharedStepIdMap.set(group.id, crypto.randomUUID());
      const remapSteps = (steps = []) => steps.map((step) => {
        if (typeof step !== 'string' || !step.startsWith('shared_step_group:')) return step;
        const newId = sharedStepIdMap.get(step.slice('shared_step_group:'.length));
        if (!newId) throw new HttpError(400, 'Backup contains a missing shared-step block');
        return `shared_step_group:${newId}`;
      });

      const sourceFolders = new Map((data.folders || []).map((folder) => [folder.id, folder]));
      const legacyFolders = new Map();
      const importFolder = async (id, stack = new Set()) => {
        if (folderIdMap.has(id)) return folderIdMap.get(id);
        if (stack.has(id)) throw new HttpError(400, 'Backup contains a folder cycle');
        const folder = sourceFolders.get(id);
        if (!folder) return null;
        stack.add(id);
        const parentId = folder.parentId ? await importFolder(folder.parentId, stack) : null;
        stack.delete(id);
        const newId = crypto.randomUUID();
        await tx.projectFolder.create({ data: { id: newId, projectId: newProjectId, parentId, name: folder.name } });
        folderIdMap.set(id, newId);
        return newId;
      };
      for (const folder of data.folders || []) await importFolder(folder.id);

      for (const tc of data.testCases || []) {
        let folderId = folderIdMap.get(tc.folderId) || null;
        if (!folderId && tc.folder) {
          if (!legacyFolders.has(tc.folder)) {
            const root = await tx.projectFolder.findFirst({ where: { projectId: newProjectId, parentId: null, name: tc.folder } });
            const created = root || await tx.projectFolder.create({ data: { projectId: newProjectId, name: tc.folder } });
            legacyFolders.set(tc.folder, created.id);
          }
          folderId = legacyFolders.get(tc.folder);
        }
        await tx.testCase.create({
          data: {
            id: tcIdMap.get(tc.id),
            projectId: newProjectId,
            sourceTcId: tc.sourceTcId,
            title: tc.title,
            module: tc.module || '',
            folder: tc.folder || '',
            folderId,
            scenario: tc.scenario || '',
            preconditions: tc.preconditions || '',
            steps: remapSteps(tc.steps),
            testData: tc.testData || '',
            expected: tc.expected || '',
            actual: tc.actual || '',
            status: normalizeTestStatus(tc.status),
            priority: normalizePriority(tc.priority),
            assignee: tc.assignee || '',
            devRemarks: tc.devRemarks || '',
            qaRemarks: tc.qaRemarks || '',
            evidenceLinks: tc.evidenceLinks || [],
            tags: tc.tags || [],
            history: tc.history || [],
            ...timestamps(tc),
            createdBy: actor.id,
            createdByName: actor.name,
          },
        });
        importedEntities += 1;
      }

      for (const bug of data.bugs || []) {
        await tx.bug.create({
          data: {
            id: bugIdMap.get(bug.id),
            projectId: newProjectId,
            sourceBugId: bug.sourceBugId,
            title: bug.title,
            description: bug.description || '',
            module: bug.module || '',
            severity: normalizeBugSeverity(bug.severity || 'MINOR'),
            priority: normalizeBugPriority(bug.priority),
            status: normalizeBugStatus(bug.status),
            stepsToReproduce: bug.stepsToReproduce || '',
            expected: bug.expected || '',
            actual: bug.actual || '',
            environment: bug.environment || '',
            build: bug.build || '',
            fixedInBuild: bug.fixedInBuild || '',
            retestStatus: normalizeRetestStatus(bug.retestStatus),
            reportedByName: bug.reportedByName || null,
            reportedDate: bug.reportedDate || null,
            devRemarks: bug.devRemarks || '',
            qaRemarks: bug.qaRemarks || '',
            assignedTo: bug.assignedTo || '',
            linkedTestCaseId: bug.linkedTestCaseId ? tcIdMap.get(bug.linkedTestCaseId) || null : null,
            linkedRequirementId: requirementIdMap.get(bug.linkedRequirementId) || null,
            linkedBugIds: (bug.linkedBugIds || []).map((id) => bugIdMap.get(id)).filter(Boolean),
            evidenceLinks: bug.evidenceLinks || [],
            tags: bug.tags || [],
            history: bug.history || [],
            ...timestamps(bug),
            createdBy: actor.id,
            createdByName: actor.name,
          },
        });
        importedEntities += 1;
      }

      for (const plan of data.testPlans || []) {
        await tx.testPlan.create({
          data: {
            id: planIdMap.get(plan.id),
            projectId: newProjectId,
            name: plan.name,
            description: plan.description || '',
            requirementIds: (plan.requirementIds || []).map((id) => requirementIdMap.get(id)).filter(Boolean),
            testCaseIds: (plan.testCaseIds || []).map((id) => tcIdMap.get(id)).filter(Boolean),
            ...timestamps(plan),
            status: plan.status || 'Open',
            completedAt: plan.completedAt ? new Date(plan.completedAt) : null,
            createdBy: actor.id,
            createdByName: actor.name,
          },
        });
        importedEntities += 1;
      }

      for (const ms of data.milestones || []) {
        const remappedPlanIds = (ms.testPlanIds || []).map((id) => planIdMap.get(id)).filter(Boolean);
        await tx.milestone.create({
          data: {
            id: milestoneIdMap.get(ms.id),
            projectId: newProjectId,
            name: ms.name,
            description: ms.description || '',
            dueDate: ms.dueDate ? new Date(ms.dueDate) : null,
            testPlanIds: remappedPlanIds,
            status: ms.status || 'Open',
            completedAt: ms.completedAt ? new Date(ms.completedAt) : null,
            ...timestamps(ms),
            createdBy: actor.id,
            createdByName: actor.name,
          },
        });
        if (remappedPlanIds.length > 0) {
          await tx.testPlan.updateMany({
            where: { id: { in: remappedPlanIds } },
            data: { milestoneId: milestoneIdMap.get(ms.id) },
          });
        }
        importedEntities += 1;
      }

      // A plan may identify its milestone even when the legacy milestone list omitted the reverse link.
      for (const plan of data.testPlans || []) {
        if (plan.milestoneId && milestoneIdMap.has(plan.milestoneId)) {
          await tx.testPlan.update({ where: { id: planIdMap.get(plan.id) }, data: { milestoneId: milestoneIdMap.get(plan.milestoneId) } });
        }
      }

      for (const req of data.requirements || []) {
        const remappedTcIds = (req.testCaseIds || []).map((id) => tcIdMap.get(id)).filter(Boolean);
        await tx.requirement.create({
          data: {
            id: requirementIdMap.get(req.id),
            projectId: newProjectId,
            key: req.key || null,
            title: req.title,
            description: req.description || '',
            acceptanceCriteria: req.acceptanceCriteria || [],
            folderId: folderIdMap.get(req.folderId) || null,
            priority: req.priority || 'Medium',
            testCaseIds: remappedTcIds,
            ...timestamps(req),
            createdBy: actor.id,
            createdByName: actor.name,
          },
        });
        importedEntities += 1;
      }

      for (const group of data.sharedSteps || []) {
        await tx.sharedStep.create({
          data: {
            id: sharedStepIdMap.get(group.id),
            projectId: newProjectId,
            name: group.name,
            description: group.description || '',
            steps: remapSteps(group.steps),
            ...timestamps(group),
          },
        });
        importedEntities += 1;
      }

      for (const run of data.runs || []) {
        const remappedCases = (run.cases || []).map((c) => ({ ...c, testCaseId: tcIdMap.get(c.testCaseId) || null, ...(Array.isArray(c.steps) ? { steps: remapSteps(c.steps) } : {}) }));
        const linkedBugIds = (run.linkedBugIds || []).map((id) => bugIdMap.get(id)).filter(Boolean);
        await tx.testRun.create({
          data: {
            projectId: newProjectId,
            name: run.name,
            build: run.build || '',
            environment: run.environment || '',
            ...(run.date ? { date: new Date(run.date) } : {}),
            completedAt: run.completedAt ? new Date(run.completedAt) : null,
            executedByName: run.executedByName || null,
            total: run.total || 0,
            passed: run.passed || 0,
            failed: run.failed || 0,
            blocker: run.blocker || 0,
            skipped: run.skipped || 0,
            pending: run.pending || 0,
            reported: run.reported || 0,
            inProgress: run.inProgress || 0,
            hold: run.hold || 0,
            needClarification: run.needClarification || 0,
            linkedBugIds,
            bugsLogged: linkedBugIds.length,
            cases: remappedCases,
            notes: run.notes || '',
            testPlanId: run.testPlanId ? planIdMap.get(run.testPlanId) || null : null,
            ...timestamps(run),
          },
        });
        importedEntities += 1;
      }
    }

    return { importedProjects, importedEntities };
  }, { timeout: 30000 });
}

module.exports = { exportWorkspace, importWorkspace };
