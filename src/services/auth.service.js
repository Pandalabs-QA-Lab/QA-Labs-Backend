const prisma = require('../lib/prisma');
const { hashPassword, comparePassword } = require('../lib/passwords');
const { signToken } = require('../lib/jwt');
const HttpError = require('../lib/httpError');

function session(user, membership, includeToken = false) {
  const result = {
    user: { id: user.id, email: user.email, displayName: user.displayName, isPlatformAdmin: user.isPlatformAdmin, mustChangePassword: user.mustChangePassword || false },
    workspace: membership ? { id: membership.workspace.id, name: membership.workspace.name } : null,
    role: membership?.role || null,
  };
  if (includeToken) result.token = signToken({ userId: user.id, workspaceId: membership?.workspaceId || null });
  return result;
}

async function register({ email, password, displayName }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
    throw new HttpError(409, 'An account with this email already exists');
  }
  const user = await prisma.user.create({
    data: { email: normalizedEmail, passwordHash: await hashPassword(password), displayName: displayName.trim() },
  });
  // Registration alone never creates a workspace or claims an email invite.
  return session(user, null, true);
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id }, include: { workspace: true }, orderBy: { createdAt: 'asc' },
  });
  return session(user, membership, true);
}

async function me({ userId, workspaceId }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, 'Invalid session');
  const membership = workspaceId
    ? await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } }, include: { workspace: true },
    })
    : null;
  // A removed user's stale token must not restore access to the old workspace.
  return session(user, membership);
}

async function listWorkspaces(userId) {
  const rows = await prisma.membership.findMany({
    where: { userId }, include: { workspace: true }, orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({ id: row.workspaceId, name: row.workspace.name, role: row.role }));
}

async function switchWorkspace(userId, workspaceId) {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } }, include: { workspace: true },
    }),
  ]);
  if (!user || !membership) throw new HttpError(403, 'You do not belong to this workspace');
  return session(user, membership, true);
}

async function updateMe({ userId, workspaceId }, { displayName }) {
  const trimmed = displayName.trim();
  const [user] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { displayName: trimmed } }),
    prisma.teamMember.updateMany({ where: { userId, ...(workspaceId ? { workspaceId } : {}) }, data: { name: trimmed } }),
  ]);
  return { user: { id: user.id, email: user.email, displayName: user.displayName, isPlatformAdmin: user.isPlatformAdmin } };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, 'Invalid session');
  if (!(await comparePassword(currentPassword, user.passwordHash))) {
    throw new HttpError(403, 'Current password is incorrect');
  }
  if (currentPassword === newPassword) throw new HttpError(400, 'Choose a different password');
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });
  return { user: { id: updated.id, email: updated.email, displayName: updated.displayName,
    isPlatformAdmin: updated.isPlatformAdmin, mustChangePassword: false } };
}

module.exports = { register, login, me, listWorkspaces, switchWorkspace, updateMe, changePassword };
