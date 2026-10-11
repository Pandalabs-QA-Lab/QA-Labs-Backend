const HttpError = require('../lib/httpError');
const addressed = require('./addressedInvites.service');
const prisma = require('../lib/prisma');

async function resolveInvite(token) {
  const invited = await addressed.resolve(token);
  if (invited) return invited;
  const legacy = await prisma.workspace.findUnique({ where: { inviteToken: token }, select: { id: true } });
  if (legacy) throw new HttpError(410, 'This old workspace link has been retired. Ask an admin to send a new invitation addressed to your email.');
  throw new HttpError(404, 'This invite link is invalid or has been revoked');
}

async function acceptInvite(token, actor) {
  const invited = await prisma.invitation.findUnique({ where: { token } });
  if (invited) return addressed.accept(invited, actor);
  const legacy = await prisma.workspace.findUnique({ where: { inviteToken: token }, select: { id: true } });
  if (legacy) throw new HttpError(410, 'This old workspace link has been retired. Ask an admin to send a new invitation addressed to your email.');
  throw new HttpError(404, 'This invite link is invalid or has been revoked');
}

module.exports = { resolveInvite, acceptInvite };
