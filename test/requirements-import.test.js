const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
process.env.JWT_SECRET = 'test-secret-only-for-local-unit-tests';

const prisma = {
  project: { findFirst: async () => ({ id: 'project-1', workspaceId: 'workspace-1' }) },
  requirement: { findFirst: async () => ({ id: 'req-1', projectId: 'project-1', title: 'Checkout' }) },
  testCase: { count: async () => 0 },
};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const service = require('../src/services/requirements.service');
const { createRequirementSchema } = require('../src/validators/requirements.validators');

test('requirement payload keeps separate acceptance criteria', () => {
  const parsed = createRequirementSchema.parse({ title: 'Card payment', acceptanceCriteria: ['Valid card succeeds', 'Declined card creates no order'] });
  assert.deepEqual(parsed.acceptanceCriteria, ['Valid card succeeds', 'Declined card creates no order']);
});

test('requirements cannot link a test case outside their project', async () => {
  await assert.rejects(
    service.updateRequirement('workspace-1', { id: 'user-1', name: 'Lead' }, 'project-1', 'req-1', { testCaseIds: ['case-in-other-project'] }),
    (error) => error.status === 400 && error.message.includes('do not belong to this project'),
  );
});
