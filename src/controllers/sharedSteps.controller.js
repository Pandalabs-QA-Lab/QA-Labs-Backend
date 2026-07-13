const service = require('../services/sharedSteps.service');
const { createSharedStepSchema, updateSharedStepSchema } = require('../validators/sharedSteps.validators');

async function list(req, res) {
  res.json(await service.listSharedSteps(req.workspaceId, req.params.projectId));
}

async function create(req, res) {
  const parsed = createSharedStepSchema.parse(req.body);
  res.status(201).json(await service.createSharedStep(req.workspaceId, req.params.projectId, parsed));
}

async function update(req, res) {
  const parsed = updateSharedStepSchema.parse(req.body);
  res.json(await service.updateSharedStep(req.workspaceId, req.params.projectId, req.params.id, parsed));
}

async function remove(req, res) {
  await service.deleteSharedStep(req.workspaceId, req.params.projectId, req.params.id);
  res.status(204).send();
}

module.exports = { list, create, update, remove };
