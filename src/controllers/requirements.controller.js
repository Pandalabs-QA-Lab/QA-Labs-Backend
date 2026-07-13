const service = require('../services/requirements.service');
const { createRequirementSchema, updateRequirementSchema, bulkCreateSchema } = require('../validators/requirements.validators');

async function list(req, res) {
  res.json(await service.listRequirements(req.workspaceId, req.params.projectId));
}

async function create(req, res) {
  const parsed = createRequirementSchema.parse(req.body);
  res.status(201).json(await service.createRequirement(req.workspaceId, req.actor, req.params.projectId, parsed));
}

async function bulkCreate(req, res) {
  const parsed = bulkCreateSchema.parse(req.body);
  res.status(201).json(await service.bulkCreateRequirements(req.workspaceId, req.actor, req.params.projectId, parsed.rows));
}

async function update(req, res) {
  const parsed = updateRequirementSchema.parse(req.body);
  res.json(await service.updateRequirement(req.workspaceId, req.actor, req.params.projectId, req.params.id, parsed));
}

async function remove(req, res) {
  await service.deleteRequirement(req.workspaceId, req.actor, req.params.projectId, req.params.id);
  res.status(204).send();
}

module.exports = { list, create, bulkCreate, update, remove };
