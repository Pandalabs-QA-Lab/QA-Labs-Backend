const crypto = require('crypto');
const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');

const BACKUP_APP = 'qa-lab';
const BACKUP_VERSION = 1;

async function exportWorkspace(workspaceId, actor) {
  const [teamMembers, projects] = await Promise.all([
    prisma.teamMember.findMany({ where: { workspaceId, deleted: false } }),
    prisma.project.findMany({ where: { workspaceId, deleted: false } }),
  ]);

  const projectData = {};
  for (const project of projects) {
    const [testCases, bugs, runs, requirements, testPlans, milestones, sharedSteps] = await Promise.all([
      prisma.testCase.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.bug.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.testRun.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.requirement.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.testPlan.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.milestone.findMany({ where: { projectId: project.id, deleted: false } }),
      prisma.sharedStep.findMany({ where: { projectId: project.id } }),
    ]);
    projectData[project.id] = { testCases, bugs, runs, requirements, testPlans, milestones, sharedSteps };
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
  return backup;
}

// Always regenerates IDs and remaps internal cross-references (bug ->
// linkedTestCaseId, testPlan <-> milestone, run -> testPlanId, run
// cases[].testCaseId) so restoring never collides with existing rows
// and stays internally consistent, whether merging into existing data
// or restoring into an empty workspace.
async function importWorkspace(workspaceId, actor, backup, mode) {
  validateBackup(backup);

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
      const planIdMap = new Map();
      const milestoneIdMap = new Map();

      for (const tc of data.testCases || []) {
        const newId = crypto.randomUUID();
        tcIdMap.set(tc.id, newId);
      }
      for (const plan of data.testPlans || []) planIdMap.set(plan.id, crypto.randomUUID());
      for (const ms of data.milestones || []) milestoneIdMap.set(ms.id, crypto.randomUUID());

      for (const tc of data.testCases || []) {
        await tx.testCase.create({
          data: {
            id: tcIdMap.get(tc.id),
            projectId: newProjectId,
            sourceTcId: tc.sourceTcId,
            title: tc.title,
            module: tc.module || '',
            scenario: tc.scenario || '',
            preconditions: tc.preconditions || '',
            steps: tc.steps || [],
            testData: tc.testData || '',
            expected: tc.expected || '',
            actual: tc.actual || '',
            status: tc.status || 'NOT_EXECUTED',
            priority: tc.priority || 'MED',
            assignee: tc.assignee || '',
            devRemarks: tc.devRemarks || '',
            qaRemarks: tc.qaRemarks || '',
            evidenceLinks: tc.evidenceLinks || [],
            tags: tc.tags || [],
            history: tc.history || [],
            createdBy: actor.id,
            createdByName: actor.name,
          },
        });
        importedEntities += 1;
      }

      for (const bug of data.bugs || []) {
        await tx.bug.create({
          data: {
            projectId: newProjectId,
            sourceBugId: bug.sourceBugId,
            title: bug.title,
            description: bug.description || '',
            module: bug.module || '',
            severity: bug.severity || 'MINOR',
            priority: bug.priority || 'MEDIUM',
            status: bug.status || 'OPEN',
            stepsToReproduce: bug.stepsToReproduce || '',
            expected: bug.expected || '',
            actual: bug.actual || '',
            environment: bug.environment || '',
            build: bug.build || '',
            assignedTo: bug.assignedTo || '',
            linkedTestCaseId: bug.linkedTestCaseId ? tcIdMap.get(bug.linkedTestCaseId) || null : null,
            evidenceLinks: bug.evidenceLinks || [],
            tags: bug.tags || [],
            history: bug.history || [],
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
            status: plan.status || 'Open',
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

      for (const req of data.requirements || []) {
        const remappedTcIds = (req.testCaseIds || []).map((id) => tcIdMap.get(id)).filter(Boolean);
        await tx.requirement.create({
          data: {
            projectId: newProjectId,
            key: req.key || null,
            title: req.title,
            description: req.description || '',
            priority: req.priority || 'Medium',
            testCaseIds: remappedTcIds,
            createdBy: actor.id,
            createdByName: actor.name,
          },
        });
        importedEntities += 1;
      }

      for (const group of data.sharedSteps || []) {
        await tx.sharedStep.create({
          data: {
            projectId: newProjectId,
            name: group.name,
            description: group.description || '',
            steps: group.steps || [],
          },
        });
        importedEntities += 1;
      }

      for (const run of data.runs || []) {
        const remappedCases = (run.cases || []).map((c) => ({ ...c, testCaseId: tcIdMap.get(c.testCaseId) || c.testCaseId }));
        await tx.testRun.create({
          data: {
            projectId: newProjectId,
            name: run.name,
            build: run.build || '',
            environment: run.environment || '',
            total: run.total || 0,
            passed: run.passed || 0,
            failed: run.failed || 0,
            blocker: run.blocker || 0,
            skipped: run.skipped || 0,
            pending: run.pending || 0,
            cases: remappedCases,
            notes: run.notes || '',
            testPlanId: run.testPlanId ? planIdMap.get(run.testPlanId) || null : null,
          },
        });
        importedEntities += 1;
      }
    }

    return { importedProjects, importedEntities };
  }, { timeout: 30000 });
}

module.exports = { exportWorkspace, importWorkspace };
