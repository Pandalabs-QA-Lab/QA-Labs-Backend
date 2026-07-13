const prisma = require('../lib/prisma');

// req.workspaceId is set ONLY from the JWT-derived req.user (populated by
// requireAuth), never from req.body/req.query/req.params. Every service
// function must take this value and filter every Prisma query by it -
// this is the entire mechanism that prevents cross-workspace data leaks.
function attachWorkspace(req, res, next) {
  if (!req.user || !req.user.workspaceId) {
    return res.status(401).json({ error: 'Missing workspace context' });
  }
  req.workspaceId = req.user.workspaceId;
  next();
}

// Role is re-checked live against the Membership table on every request
// (not trusted from the JWT payload), so a role change takes effect
// immediately without requiring the user to log in again.
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const membership = await prisma.membership.findUnique({
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

module.exports = { attachWorkspace, requireRole };
