const prisma = require('../lib/prisma');

// req.workspaceId is set ONLY from the JWT-derived req.user (populated by
// requireAuth), never from req.body/req.query/req.params. Every service
// function must take this value and filter every Prisma query by it -
// this is the entire mechanism that prevents cross-workspace data leaks.
function attachWorkspace(req, res, next) {
  if (!req.user || !req.user.workspaceId) {
    return res.status(403).json({ error: 'Select or join a workspace first' });
  }
  req.workspaceId = req.user.workspaceId;
  next();
}

async function requireWorkspaceMember(req, res, next) {
  try {
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: req.user.id, workspaceId: req.workspaceId } },
    });
    if (!membership) return res.status(403).json({ error: 'Workspace access has been removed' });
    req.membership = membership;
    next();
  } catch (err) { next(err); }
}

// Role is re-checked live against the Membership table on every request
// (not trusted from the JWT payload), so a role change takes effect
// immediately without requiring the user to log in again.
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const membership = req.membership || await prisma.membership.findUnique({
        where: { userId_workspaceId: { userId: req.user.id, workspaceId: req.workspaceId } },
      });
      if (!membership || !allowedRoles.includes(membership.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      req.role = membership.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// A project invitation creates a Viewer membership scoped to assigned projects.
// Keep this gate before every workspace route so knowing another project's UUID
// cannot bypass the project list filter through a nested resource URL.
async function enforceProjectScope(req, res, next) {
  if (req.membership?.scope !== 'PROJECT') return next();
  try {
    const member = await prisma.teamMember.findFirst({
      where: { workspaceId: req.workspaceId, userId: req.user.id, deleted: false },
    });
    if (!member) return res.status(403).json({ error: 'Project access has been removed' });
    const projects = await prisma.project.findMany({
      where: { workspaceId: req.workspaceId, deleted: false, memberIds: { has: member.id } },
      select: { id: true, memberIds: true },
    });
    req.allowedProjectIds = projects.map((project) => project.id);
    req.allowedTeamMemberIds = [...new Set(projects.flatMap((project) => project.memberIds))];

    const path = req.originalUrl.split('?')[0].replace(/^\/api/, '');
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'projects') {
      if (parts.length === 1 && req.method === 'GET') return next();
      if (req.allowedProjectIds.includes(parts[1])) return next();
      return res.status(404).json({ error: 'Project not found' });
    }
    if (parts[0] === 'team-members' && parts.length === 1 && req.method === 'GET') return next();
    if (parts[0] === 'activity' && parts.length === 1 && req.method === 'GET') return next();
    if (parts[0] === 'notifications') return next();
    if (parts[0] === 'attachments' && parts.length === 3 && parts[2] === 'download' && req.method === 'GET') {
      const attachment = await prisma.attachment.findFirst({
        where: { id: parts[1], projectId: { in: req.allowedProjectIds } }, select: { id: true },
      });
      if (attachment) return next();
      return res.status(404).json({ error: 'Attachment not found' });
    }
    return res.status(403).json({ error: 'This account has project-only access' });
  } catch (error) { next(error); }
}

module.exports = { attachWorkspace, requireWorkspaceMember, requireRole, enforceProjectScope };
