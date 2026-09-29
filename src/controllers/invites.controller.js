const service = require('../services/invites.service');
const addressed = require('../services/addressedInvites.service');
const { z } = require('zod');

const invitationSchema = z.object({
  email: z.string().trim().email(),
  projectId: z.string().uuid().optional(),
});

async function create(req, res) {
  const data = invitationSchema.parse(req.body);
  res.status(201).json(await addressed.create(req.workspaceId, req.actor, data));
}

async function managed(req, res) {
  const projectId = req.query.projectId ? z.string().uuid().parse(req.query.projectId) : null;
  res.json(await addressed.listManaged(req.workspaceId, projectId));
}

async function revoke(req, res) {
  await addressed.revoke(req.workspaceId, req.params.id);
  res.status(204).send();
}

async function pending(req, res) {
  res.json(await addressed.pending(req.actor.email));
}

async function resolve(req, res) {
  res.json(await service.resolveInvite(req.params.token));
}

async function accept(req, res) {
  res.json(await service.acceptInvite(req.params.token, req.actor));
}

module.exports = { create, managed, revoke, pending, resolve, accept };
