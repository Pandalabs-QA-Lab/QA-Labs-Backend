// Local database integration check: only creates and removes its own disposable workspaces.
require('dotenv').config();
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const { exportWorkspace, importWorkspace } = require('../src/services/backup.service');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'This check must use a local database');
  const workspaceIds = [];
  try {
    const owner = await prisma.user.findFirst({ where: { isPlatformAdmin: true } });
    assert.ok(owner, 'Local admin is required for the disposable workspace owner');
    const source = await prisma.workspace.create({ data: { name: 'Disposable backup round-trip source', ownerId: owner.id } });
    workspaceIds.push(source.id);
    const target = await prisma.workspace.create({ data: { name: 'Disposable backup round-trip target', ownerId: owner.id } });
    workspaceIds.push(target.id);
    const actor = { id: owner.id, name: 'Round-trip verification' };
    const project = await prisma.project.create({ data: { workspaceId: source.id, name: 'Checkout verification' } });
    const parent = await prisma.projectFolder.create({ data: { projectId: project.id, name: 'Shopping' } });
    const child = await prisma.projectFolder.create({ data: { projectId: project.id, name: 'Payments', parentId: parent.id } });
    const shared = await prisma.sharedStep.create({ data: { projectId: project.id, name: 'Login', steps: ['Open login', 'Sign in'] } });
    const tc = await prisma.testCase.create({ data: {
      projectId: project.id, title: 'Declined payment', sourceTcId: 'TC-01', folderId: child.id,
      steps: [`shared_step_group:${shared.id}`, 'Submit declined card'], expected: 'No order',
      status: 'FAIL', evidenceLinks: [{ url: 'https://example.com/case-evidence' }], history: [{ action: 'created' }],
    } });
    const req = await prisma.requirement.create({ data: {
      projectId: project.id, key: 'REQ-01', title: 'Safe checkout', folderId: child.id,
      acceptanceCriteria: ['Declined card creates no order'], testCaseIds: [tc.id],
    } });
    const bug = await prisma.bug.create({ data: {
      projectId: project.id, title: 'Unexpected order', linkedTestCaseId: tc.id, linkedRequirementId: req.id,
      fixedInBuild: '2.4.1', retestStatus: 'FAILED', reportedByName: 'Tester', reportedDate: '2026-09-20',
      devRemarks: 'Fix attempted', qaRemarks: 'Still reproducible', evidenceLinks: [{ url: 'https://example.com/bug-evidence' }],
    } });
    const milestone = await prisma.milestone.create({ data: { projectId: project.id, name: 'Release', dueDate: new Date('2026-10-10') } });
    const plan = await prisma.testPlan.create({ data: {
      projectId: project.id, name: 'Checkout regression', requirementIds: [req.id], testCaseIds: [tc.id], milestoneId: milestone.id,
    } });
    await prisma.milestone.update({ where: { id: milestone.id }, data: { testPlanIds: [plan.id] } });
    await prisma.testRun.create({ data: {
      projectId: project.id, name: 'Checkout smoke', date: new Date('2026-09-20T09:00:00Z'),
      completedAt: new Date('2026-09-20T10:00:00Z'), testPlanId: plan.id, total: 1, failed: 1,
      linkedBugIds: [bug.id], bugsLogged: 1, executedByName: 'Tester',
      cases: [{ testCaseId: tc.id, title: tc.title, status: 'Fail', steps: tc.steps }],
    } });
    const original = JSON.parse(JSON.stringify(await exportWorkspace(source.id, actor)));
    const result = await importWorkspace(target.id, actor, original, 'merge');
    assert.equal(result.importedProjects, 1);
    const restored = await exportWorkspace(target.id, actor);
    const restoredProject = restored.data.projects[0];
    const data = restored.data.projectData[restoredProject.id];
    const oldData = original.data.projectData[project.id];
    for (const key of Object.keys(oldData)) assert.equal(data[key].length, oldData[key].length, `${key} count`);
    const [newCase] = data.testCases, [newReq] = data.requirements, [newBug] = data.bugs;
    const [newPlan] = data.testPlans, [newMilestone] = data.milestones, [newRun] = data.runs, [newShared] = data.sharedSteps;
    assert.notEqual(restoredProject.id, project.id);
    assert.notEqual(newCase.id, tc.id);
    assert.deepEqual(newCase.steps, [`shared_step_group:${newShared.id}`, 'Submit declined card']);
    assert.deepEqual(newCase.evidenceLinks, tc.evidenceLinks);
    assert.deepEqual(newCase.history, tc.history);
    const newChild = data.folders.find((folder) => folder.name === 'Payments');
    assert.equal(data.folders.find((folder) => folder.id === newChild.parentId).name, 'Shopping');
    assert.equal(newCase.folderId, newChild.id);
    assert.equal(newReq.folderId, newChild.id);
    assert.deepEqual(newReq.acceptanceCriteria, req.acceptanceCriteria);
    assert.deepEqual(newReq.testCaseIds, [newCase.id]);
    assert.deepEqual(newPlan.requirementIds, [newReq.id]);
    assert.deepEqual(newPlan.testCaseIds, [newCase.id]);
    assert.equal(newPlan.milestoneId, newMilestone.id);
    assert.deepEqual(newMilestone.testPlanIds, [newPlan.id]);
    assert.equal(newBug.linkedRequirementId, newReq.id);
    assert.equal(newBug.linkedTestCaseId, newCase.id);
    for (const key of ['fixedInBuild', 'retestStatus', 'reportedByName', 'reportedDate', 'devRemarks', 'qaRemarks']) assert.equal(newBug[key], bug[key]);
    assert.deepEqual(newBug.evidenceLinks, bug.evidenceLinks);
    assert.equal(newRun.testPlanId, newPlan.id);
    assert.deepEqual(newRun.linkedBugIds, [newBug.id]);
    assert.equal(newRun.cases[0].testCaseId, newCase.id);
    assert.equal(newRun.cases[0].steps[0], `shared_step_group:${newShared.id}`);
    assert.equal(newRun.date.toISOString(), '2026-09-20T09:00:00.000Z');
    assert.equal(newRun.completedAt.toISOString(), '2026-09-20T10:00:00.000Z');
    assert.equal(newCase.createdAt.toISOString(), tc.createdAt.toISOString());
    // Replace is exercised only in the disposable target, including rollback on a bad shared reference.
    const malformed = structuredClone(original);
    malformed.data.projectData[project.id].testCases[0].steps = ['shared_step_group:missing'];
    await assert.rejects(importWorkspace(target.id, actor, malformed, 'replace'), /missing shared-step/);
    assert.equal((await exportWorkspace(target.id, actor)).data.projects[0].id, restoredProject.id);
    await importWorkspace(target.id, actor, original, 'replace');
    assert.equal((await exportWorkspace(target.id, actor)).data.projects.length, 1);
    console.log('PASS: local export → JSON → merge → export preserves folders, scope, shared steps, evidence, history and run dates. Replace and failed-restore rollback also passed.');
  } finally {
    // These IDs are captured only from workspaces created by this check.
    for (const id of workspaceIds) await prisma.workspace.delete({ where: { id } });
    await prisma.$disconnect();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
