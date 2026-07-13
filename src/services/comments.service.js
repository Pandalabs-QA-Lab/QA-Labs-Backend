const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');
const { getProjectOrThrow } = require('./projects.service');
const { sendNotification } = require('../lib/notifier');

// Matches the frontend's @mention parsing so a mention only counts when it
// resolves to an actual team member's name.
function parseMentions(text, memberNames) {
  const matches = [...text.matchAll(/@([\w.\s-]+?)(?=\s|$|[^a-zA-Z0-9.\s-])/g)];
  const lowerNames = memberNames.map((n) => n.toLowerCase());
  return [...new Set(
    matches
      .map((m) => m[1].trim())
      .filter((name) => lowerNames.includes(name.toLowerCase()))
  )];
}

async function listComments(workspaceId, projectId, entityType, entityId) {
  await getProjectOrThrow(workspaceId, projectId);
  return prisma.comment.findMany({
    where: { projectId, entityType, entityId, deleted: false },
    orderBy: { createdAt: 'asc' },
  });
}

async function addComment(workspaceId, projectId, actor, { entityType, entityId, text, entityTitle, entityOwnerName }) {
  await getProjectOrThrow(workspaceId, projectId);
  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { projectId, entityType, entityId, text, authorId: actor.id, authorName: actor.name },
    });

    if (entityOwnerName) {
      await sendNotification(tx, {
        workspaceId,
        recipient: entityOwnerName,
        sender: actor.name,
        type: 'comment',
        entityId,
        entityName: entityTitle,
        message: `${actor.name} commented on "${entityTitle}": ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
        projectId,
      });
    }

    const members = await tx.teamMember.findMany({ where: { workspaceId, deleted: false }, select: { name: true } });
    const mentioned = parseMentions(text, members.map((m) => m.name));
    for (const name of mentioned) {
      if (name.toLowerCase() === actor.name.toLowerCase()) continue;
      if (entityOwnerName && name.toLowerCase() === entityOwnerName.toLowerCase()) continue;
      await sendNotification(tx, {
        workspaceId,
        recipient: name,
        sender: actor.name,
        type: 'mention',
        entityId,
        entityName: entityTitle,
        message: `${actor.name} mentioned you in "${entityTitle}": ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
        projectId,
      });
    }

    return created;
  });
  return comment;
}

async function deleteComment(workspaceId, projectId, actor, id) {
  await getProjectOrThrow(workspaceId, projectId);
  const comment = await prisma.comment.findFirst({ where: { id, projectId, deleted: false } });
  if (!comment) throw new HttpError(404, 'Comment not found');
  if (comment.authorId !== actor.id) throw new HttpError(403, 'You can only delete your own comments');
  await prisma.comment.update({ where: { id }, data: { deleted: true } });
}

module.exports = { listComments, addComment, deleteComment };
