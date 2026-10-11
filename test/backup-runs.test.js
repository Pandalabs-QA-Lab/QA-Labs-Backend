const test = require('node:test');
const assert = require('node:assert/strict');

const restoredRuns = [];
const restoredPlans = [];
const restoredRequirements = [];
const restoredBugs = [];
const tx = {
  project: { create: async () => ({}) },
  testRun: { create: async ({ data }) => { restoredRuns.push(data); return data; } },
  testPlan: { create: async ({ data }) => { restoredPlans.push(data); return data; } },
  requirement: { create: async ({ data }) => { restoredRequirements.push(data); return data; } },
  bug: { create: async ({ data }) => { restoredBugs.push(data); return data; } },
};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = {
  id: prismaPath, filename: prismaPath, loaded: true,
  exports: { $transaction: async (callback) => callback(tx) },
};
const { importWorkspace } = require('../src/services/backup.service');

test('backup restore preserves execution dates, runner, and extended status counts', async () => {
  const run = {
    name: 'Imported checkout', date: '2026-09-20T09:00:00Z', completedAt: '2026-09-20T10:00:00Z',
    executedByName: 'Tester', total: 4, reported: 1, inProgress: 1, hold: 1, needClarification: 1,
  };
  await importWorkspace('workspace', { id: 'admin', name: 'Admin' }, {
    data: { projects: [{ id: 'old', name: 'Shop' }], projectData: { old: { runs: [run] } } },
  }, 'merge');
  const restored = restoredRuns[0];
  assert.equal(restored.date.toISOString(), '2026-09-20T09:00:00.000Z');
  assert.equal(restored.completedAt.toISOString(), '2026-09-20T10:00:00.000Z');
  assert.equal(restored.executedByName, 'Tester');
  for (const key of ['reported', 'inProgress', 'hold', 'needClarification']) assert.equal(restored[key], 1);
});

test('restore remaps plan requirement scope and run bug links to the restored records', async () => {
  await importWorkspace('workspace', { id: 'admin', name: 'Admin' }, {
    data: { projects: [{ id: 'old', name: 'Shop' }], projectData: { old: {
      requirements: [{ id: 'req-old', title: 'Checkout', testCaseIds: [] }],
      testPlans: [{ id: 'plan-old', name: 'Release', requirementIds: ['req-old'] }],
      bugs: [{ id: 'bug-old', title: 'Failed checkout' }],
      runs: [{ name: 'Checkout run', testPlanId: 'plan-old', linkedBugIds: ['bug-old'] }],
    } } },
  }, 'merge');
  assert.deepEqual(restoredPlans.at(-1).requirementIds, [restoredRequirements.at(-1).id]);
  assert.notEqual(restoredRequirements.at(-1).id, 'req-old');
  assert.equal(restoredRuns.at(-1).testPlanId, restoredPlans.at(-1).id);
  assert.deepEqual(restoredRuns.at(-1).linkedBugIds, [restoredBugs.at(-1).id]);
  assert.equal(restoredRuns.at(-1).bugsLogged, 1);
});

test('legacy backups without completion dates remain undated rather than inventing completion', async () => {
  await importWorkspace('workspace', { id: 'admin', name: 'Admin' }, {
    data: { projects: [{ id: 'old', name: 'Shop' }], projectData: { old: { runs: [{ name: 'Legacy run' }] } } },
  }, 'merge');
  assert.equal(restoredRuns.at(-1).completedAt, null);
});

test('malformed dates, duplicate records, and future versions are rejected before restore', async () => {
  const backup = { data: { projects: [{ id: 'old', name: 'Shop' }], projectData: { old: { runs: [{ id: 'run', name: 'Run', completedAt: 'bad date' }] } } } };
  await assert.rejects(importWorkspace('workspace', {}, backup, 'replace'), /Invalid completedAt/);
  backup.data.projectData.old.runs = [{ id: 'run' }, { id: 'run' }];
  await assert.rejects(importWorkspace('workspace', {}, backup, 'merge'), /duplicate runs/);
  backup.version = 99;
  await assert.rejects(importWorkspace('workspace', {}, backup, 'merge'), /newer/);
});
