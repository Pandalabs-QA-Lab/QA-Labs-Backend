const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
process.env.JWT_SECRET = 'test-secret-only-for-local-unit-tests';
const uploadRoot = path.join(os.tmpdir(), `qa-lab-delete-test-${crypto.randomUUID()}`);
process.env.UPLOAD_DIR = uploadRoot;

const prisma = {};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const { deleteWorkspace } = require('../src/services/adminWorkspaces.service');

test('workspace deletion clears request links, cascades records, and removes uploads', async () => {
  const workspaceId = crypto.randomUUID();
  const uploadPath = path.join(uploadRoot, workspaceId);
  await fs.mkdir(uploadPath, { recursive: true });
  await fs.writeFile(path.join(uploadPath, 'attachment.txt'), 'test');
  const writes = [];
  prisma.$transaction = async (operation) => operation({
    workspace: {
      findUnique: async () => ({ id: workspaceId, name: 'QA Team' }),
      delete: async () => { writes.push('delete-workspace'); },
    },
    workspaceRequest: { updateMany: async ({ data }) => { assert.equal(data.workspaceId, null); writes.push('unlink-requests'); } },
  });
  try {
    await assert.rejects(deleteWorkspace(workspaceId, 'Wrong name'), (error) => error.status === 400);
    const result = await deleteWorkspace(workspaceId, 'QA Team');
    assert.equal(result.deleted, true);
    assert.equal(result.filesRemoved, true);
    assert.deepEqual(writes, ['unlink-requests', 'delete-workspace']);
    await assert.rejects(fs.stat(uploadPath), { code: 'ENOENT' });
  } finally {
    await fs.rm(uploadRoot, { recursive: true, force: true });
  }
});
