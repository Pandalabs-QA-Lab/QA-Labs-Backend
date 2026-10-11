const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { getProjectOrThrow } = require('./projects.service');

async function listFolders(workspaceId, projectId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.projectFolder.findMany({ where: { projectId }, orderBy: [{ name: 'asc' }] });
}

async function requireFolder(tx, projectId, id) {
  if (!id) return null;
  const folder = await tx.projectFolder.findFirst({ where: { id, projectId } });
  if (!folder) throw new HttpError(400, 'Folder does not belong to this project');
  return folder;
}

async function resolveFolderId(tx, projectId, folderId, legacyName = '') {
  if (folderId !== undefined) {
    await requireFolder(tx, projectId, folderId);
    return folderId || null;
  }
  const name = legacyName.trim();
  if (!name) return null;
  const existing = await tx.projectFolder.findFirst({ where: { projectId, parentId: null, name } });
  if (existing) return existing.id;
  const created = await tx.projectFolder.create({ data: { projectId, name } });
  return created.id;
}

async function pathForFolder(tx, projectId, id) {
  if (!id) return '';
  const names = [];
  const visited = new Set();
  let current = id;
  while (current) {
    if (visited.has(current)) throw new HttpError(400, 'Folder hierarchy contains a cycle');
    visited.add(current);
    const folder = await requireFolder(tx, projectId, current);
    names.unshift(folder.name);
    current = folder.parentId;
  }
  return names.join(' / ');
}

async function syncTestCaseFolderPaths(tx, projectId) {
  const folders = await tx.projectFolder.findMany({ where: { projectId }, select: { id: true } });
  for (const folder of folders) {
    const path = await pathForFolder(tx, projectId, folder.id);
    await tx.testCase.updateMany({ where: { projectId, folderId: folder.id }, data: { folder: path } });
  }
}

async function assertNoCycle(tx, projectId, folderId, parentId) {
  let current = parentId;
  while (current) {
    if (current === folderId) throw new HttpError(400, 'A folder cannot be moved inside itself');
    const parent = await requireFolder(tx, projectId, current);
    current = parent.parentId;
  }
}

function normalizeName(name) {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value || value.length > 120) throw new HttpError(400, 'Folder name must be 1–120 characters');
  return value;
}

function folderConflict(error) {
  if (error.code === 'P2002') throw new HttpError(409, 'A folder with this name already exists here');
  throw error;
}

async function createFolder(workspaceId, projectId, data = {}) {
  await getProjectOrThrow(workspaceId, projectId);
  const name = normalizeName(data.name);
  const parentId = data.parentId || null;
  try {
    return await prisma.$transaction(async (tx) => {
      await requireFolder(tx, projectId, parentId);
      return tx.projectFolder.create({ data: { projectId, parentId, name } });
    });
  } catch (error) { folderConflict(error); }
}

async function updateFolder(workspaceId, projectId, id, data = {}) {
  await getProjectOrThrow(workspaceId, projectId);
  try {
    return await prisma.$transaction(async (tx) => {
      const before = await requireFolder(tx, projectId, id);
      const parentId = data.parentId === undefined ? before.parentId : data.parentId || null;
      await requireFolder(tx, projectId, parentId);
      await assertNoCycle(tx, projectId, id, parentId);
      const updated = await tx.projectFolder.update({
        where: { id },
        data: { name: data.name === undefined ? before.name : normalizeName(data.name), parentId },
      });
      await syncTestCaseFolderPaths(tx, projectId);
      return updated;
    });
  } catch (error) { folderConflict(error); }
}

async function deleteFolder(workspaceId, projectId, id) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.$transaction(async (tx) => {
    const folder = await requireFolder(tx, projectId, id);
    const siblings = await tx.projectFolder.findMany({ where: { projectId, parentId: folder.parentId, id: { not: id } }, select: { name: true } });
    const children = await tx.projectFolder.findMany({ where: { projectId, parentId: id }, select: { name: true } });
    if (children.some((child) => siblings.some((sibling) => sibling.name === child.name))) {
      throw new HttpError(409, 'Move or rename a child folder before removing this folder');
    }
    await tx.projectFolder.updateMany({ where: { projectId, parentId: id }, data: { parentId: folder.parentId } });
    await tx.testCase.updateMany({ where: { projectId, folderId: id }, data: { folderId: folder.parentId } });
    await tx.requirement.updateMany({ where: { projectId, folderId: id }, data: { folderId: folder.parentId } });
    await tx.projectFolder.delete({ where: { id } });
    await syncTestCaseFolderPaths(tx, projectId);
    if (!folder.parentId) await tx.testCase.updateMany({ where: { projectId, folderId: null }, data: { folder: '' } });
  });
}

module.exports = { listFolders, createFolder, updateFolder, deleteFolder, requireFolder, resolveFolderId, pathForFolder };
