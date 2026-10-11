const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
process.env.JWT_SECRET = 'test-only';
const root = path.join(os.tmpdir(), `qa-lab-storage-${crypto.randomUUID()}`);
process.env.UPLOAD_DIR = root;
const prisma = { attachment: {}, bug: { findFirst: async () => ({ id: 'bug' }) } };
for (const [modulePath, exports] of [
  ['../src/lib/prisma', prisma],
  ['../src/services/projects.service', { getProjectOrThrow: async () => ({ id: 'project' }) }],
]) {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const service = require('../src/services/attachments.service');
const file = { originalname: '../../private.png', mimetype: 'image/png', size: 3, buffer: Buffer.from('png') };

test('attachment storage uses opaque names and cleans files after failed database saves', async () => {
  try {
    prisma.attachment.create = async ({ data }) => data;
    const saved = await service.uploadAttachment('workspace', { id: 'actor' }, { projectId: 'project', bugId: 'bug' }, file);
    assert.equal(path.dirname(saved.path), path.join(root, 'workspace', 'project'));
    assert.match(path.basename(saved.path), /^[a-f0-9-]{36}$/);
    assert.equal(saved.filename, file.originalname);
    assert.equal(await fs.readFile(saved.path, 'utf8'), 'png');
    await service.assertAttachmentAvailable(saved);
    const before = await fs.readdir(path.dirname(saved.path));
    prisma.attachment.create = async () => { throw new Error('Database unavailable'); };
    await assert.rejects(service.uploadAttachment('workspace', { id: 'actor' }, { projectId: 'project', bugId: 'bug' }, file), /Database unavailable/);
    assert.deepEqual(await fs.readdir(path.dirname(saved.path)), before);
    await fs.unlink(saved.path);
    await assert.rejects(service.assertAttachmentAvailable(saved), error => error.status === 404 && /upload.*again/.test(error.message));
    await assert.rejects(service.assertAttachmentAvailable({ path: root }), error => error.status === 404);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('download lookup keeps workspace and optional project restrictions', async () => {
  prisma.attachment.findFirst = async ({ where }) => {
    assert.equal(where.project.workspaceId, 'workspace');
    assert.equal(where.project.deleted, false);
    assert.equal(where.projectId, 'project');
    return null;
  };
  await assert.rejects(service.getAttachmentForDownload('workspace', 'attachment', 'project'), error => error.status === 404);
});
