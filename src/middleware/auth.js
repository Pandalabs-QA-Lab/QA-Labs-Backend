const { verifyToken } = require('../lib/jwt');
const prisma = require('../lib/prisma');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    // req.user comes ONLY from the verified JWT signature - never from
    // anything else in the request. This is the root of trust for
    // workspace scoping (see workspaceScope.js).
    req.user = { id: payload.sub, workspaceId: payload.workspaceId };
    const account = await prisma.user.findUnique({
      where: { id: payload.sub }, select: { id: true, mustChangePassword: true },
    });
    if (!account) return res.status(401).json({ error: 'Account no longer exists' });
    if (account.mustChangePassword && !['/api/auth/me', '/api/auth/password'].includes(req.originalUrl.split('?')[0])) {
      return res.status(403).json({ error: 'Change your temporary password before continuing' });
    }
    next();
  } catch (error) { next(error); }
}

module.exports = { requireAuth };
