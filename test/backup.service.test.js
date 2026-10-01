const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = {};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const HttpError = require('../src/lib/httpError');
const {
  normalizeBackupRole,
  normalizeBackupTestCaseStatus,
  normalizeBackupTestCasePriority,
  normalizeBackupBugSeverity,
  normalizeBackupBugPriority,
  normalizeBackupBugStatus,
  normalizeBackupRetestStatus,
} = require('../src/lib/backupEnumNormalize');
const { importWorkspace } = require('../src/services/backup.service');

test('backup enum converters map frontend values and preserve canonical enum values', () => {
  assert.equal(normalizeBackupRole('QA Lead'), 'QA_LEAD');
  assert.equal(normalizeBackupRole('TESTER'), 'TESTER');

  assert.equal(normalizeBackupTestCaseStatus('Not Executed'), 'NOT_EXECUTED');
  assert.equal(normalizeBackupTestCaseStatus('NOT_EXECUTED'), 'NOT_EXECUTED');

  assert.equal(normalizeBackupTestCasePriority('Med'), 'MED');
  assert.equal(normalizeBackupTestCasePriority('MED'), 'MED');

  assert.equal(normalizeBackupBugSeverity('Major'), 'MAJOR');
  assert.equal(normalizeBackupBugSeverity('MINOR'), 'MINOR');

  assert.equal(normalizeBackupBugPriority('Med'), 'MEDIUM');
  assert.equal(normalizeBackupBugPriority('MEDIUM'), 'MEDIUM');

  assert.equal(normalizeBackupBugStatus('In review'), 'IN_REVIEW');
  assert.equal(normalizeBackupBugStatus('IN_REVIEW'), 'IN_REVIEW');

  assert.equal(normalizeBackupRetestStatus('Not Retested'), 'NOT_RETESTED');
  assert.equal(normalizeBackupRetestStatus('NOT_RETESTED'), 'NOT_RETESTED');
});

test('backup enum converters reject unsupported values', () => {
  const checks = [
    () => normalizeBackupRole('Owner'),
    () => normalizeBackupTestCaseStatus('Queued'),
    () => normalizeBackupTestCasePriority('Urgent'),
    () => normalizeBackupBugSeverity('Trivial'),
    () => normalizeBackupBugPriority('P1'),
    () => normalizeBackupBugStatus('Investigating'),
    () => normalizeBackupRetestStatus('Deferred'),
  ];
  for (const check of checks) {
    assert.throws(check, (error) => error instanceof HttpError && error.status === 400);
  }
});

test('backup import applies mapped enum values for team members, test cases, and bugs', async () => {
  const writes = [];
  const tx = {
    teamMember: {
      findFirst: async () => null,
      create: async ({ data }) => { writes.push(['teamMember', data]); },
    },
    project: {
      create: async ({ data }) => { writes.push(['project', data]); },
      deleteMany: async () => {},
    },
    testCase: { create: async ({ data }) => { writes.push(['testCase', data]); } },
    bug: { create: async ({ data }) => { writes.push(['bug', data]); } },
    testPlan: {
      create: async ({ data }) => { writes.push(['testPlan', data]); },
      updateMany: async () => {},
    },
    milestone: { create: async ({ data }) => { writes.push(['milestone', data]); } },
    requirement: { create: async ({ data }) => { writes.push(['requirement', data]); } },
    sharedStep: { create: async ({ data }) => { writes.push(['sharedStep', data]); } },
    testRun: { create: async ({ data }) => { writes.push(['testRun', data]); } },
  };
  prisma.$transaction = async (operation) => operation(tx);

  const backup = {
    app: 'qa-lab',
    version: 1,
    data: {
      teamMembers: [{ name: 'Alice', email: 'alice@example.com', role: 'QA Lead' }],
      projects: [{ id: 'p-old', name: 'Project 1', description: 'desc' }],
      projectData: {
        'p-old': {
          testCases: [{
            id: 'tc-old',
            title: 'Case',
            status: 'Not Executed',
            priority: 'Med',
          }],
          bugs: [{
            title: 'Bug',
            severity: 'Major',
            priority: 'Med',
            status: 'In review',
            retestStatus: 'Not Retested',
          }],
        },
      },
    },
  };

  await importWorkspace('workspace-1', { id: 'user-1', name: 'Actor' }, backup, 'merge');

  assert.equal(writes.find(([kind]) => kind === 'teamMember')[1].role, 'QA_LEAD');
  assert.equal(writes.find(([kind]) => kind === 'testCase')[1].status, 'NOT_EXECUTED');
  assert.equal(writes.find(([kind]) => kind === 'testCase')[1].priority, 'MED');
  assert.equal(writes.find(([kind]) => kind === 'bug')[1].severity, 'MAJOR');
  assert.equal(writes.find(([kind]) => kind === 'bug')[1].priority, 'MEDIUM');
  assert.equal(writes.find(([kind]) => kind === 'bug')[1].status, 'IN_REVIEW');
  assert.equal(writes.find(([kind]) => kind === 'bug')[1].retestStatus, 'NOT_RETESTED');
});

test('backup import rejects unsupported enum values with a clear error', async () => {
  prisma.$transaction = async (operation) => operation({
    teamMember: {
      findFirst: async () => null,
      create: async () => {},
    },
    project: {
      create: async () => {},
      deleteMany: async () => {},
    },
    testCase: { create: async () => {} },
    bug: { create: async () => {} },
    testPlan: { create: async () => {}, updateMany: async () => {} },
    milestone: { create: async () => {} },
    requirement: { create: async () => {} },
    sharedStep: { create: async () => {} },
    testRun: { create: async () => {} },
  });

  const backup = {
    app: 'qa-lab',
    version: 1,
    data: {
      teamMembers: [{ name: 'Alice', role: 'Owner' }],
      projects: [],
      projectData: {},
    },
  };

  await assert.rejects(
    importWorkspace('workspace-1', { id: 'user-1', name: 'Actor' }, backup, 'merge'),
    (error) => error instanceof HttpError
      && error.status === 400
      && error.message.includes('team member role'),
  );
});
