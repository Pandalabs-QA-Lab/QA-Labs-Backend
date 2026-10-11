const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
process.env.JWT_SECRET = 'test-secret-only-for-local-unit-tests';

const prisma = {};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const addressed = require('../src/services/addressedInvites.service');
const { enforceProjectScope } = require('../src/middleware/workspaceScope');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

test('project invitation is bound to its email and creates scoped Viewer access', async () => {
  const invite = { id: 'invite-1', status: 'PENDING', email: 'invitee@example.com', kind: 'PROJECT',
    workspaceId: 'workspace-1', projectId: 'project-1', expiresAt: new Date(Date.now() + 60000) };
  let savedMembership;
  let savedMembers;
  prisma.$transaction = async (operation) => operation({
    invitation: { updateMany: async () => ({ count: 1 }) },
    workspace: { findUniqueOrThrow: async () => ({ id: 'workspace-1', name: 'QA Team' }) },
    teamMember: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 'member-1', ...data }),
    },
    membership: {
      findUnique: async () => null,
      create: async ({ data }) => { savedMembership = data; },
    },
    project: {
      findFirst: async () => ({ id: 'project-1', name: 'Mobile', memberIds: [] }),
      update: async ({ data }) => { savedMembers = data.memberIds; },
    },
    activity: { create: async () => {} },
  });
  await assert.rejects(addressed.accept(invite, { id: 'user-1', name: 'Wrong', email: 'wrong@example.com' }),
    (error) => error.status === 403);
  const result = await addressed.accept(invite, { id: 'user-1', name: 'Invitee', email: 'Invitee@Example.com' });
  assert.equal(result.scope, 'PROJECT');
  assert.equal(savedMembership.role, 'VIEWER');
  assert.equal(savedMembership.scope, 'PROJECT');
  assert.deepEqual(savedMembers, ['member-1']);
});

test('project-scoped account sees only assigned projects and cannot open another project', async () => {
  prisma.teamMember = { findFirst: async () => ({ id: 'member-1' }) };
  prisma.project = { findMany: async () => [{ id: 'project-1', memberIds: ['member-1', 'member-2'] }] };
  async function check(path) {
    const req = { membership: { scope: 'PROJECT' }, user: { id: 'user-1' }, workspaceId: 'workspace-1',
      originalUrl: `/api${path}`, method: 'GET' };
    const res = response();
    let allowed = false;
    await enforceProjectScope(req, res, () => { allowed = true; });
    return { allowed, status: res.statusCode, projects: req.allowedProjectIds, members: req.allowedTeamMemberIds };
  }
  assert.equal((await check('/projects/project-1/test-cases')).allowed, true);
  assert.equal((await check('/projects/project-2/test-cases')).status, 404);
  assert.equal((await check('/workspace')).status, 403);
  assert.deepEqual((await check('/projects')).projects, ['project-1']);
  assert.deepEqual((await check('/team-members')).members, ['member-1', 'member-2']);
});
