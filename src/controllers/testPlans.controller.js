const service = require('../services/testPlans.service');
const { createTestPlanSchema, updateTestPlanSchema, linkRunSchema } = require('../validators/testPlans.validators');

async function list(req, res) {
  res.json(await service.listTestPlans(req.workspaceId, req.params.projectId));
}

async function create(req, res) {
  const parsed = createTestPlanSchema.parse(req.body);
  res.status(201).json(await service.createTestPlan(req.workspaceId, req.actor, req.params.projectId, parsed));
}

async function update(req, res) {
  const parsed = updateTestPlanSchema.parse(req.body);
  res.json(await service.updateTestPlan(req.workspaceId, req.actor, req.params.projectId, req.params.id, parsed));
}

async function remove(req, res) {
  await service.deleteTestPlan(req.workspaceId, req.actor, req.params.projectId, req.params.id);
  res.status(204).send();
}

async function linkRun(req, res) {
  const parsed = linkRunSchema.parse(req.body);
  res.json(await service.linkRunToPlan(req.workspaceId, req.params.projectId, req.params.id, parsed.runId));
}

module.exports = { list, create, update, remove, linkRun };
