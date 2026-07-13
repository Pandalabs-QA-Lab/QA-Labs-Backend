const crypto = require('crypto');
const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { logActivity } = require('../lib/activityLogger');

// Shared helper used by every project-nested resource's service (test
// cases, bugs, runs, etc.) to verify a projectId actually belongs to the
// caller's workspace before allowing any read/write against it. This is
// what stops a user from touching another workspace's project even if
// they somehow learn its UUID.
async function getProjectOrThrow(workspaceId, projectId, tx = prisma) {
  const project = await tx.project.findFirst({
    where: { id: projectId, workspaceId, deleted: false },
  });
  if (!project) {
    throw new HttpError(404, 'Project not found');
  }
  return project;
}

async function listProjects(workspaceId) {
  return prisma.project.findMany({
    where: { workspaceId, deleted: false },
    orderBy: { createdAt: 'desc' },
  });
}

async function getProject(workspaceId, id) {
  return getProjectOrThrow(workspaceId, id);
}

async function createProject(workspaceId, actor, data) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        workspaceId,
        name: data.name,
        description: data.description || '',
        memberIds: data.memberIds || [],
        createdBy: actor.id,
        createdByName: actor.name,
      },
    });
    await logActivity(tx, {
      workspaceId,
      projectId: project.id,
      entityType: 'project',
      entityId: project.id,
      action: 'created',
      title: `Project created: ${project.name}`,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { after: project },
    });
    return project;
  });
}

async function updateProject(workspaceId, actor, id, data) {
  return prisma.$transaction(async (tx) => {
    const before = await getProjectOrThrow(workspaceId, id, tx);
    const changes = [];
    if (data.name !== undefined && data.name !== before.name) changes.push(`name: "${before.name}" -> "${data.name}"`);
    if (data.description !== undefined && data.description !== before.description) changes.push('description updated');
    if (data.memberIds !== undefined) changes.push('team members updated');

    const updated = await tx.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.memberIds !== undefined ? { memberIds: data.memberIds } : {}),
        updatedBy: actor.id,
      },
    });

    if (changes.length > 0) {
      await logActivity(tx, {
        workspaceId,
        projectId: id,
        entityType: 'project',
        entityId: id,
        action: 'updated',
        title: `Project updated: ${updated.name}`,
        details: changes.join(', '),
        actorId: actor.id,
        actorName: actor.name,
        metadata: { before, after: updated },
      });
    }
    return updated;
  });
}

async function deleteProject(workspaceId, actor, id) {
  return prisma.$transaction(async (tx) => {
    const project = await getProjectOrThrow(workspaceId, id, tx);
    await tx.project.update({
      where: { id },
      data: { deleted: true, deletedAt: new Date() },
    });
    await logActivity(tx, {
      workspaceId,
      projectId: id,
      entityType: 'project',
      entityId: id,
      action: 'deleted',
      title: `Project deleted: ${project.name}`,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { before: project },
    });
  });
}

// Turning sharing on mints a fresh token (invalidating any link handed out
// before); turning it off clears the token so the old link 404s immediately.
async function setPublicShare(workspaceId, actor, id, enabled) {
  const project = await getProjectOrThrow(workspaceId, id);
  const publicShareToken = enabled ? crypto.randomBytes(24).toString('hex') : null;
  const updated = await prisma.project.update({ where: { id }, data: { publicShareToken } });
  await logActivity(prisma, {
    workspaceId,
    projectId: id,
    entityType: 'project',
    entityId: id,
    action: 'updated',
    title: enabled
      ? `${actor.name} enabled public report sharing for ${project.name}`
      : `${actor.name} disabled public report sharing for ${project.name}`,
    actorId: actor.id,
    actorName: actor.name,
  });
  return updated;
}

module.exports = { listProjects, getProject, createProject, updateProject, deleteProject, getProjectOrThrow, setPublicShare };
