const fs = require('node:fs/promises');
const path = require('node:path');
const prisma = require('../lib/prisma');
const env = require('../config/env');
const HttpError = require('../lib/httpError');

async function deleteWorkspace(workspaceId, confirmName) {
  const workspace = await prisma.$transaction(async (tx) => {
    const existing = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true } });
    if (!existing) throw new HttpError(404, 'Workspace not found');
    if (existing.name !== confirmName) throw new HttpError(400, 'Workspace name confirmation does not match');

    // Requests are historical records without a foreign key to Workspace.
    await tx.workspaceRequest.updateMany({ where: { workspaceId }, data: { workspaceId: null } });
    // Projects and their test data, members, invitations, notifications, and
    // activity are removed by the database's cascading foreign keys.
    await tx.workspace.delete({ where: { id: workspaceId } });
    return existing;
  });

  const uploadRoot = path.resolve(env.uploadDir);
  const uploadPath = path.resolve(uploadRoot, workspaceId);
  if (path.dirname(uploadPath) !== uploadRoot) throw new Error('Invalid workspace upload path');
  try {
    await fs.rm(uploadPath, { recursive: true, force: true });
  } catch (error) {
    console.error('Workspace database deleted but uploaded files could not be removed', error);
    return { deleted: true, workspace, filesRemoved: false };
  }
  return { deleted: true, workspace, filesRemoved: true };
}

module.exports = { deleteWorkspace };
