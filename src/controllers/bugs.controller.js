const service = require('../services/bugs.service');
const { createBugSchema, updateBugSchema, bulkCreateSchema } = require('../validators/bugs.validators');

async function list(req, res) {
  res.json(await service.listBugs(req.workspaceId, req.params.projectId));
}

async function get(req, res) {
  res.json(await service.getBug(req.workspaceId, req.params.projectId, req.params.id));
}

async function create(req, res) {
  const parsed = createBugSchema.parse(req.body);
  res.status(201).json(await service.createBug(req.workspaceId, req.actor, req.params.projectId, parsed));
}

async function bulkCreate(req, res) {
  const parsed = bulkCreateSchema.parse(req.body);
  res.status(201).json(await service.bulkCreateBugs(req.workspaceId, req.actor, req.params.projectId, parsed.rows));
}

async function update(req, res) {
  const parsed = updateBugSchema.parse(req.body);
  res.json(await service.updateBug(req.workspaceId, req.actor, req.params.projectId, req.params.id, parsed));
}

async function remove(req, res) {
  await service.deleteBug(req.workspaceId, req.actor, req.params.projectId, req.params.id);
  res.status(204).send();
}

module.exports = { list, get, create, bulkCreate, update, remove };
