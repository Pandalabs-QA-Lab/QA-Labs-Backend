const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
process.env.JWT_SECRET = 'test-secret-only-for-local-unit-tests';

let membership = null;
let createdUser = null;
const prisma = {
  invitation: { findUnique: async () => null },
  user: {
    findUnique: async () => null,
    create: async ({ data }) => {
      createdUser = { id: 'user-1', ...data, isPlatformAdmin: false };
      return createdUser;
    },
  },
  membership: {
    findUnique: async () => membership,
  },
};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const auth = require('../src/services/auth.service');
const { attachWorkspace, requireWorkspaceMember, requireRole } = require('../src/middleware/workspaceScope');
const express = require('express');
const { signToken } = require('../src/lib/jwt');
const projectRoutes = require('../src/routes/projects.routes');
const testCaseRoutes = require('../src/routes/testCases.routes');
const accessRoutes = require('../src/routes/access.routes');

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('signup creates only a user account with no workspace role', async () => {
  const result = await auth.register({ email: 'New@Example.com', password: 'good-password-123', displayName: 'New User' });
  assert.equal(createdUser.email, 'new@example.com');
  assert.equal(result.workspace, null);
  assert.equal(result.role, null);
  assert.equal(result.user.isPlatformAdmin, false);
  assert.ok(result.token);
});

test('workspace APIs reject an account without a selected workspace', () => {
  const req = { user: { id: 'user-1', workspaceId: null } };
  const res = response();
  let nextCalled = false;
  attachWorkspace(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('removed membership blocks access even with an old workspace token', async () => {
  membership = null;
  const req = { user: { id: 'user-1' }, workspaceId: 'workspace-1' };
  const res = response();
  let nextCalled = false;
  await requireWorkspaceMember(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('Viewer cannot write; Tester can use execution permissions only', async () => {
  const req = { user: { id: 'user-1' }, workspaceId: 'workspace-1', membership: { role: 'VIEWER' } };
  const blocked = response();
  await requireRole('QA_LEAD', 'TESTER')(req, blocked, () => { throw new Error('Viewer allowed'); });
  assert.equal(blocked.statusCode, 403);

  req.membership.role = 'TESTER';
  const allowed = response();
  let called = false;
  await requireRole('QA_LEAD', 'TESTER')(req, allowed, () => { called = true; });
  assert.equal(called, true);
  await requireRole('QA_LEAD')(req, allowed, () => { throw new Error('Tester allowed admin action'); });
  assert.equal(allowed.statusCode, 403);
});

test('actual project route rejects Viewer writes', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 'user-1' };
    req.workspaceId = 'workspace-1';
    req.membership = { role: 'VIEWER' };
    next();
  });
  app.use('/projects', projectRoutes);
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/projects`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Denied' }),
    });
    assert.equal(response.status, 403);
  } finally { server.close(); }
});

test('Tester cannot change a test case definition through the HTTP route', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 'user-1' };
    req.workspaceId = 'workspace-1';
    req.membership = { role: 'TESTER' };
    next();
  });
  app.use('/projects/:projectId/test-cases', testCaseRoutes);
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/projects/p1/test-cases/t1`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Unauthorized edit' }),
    });
    assert.equal(response.status, 403);
  } finally { server.close(); }
});

test('platform overview rejects an ordinary signed-in user', async () => {
  prisma.user.findUnique = async () => ({ id: 'user-1', isPlatformAdmin: false, mustChangePassword: false });
  const app = express();
  app.use('/access', accessRoutes);
  const server = app.listen(0);
  try {
    const token = signToken({ userId: 'user-1' });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/access/admin/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
  } finally { server.close(); }
});

