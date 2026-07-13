const service = require('../services/invites.service');

async function resolve(req, res) {
  res.json(await service.resolveInvite(req.params.token));
}

async function accept(req, res) {
  res.json(await service.acceptInvite(req.params.token, req.actor));
}

module.exports = { resolve, accept };
