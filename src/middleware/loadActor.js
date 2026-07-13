const prisma = require('../lib/prisma');

// Resolves the display name for the authenticated user once per request,
// so services can stamp createdByName/updatedByName/actorName without
// each one running its own User lookup.
async function loadActor(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    req.actor = { id: user.id, name: user.displayName };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = loadActor;
