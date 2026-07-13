const service = require('../services/presence.service');
const { heartbeatSchema } = require('../validators/presence.validators');

async function heartbeat(req, res) {
  const parsed = heartbeatSchema.parse(req.body);
  res.json(await service.heartbeat(req.workspaceId, req.params.projectId, req.actor.id, req.actor.name, parsed.currentPage));
}

async function list(req, res) {
  res.json(await service.listActive(req.workspaceId, req.params.projectId, req.actor.id));
}

async function leave(req, res) {
  await service.leave(req.workspaceId, req.params.projectId, req.actor.id);
  res.status(204).send();
}

module.exports = { heartbeat, list, leave };
