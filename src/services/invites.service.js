const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');

async function resolveInvite(token) {
  const workspace = await prisma.workspace.findUnique({ where: { inviteToken: token } });
  if (!workspace) throw new HttpError(404, 'This invite link is invalid or has been revoked');
  return { workspaceId: workspace.id, workspaceName: workspace.name };
}

// Joins the authenticated user into the token's workspace. Idempotent - if
// they're already a member there, this just returns the existing membership
// instead of erroring (a stale/duplicate click on the invite link is fine).
async function acceptInvite(token, actor) {
  const workspace = await prisma.workspace.findUnique({ where: { inviteToken: token } });
  if (!workspace) throw new HttpError(404, 'This invite link is invalid or has been revoked');

  const removed = await prisma.teamMember.findFirst({
    where: { workspaceId: workspace.id, userId: actor.id, deleted: true },
  });
  if (removed) throw new HttpError(403, 'Your workspace access was removed');

  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: actor.id, workspaceId: workspace.id } },
  });
  if (existing) {
    return { workspaceId: workspace.id, workspaceName: workspace.name, role: existing.role };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.create({
      data: { userId: actor.id, workspaceId: workspace.id, role: 'VIEWER' },
    });
    const pending = await tx.teamMember.findFirst({
      where: { workspaceId: workspace.id, email: actor.email, userId: null, deleted: false },
    });
    if (pending) {
      await tx.teamMember.update({
        where: { id: pending.id }, data: { userId: actor.id, name: actor.name, role: 'VIEWER', status: 'active' },
      });
    } else {
      await tx.teamMember.create({
        data: { workspaceId: workspace.id, name: actor.name, email: actor.email, userId: actor.id, role: 'VIEWER', status: 'active' },
      });
    }
  });

  return { workspaceId: workspace.id, workspaceName: workspace.name, role: 'VIEWER' };
}

module.exports = { resolveInvite, acceptInvite };
