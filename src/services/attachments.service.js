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
  const storedName = `${crypto.randomUUID()}-${file.originalname}`;
  const filePath = path.join(dir, storedName);
  await fs.writeFile(filePath, file.buffer);

  return prisma.attachment.create({
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
}

async function getAttachmentForDownload(workspaceId, id) {
  const attachment = await prisma.attachment.findFirst({
    where: { id, project: { workspaceId } },
  });
  if (!attachment) throw new HttpError(404, 'Attachment not found');
  return attachment;
}

async function deleteAttachment(workspaceId, id) {
  const attachment = await getAttachmentForDownload(workspaceId, id);
  await prisma.attachment.delete({ where: { id } });
  await fs.unlink(attachment.path).catch(() => {}); // best-effort
}

module.exports = { uploadAttachment, getAttachmentForDownload, deleteAttachment };
