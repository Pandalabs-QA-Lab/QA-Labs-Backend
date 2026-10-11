const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const env = require('../config/env');
const { getProjectOrThrow } = require('./projects.service');

async function uploadAttachment(workspaceId, actor, { projectId, testCaseId, bugId }, file) {
  await getProjectOrThrow(workspaceId, projectId);
  if (!testCaseId && !bugId) {
    throw new HttpError(400, 'Attachment must link to a testCaseId or bugId');
  }
  if (testCaseId) {
    const tc = await prisma.testCase.findFirst({ where: { id: testCaseId, projectId } });
    if (!tc) throw new HttpError(400, 'testCaseId does not belong to this project');
  }
  if (bugId) {
    const bug = await prisma.bug.findFirst({ where: { id: bugId, projectId } });
    if (!bug) throw new HttpError(400, 'bugId does not belong to this project');
  }

  const dir = path.join(env.uploadDir, workspaceId, projectId);
  await fs.mkdir(dir, { recursive: true });
  // Keep user-supplied names in metadata, never in the storage path.
  const storedName = crypto.randomUUID();
  const filePath = path.join(dir, storedName);
  await fs.writeFile(filePath, file.buffer);

  try {
  return await prisma.attachment.create({
    data: {
      projectId,
      testCaseId: testCaseId || null,
      bugId: bugId || null,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: filePath,
      uploadedBy: actor.id,
    },
  });
  } catch (error) {
    await fs.unlink(filePath).catch(cleanupError => {
      console.error('Failed to clean up an unsaved attachment', cleanupError);
    });
    throw error;
  }
}

async function assertAttachmentAvailable(attachment) {
  try {
    const stat = await fs.stat(attachment.path);
    if (!stat.isFile()) throw new HttpError(404, 'Attachment file is unavailable');
  } catch (error) {
    if (error.code === 'ENOENT') throw new HttpError(404, 'Attachment file is unavailable. Please upload the evidence again.');
    throw error;
  }
}

async function getAttachmentForDownload(workspaceId, id, projectId) {
  const attachment = await prisma.attachment.findFirst({
    where: { id, ...(projectId ? { projectId } : {}), project: { workspaceId, deleted: false } },
  });
  if (!attachment) throw new HttpError(404, 'Attachment not found');
  return attachment;
}

async function deleteAttachment(workspaceId, id, projectId) {
  const attachment = await getAttachmentForDownload(workspaceId, id, projectId);
  await prisma.attachment.delete({ where: { id } });
  await fs.unlink(attachment.path).catch(() => {}); // best-effort
}

module.exports = { uploadAttachment, getAttachmentForDownload, assertAttachmentAvailable, deleteAttachment };