test('ordinary users cannot delete a workspace through the admin route', async () => {
  prisma.user.findUnique = async () => ({ id: 'user-1', isPlatformAdmin: false, mustChangePassword: false });
  const app = express();
  app.use('/access', accessRoutes);
  const server = app.listen(0);
  try {
    const token = signToken({ userId: 'user-1' });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/access/admin/workspaces/11111111-1111-4111-8111-111111111111`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
  } finally { server.close(); }
});

test('approval creates the requested workspace, first project and QA Lead membership together', async () => {
  const service = require('../src/services/accessRequests.service');
  const created = [];
  prisma.$transaction = async (operation) => operation({
    workspaceRequest: {
      findUnique: async () => ({ id: 'request-1', userId: 'user-1', workspaceName: 'QA Team', projectName: 'Mobile app', status: 'PENDING' }),
      updateMany: async () => ({ count: 1 }),
      update: async () => {},
    },
    user: { findUniqueOrThrow: async () => ({ id: 'user-1', email: 'new@example.com', displayName: 'New User' }) },
    workspace: { create: async ({ data }) => { created.push(['workspace', data]); return { id: 'workspace-1', ...data }; } },
    membership: { create: async ({ data }) => { created.push(['membership', data]); } },
    teamMember: { create: async ({ data }) => { created.push(['teamMember', data]); } },
    project: { create: async ({ data }) => { created.push(['project', data]); return { id: 'project-1' }; } },
  });
  const result = await service.reviewRequest('request-1', 'admin-1', true);
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.workspace.id, 'workspace-1');
  assert.equal(result.projectId, 'project-1');
  assert.equal(created.find(([kind]) => kind === 'membership')[1].role, 'QA_LEAD');
  assert.equal(created.find(([kind]) => kind === 'project')[1].name, 'Mobile app');
});

test('old unrestricted workspace links no longer grant access', async () => {
  const service = require('../src/services/invites.service');
  prisma.workspace = { findUnique: async () => ({ id: 'workspace-1', name: 'QA Team' }) };
  await assert.rejects(
    service.acceptInvite('old-generic-token', { id: 'user-1', name: 'New User', email: 'new@example.com' }),
    (error) => error.status === 410,
  );
});

test('platform admin role changes cannot demote the workspace owner', async () => {
  const service = require('../src/services/accessRequests.service');
  prisma.$transaction = async (operation) => operation({
    workspace: { findUnique: async () => ({ id: 'workspace-1', ownerId: 'user-1' }) },
    membership: { findUnique: async () => ({ role: 'QA_LEAD' }) },
    user: { findUnique: async () => ({ displayName: 'Admin' }) },
  });
  await assert.rejects(
    service.changeMemberRole('workspace-1', 'user-1', 'VIEWER', 'admin-1'),
    (error) => error.status === 403,
  );
});

test('platform admin can enter a workspace as QA Lead and appear in its team', async () => {
  const service = require('../src/services/accessRequests.service');
  const writes = [];
  prisma.$transaction = async (operation) => operation({
    workspace: { findUnique: async () => ({ id: 'workspace-1' }) },
    user: { findUnique: async () => ({ id: 'admin-1', isPlatformAdmin: true, displayName: 'Admin', email: 'admin@example.com' }) },
    membership: {
      findUnique: async () => null,
      upsert: async ({ create, update }) => { writes.push(['membership', create, update]); },
    },
    teamMember: {
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }) => { writes.push(['teamMember', data]); },
    },
    activity: { create: async () => {} },
  });
  const result = await service.enterWorkspace('workspace-1', 'admin-1');
  assert.equal(result.role, 'QA_LEAD');
  assert.equal(writes.find(([kind]) => kind === 'membership')[1].role, 'QA_LEAD');
  assert.equal(writes.find(([kind]) => kind === 'membership')[2].scope, 'WORKSPACE');
  assert.equal(writes.find(([kind]) => kind === 'teamMember')[1].userId, 'admin-1');
});

test('removing a member revokes workspace access but keeps the user account', async () => {
  const service = require('../src/services/accessRequests.service');
  const writes = [];
  prisma.$transaction = async (operation) => operation({
    workspace: { findUnique: async () => ({ id: 'workspace-1', ownerId: 'owner-1' }) },
    membership: {
      findUnique: async () => ({ userId: 'member-1' }),
      delete: async ({ where }) => { writes.push(['membership', where]); },
    },
    user: { findUnique: async ({ where }) => where.id === 'member-1'
      ? { id: 'member-1', displayName: 'Member', isPlatformAdmin: false }
      : { id: 'admin-1', displayName: 'Admin', isPlatformAdmin: true } },
    teamMember: { updateMany: async ({ data }) => { writes.push(['teamMember', data]); } },
    activity: { create: async () => {} },
  });
  const result = await service.removeMember('workspace-1', 'member-1', 'admin-1');
  assert.equal(result.removed, true);
  assert.equal(writes.find(([kind]) => kind === 'membership')[1].userId_workspaceId.userId, 'member-1');
  assert.equal(writes.find(([kind]) => kind === 'teamMember')[1].deleted, true);
});

test('admin directory searches and pages beyond the overview preview', async () => {
  const service = require('../src/services/accessRequests.service');
  let userQuery;
  let workspaceQuery;
  prisma.user.findMany = async (query) => { userQuery = query; return [{ id: 'user-27' }]; };
  prisma.user.count = async () => 27;
  prisma.workspace.findMany = async (query) => { workspaceQuery = query; return [{ id: 'workspace-27' }]; };
  prisma.workspace.count = async () => 27;
  const users = await service.listAdminUsers('alice', 2);
  const workspaces = await service.listAdminWorkspaces('mobile', 2);
  assert.equal(users.total, 27);
  assert.equal(users.items[0].id, 'user-27');
  assert.equal(userQuery.skip, 25);
  assert.equal(userQuery.where.OR[0].email.contains, 'alice');
  assert.equal(workspaces.total, 27);
  assert.equal(workspaceQuery.skip, 25);
  assert.equal(workspaceQuery.where.name.contains, 'mobile');
});
