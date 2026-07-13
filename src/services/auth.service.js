const prisma = require('../lib/prisma');
const { hashPassword, comparePassword } = require('../lib/passwords');
const { signToken } = require('../lib/jwt');
const HttpError = require('../lib/httpError');

async function register({ email, password, displayName }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  // Look for a pending invite (a TeamMember row created by another
  // workspace's QA Lead with this exact email and no linked user yet).
  // This is the one deliberate exception to "every signup gets a new
  // workspace" - it lets invited teammates land in the inviter's
  // workspace instead of getting their own.
  const pendingInvite = await prisma.teamMember.findFirst({
    where: { email: normalizedEmail, userId: null, deleted: false },
  });

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: normalizedEmail, passwordHash, displayName: displayName.trim() },
    });

    if (pendingInvite) {
      await tx.membership.create({
        data: { userId: user.id, workspaceId: pendingInvite.workspaceId, role: pendingInvite.role },
      });
      const teamMember = await tx.teamMember.update({
        where: { id: pendingInvite.id },
        data: { userId: user.id, name: displayName.trim() || pendingInvite.name, status: 'active' },
      });
      const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: pendingInvite.workspaceId } });
      return { user, workspace, role: teamMember.role };
    }

    const workspace = await tx.workspace.create({
      data: { name: `${displayName.trim() || normalizedEmail}'s Workspace`, ownerId: user.id },
    });
    await tx.membership.create({
      data: { userId: user.id, workspaceId: workspace.id, role: 'QA_LEAD' },
    });
    await tx.teamMember.create({
      data: {
        workspaceId: workspace.id,
        name: displayName.trim() || normalizedEmail,
        email: normalizedEmail,
        userId: user.id,
        role: 'QA_LEAD',
        status: 'active',
      },
    });
    return { user, workspace, role: 'QA_LEAD' };
  });

  const token = signToken({ userId: result.user.id, workspaceId: result.workspace.id });
  return {
    token,
    user: { id: result.user.id, email: result.user.email, displayName: result.user.displayName },
    workspace: { id: result.workspace.id, name: result.workspace.name },
    role: result.role,
  };
}

async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new HttpError(401, 'Invalid email or password');
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) {
    throw new HttpError(500, 'Account has no workspace membership');
  }

  const token = signToken({ userId: user.id, workspaceId: membership.workspaceId });
  return {
    token,
    user: { id: user.id, email: user.email, displayName: user.displayName },
    workspace: { id: membership.workspace.id, name: membership.workspace.name },
    role: membership.role,
  };
}

async function me({ userId, workspaceId }) {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      include: { workspace: true },
    }),
  ]);
  if (!user || !membership) {
    throw new HttpError(401, 'Invalid session');
  }
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName },
    workspace: { id: membership.workspace.id, name: membership.workspace.name },
    role: membership.role,
  };
}

// Also updates the caller's TeamMember row (if linked) so their name stays
// consistent everywhere else in the workspace directory.
async function updateMe({ userId, workspaceId }, { displayName }) {
  const trimmed = displayName.trim();
  const [user] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { displayName: trimmed } }),
    prisma.teamMember.updateMany({ where: { workspaceId, userId }, data: { name: trimmed } }),
  ]);
  return { user: { id: user.id, email: user.email, displayName: user.displayName } };
}

module.exports = { register, login, me, updateMe };
