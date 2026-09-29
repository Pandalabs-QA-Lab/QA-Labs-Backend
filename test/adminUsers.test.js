const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
process.env.JWT_SECRET = 'test-secret-only-for-local-unit-tests';

const prisma = { user: { findUnique: async () => null } };
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const adminUsers = require('../src/services/adminUsers.service');
const auth = require('../src/services/auth.service');
const { requireAuth } = require('../src/middleware/auth');
const { signToken } = require('../src/lib/jwt');

test('admin-created account starts as workspace Viewer and must change password', async () => {
  let userData;
  let membershipData;
  prisma.$transaction = async (operation) => operation({
    workspace: { findUnique: async () => ({ id: 'workspace-1', name: 'QA Team' }) },
    user: { create: async ({ data }) => { userData = data; return { id: 'user-2', email: data.email, displayName: data.displayName }; } },
    membership: { create: async ({ data }) => { membershipData = data; } },
    teamMember: { create: async () => {} },
    activity: { create: async () => {} },
  });
  const result = await adminUsers.createAccount('admin-1', {
    email: 'New@Example.com', displayName: 'New User', password: 'temporary-password-123', workspaceId: 'workspace-1',
  });
  assert.equal(result.email, 'new@example.com');
  assert.equal(userData.mustChangePassword, true);
  assert.notEqual(userData.passwordHash, 'temporary-password-123');
  assert.equal(membershipData.role, 'VIEWER');
  assert.equal(membershipData.scope, 'WORKSPACE');
});

test('deleting an owner transfers their workspace to the platform admin', async () => {
  const writes = [];
  prisma.$transaction = async (operation) => operation({
    user: {
      findUnique: async ({ where }) => where.id === 'target-1'
        ? { id: 'target-1', email: 'owner@example.com', isPlatformAdmin: true }
        : { displayName: 'Admin', email: 'admin@example.com' },
      delete: async () => { writes.push('delete-user'); },
    },
    workspace: {
      findMany: async () => [{ id: 'workspace-1' }],
      update: async ({ data }) => { assert.equal(data.ownerId, 'admin-1'); writes.push('transfer-owner'); },
    },
    membership: { upsert: async ({ create }) => { assert.equal(create.scope, 'WORKSPACE'); writes.push('grant-admin-access'); } },
    teamMember: { findMany: async () => [], updateMany: async () => ({ count: 0 }), create: async () => {} , deleteMany: async () => {} },
    project: { findMany: async () => [] },
    presence: { deleteMany: async () => {} },
    invitation: { updateMany: async () => {} },
    activity: { create: async () => {} },
  });
  const result = await adminUsers.deleteAccount('admin-1', 'target-1');
  assert.equal(result.transferredWorkspaces, 1);
  assert.deepEqual(writes, ['grant-admin-access', 'transfer-owner', 'delete-user']);
});

test('the signed-in platform admin cannot delete their own account', async () => {
  await assert.rejects(adminUsers.deleteAccount('admin-1', 'admin-1'), (error) => error.status === 403);
});

test('account deletion removes memberships through user cascade and cleans project assignments', async () => {
  const writes = [];
  prisma.$transaction = async (operation) => operation({
    user: {
      findUnique: async ({ where }) => where.id === 'target-1'
        ? { id: 'target-1', email: 'target@example.com', isPlatformAdmin: false }
        : { displayName: 'Admin' },
      delete: async () => { writes.push('delete-user'); },
    },
    workspace: { findMany: async () => [] },
    teamMember: {
      findMany: async () => [{ id: 'member-1', workspaceId: 'workspace-1' }],
      deleteMany: async () => { writes.push('delete-member'); },
    },
    project: {
      findMany: async () => [{ id: 'project-1', memberIds: ['member-1', 'member-2'] }],
      update: async ({ data }) => { assert.deepEqual(data.memberIds, ['member-2']); },
    },
    presence: { deleteMany: async () => {} },
    invitation: { updateMany: async () => {} },
    activity: { create: async () => {} },
  });
  const result = await adminUsers.deleteAccount('admin-1', 'target-1');
  assert.equal(result.deleted, true);
  assert.deepEqual(writes, ['delete-member', 'delete-user']);
});

test('temporary password can be replaced only after proving knowledge of it', async () => {
  const { hashPassword } = require('../src/lib/passwords');
  const existingHash = await hashPassword('temporary-password-123');
  prisma.user.findUnique = async () => ({ id: 'user-2', email: 'new@example.com', displayName: 'New User',
    isPlatformAdmin: false, passwordHash: existingHash, mustChangePassword: true });
  let updateData;
  prisma.user.update = async ({ data }) => {
    updateData = data;
    return { id: 'user-2', email: 'new@example.com', displayName: 'New User', isPlatformAdmin: false };
  };
  await assert.rejects(auth.changePassword('user-2', { currentPassword: 'wrong', newPassword: 'my-private-password-123' }),
    (error) => error.status === 403);
  const result = await auth.changePassword('user-2', {
    currentPassword: 'temporary-password-123', newPassword: 'my-private-password-123',
  });
  assert.equal(result.user.mustChangePassword, false);
  assert.equal(updateData.mustChangePassword, false);
  assert.notEqual(updateData.passwordHash, existingHash);
});

test('deleted accounts lose existing sessions and temporary accounts cannot bypass password change', async () => {
  const token = signToken({ userId: 'user-2' });
  const request = (url) => ({ headers: { authorization: `Bearer ${token}` }, originalUrl: url });
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } });
  prisma.user.findUnique = async () => null;
  const deleted = response();
  await requireAuth(request('/api/auth/workspaces'), deleted, () => { throw new Error('deleted account allowed'); });
  assert.equal(deleted.statusCode, 401);
  prisma.user.findUnique = async () => ({ id: 'user-2', mustChangePassword: true });
  const blocked = response();
  await requireAuth(request('/api/projects'), blocked, () => { throw new Error('temporary account allowed'); });
  assert.equal(blocked.statusCode, 403);
  const allowed = response();
  let nextCalled = false;
  await requireAuth(request('/api/auth/password'), allowed, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
