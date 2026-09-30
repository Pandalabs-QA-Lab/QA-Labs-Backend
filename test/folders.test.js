const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
process.env.JWT_SECRET = 'test-secret-only-for-local-unit-tests';

const prisma = {};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const foldersService = require('../src/services/folders.service');
const { createRequirementSchema, updateRequirementSchema } = require('../src/validators/requirements.validators');
const { createTestCaseSchema, updateTestCaseSchema } = require('../src/validators/testCases.validators');

test('validators normalize empty string folderId to null and accept nullable key', () => {
  const parsedTc = updateTestCaseSchema.parse({ folderId: '' });
  assert.equal(parsedTc.folderId, null);

  const parsedReq = updateRequirementSchema.parse({ folderId: '', key: null });
  assert.equal(parsedReq.folderId, null);
  assert.equal(parsedReq.key, null);

  const parsedCreateReq = createRequirementSchema.parse({ title: 'New feature', key: null });
  assert.equal(parsedCreateReq.key, null);
});

test('pathForFolder constructs breadcrumb path from parent hierarchy', async () => {
  const store = [
    { id: 'f-1', projectId: 'p-1', parentId: null, name: 'Suites' },
    { id: 'f-2', projectId: 'p-1', parentId: 'f-1', name: 'Auth' },
    { id: 'f-3', projectId: 'p-1', parentId: 'f-2', name: 'Login' },
  ];
  const tx = {
    projectFolder: {
      findFirst: async ({ where }) => store.find((f) => f.id === where.id && f.projectId === where.projectId) || null,
    },
  };

  assert.equal(await foldersService.pathForFolder(tx, 'p-1', null), '');
  assert.equal(await foldersService.pathForFolder(tx, 'p-1', 'f-1'), 'Suites');
  assert.equal(await foldersService.pathForFolder(tx, 'p-1', 'f-3'), 'Suites / Auth / Login');
});

test('createFolder creates root and nested folders and validates name', async () => {
  let created = null;
  prisma.project = { findFirst: async () => ({ id: 'p-1', workspaceId: 'w-1' }) };
  prisma.$transaction = async (op) => op({
    projectFolder: {
      findFirst: async ({ where }) => (where.id === 'f-parent' ? { id: 'f-parent', projectId: 'p-1' } : null),
      create: async ({ data }) => { created = { id: 'f-new', ...data }; return created; },
    },
  });

  const root = await foldersService.createFolder('w-1', 'p-1', { name: 'Regression Suite' });
  assert.equal(root.name, 'Regression Suite');
  assert.equal(root.parentId, null);

  const child = await foldersService.createFolder('w-1', 'p-1', { name: 'Smoke', parentId: 'f-parent' });
  assert.equal(child.name, 'Smoke');
  assert.equal(child.parentId, 'f-parent');

  await assert.rejects(
    foldersService.createFolder('w-1', 'p-1', { name: '   ' }),
    (err) => err.status === 400 && err.message.includes('Folder name must be 1–120 characters'),
  );
});

test('updateFolder prevents circular hierarchy', async () => {
  const store = [
    { id: 'f-1', projectId: 'p-1', parentId: null, name: 'Root' },
    { id: 'f-2', projectId: 'p-1', parentId: 'f-1', name: 'Child' },
  ];
  prisma.project = { findFirst: async () => ({ id: 'p-1', workspaceId: 'w-1' }) };
  prisma.$transaction = async (op) => op({
    projectFolder: {
      findFirst: async ({ where }) => store.find((f) => f.id === where.id && f.projectId === where.projectId) || null,
      update: async () => {},
      findMany: async () => [],
    },
    testCase: { updateMany: async () => {} },
  });

  // Cannot move f-1 inside f-2 (f-2 is child of f-1)
  await assert.rejects(
    foldersService.updateFolder('w-1', 'p-1', 'f-1', { parentId: 'f-2' }),
    (err) => err.status === 400 && err.message.includes('A folder cannot be moved inside itself'),
  );

  // Cannot move f-1 inside itself
  await assert.rejects(
    foldersService.updateFolder('w-1', 'p-1', 'f-1', { parentId: 'f-1' }),
    (err) => err.status === 400 && err.message.includes('A folder cannot be moved inside itself'),
  );
});

test('deleteFolder cascades items and child folders to parent', async () => {
  let reparentedFolders = null;
  let reparentedCases = null;
  let reparentedReqs = null;
  let deletedId = null;

  prisma.project = { findFirst: async () => ({ id: 'p-1', workspaceId: 'w-1' }) };
  prisma.$transaction = async (op) => op({
    projectFolder: {
      findFirst: async () => ({ id: 'f-2', projectId: 'p-1', parentId: 'f-1', name: 'Middle' }),
      findMany: async ({ where }) => {
        if (where.parentId === 'f-1') return [{ id: 'f-sibling', name: 'Sibling' }];
        if (where.parentId === 'f-2') return [{ id: 'f-child', name: 'Child' }];
        return [];
      },
      updateMany: async ({ where, data }) => {
        if (where.parentId === 'f-2') reparentedFolders = data.parentId;
      },
      delete: async ({ where }) => { deletedId = where.id; },
    },
    testCase: {
      updateMany: async ({ where, data }) => {
        if (where.folderId === 'f-2') reparentedCases = data.folderId;
      },
    },
    requirement: {
      updateMany: async ({ where, data }) => {
        if (where.folderId === 'f-2') reparentedReqs = data.folderId;
      },
    },
  });

  await foldersService.deleteFolder('w-1', 'p-1', 'f-2');
  assert.equal(deletedId, 'f-2');
  assert.equal(reparentedFolders, 'f-1');
  assert.equal(reparentedCases, 'f-1');
  assert.equal(reparentedReqs, 'f-1');
});
