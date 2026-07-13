const service = require('../services/testCases.service');
const { createTestCaseSchema, updateTestCaseSchema, bulkCreateSchema } = require('../validators/testCases.validators');

async function list(req, res) {
  const rows = await service.listTestCases(req.workspaceId, req.params.projectId);
  res.json(rows);
}

async function get(req, res) {
  const row = await service.getTestCase(req.workspaceId, req.params.projectId, req.params.id);
  res.json(row);
}

async function create(req, res) {
  const parsed = createTestCaseSchema.parse(req.body);
  const row = await service.createTestCase(req.workspaceId, req.actor, req.params.projectId, parsed);
  res.status(201).json(row);
}

async function bulkCreate(req, res) {
  const parsed = bulkCreateSchema.parse(req.body);
  const rows = await service.bulkCreateTestCases(req.workspaceId, req.actor, req.params.projectId, parsed.rows);
  res.status(201).json(rows);
}

async function update(req, res) {
  const parsed = updateTestCaseSchema.parse(req.body);
  const row = await service.updateTestCase(req.workspaceId, req.actor, req.params.projectId, req.params.id, parsed);
  res.json(row);
}

async function remove(req, res) {
  await service.deleteTestCase(req.workspaceId, req.actor, req.params.projectId, req.params.id);
  res.status(204).send();
}

module.exports = { list, get, create, bulkCreate, update, remove };
