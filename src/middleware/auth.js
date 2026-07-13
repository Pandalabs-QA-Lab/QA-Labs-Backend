const { verifyToken } = require('../lib/jwt');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = verifyToken(token);
    // req.user comes ONLY from the verified JWT signature - never from
    // anything else in the request. This is the root of trust for
    // workspace scoping (see workspaceScope.js).
    req.user = { id: payload.sub, workspaceId: payload.workspaceId };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
