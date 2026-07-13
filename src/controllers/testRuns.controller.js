const service = require('../services/testRuns.service');
const { createTestRunSchema, updateTestRunSchema, runDraftSchema } = require('../validators/testRuns.validators');

async function list(req, res) {
  res.json(await service.listTestRuns(req.workspaceId, req.params.projectId));
}

async function get(req, res) {
  res.json(await service.getTestRun(req.workspaceId, req.params.projectId, req.params.id));
}

async function create(req, res) {
  const parsed = createTestRunSchema.parse(req.body);
  res.status(201).json(await service.createTestRun(req.workspaceId, req.actor, req.params.projectId, parsed));
}

async function update(req, res) {
  const parsed = updateTestRunSchema.parse(req.body);
  res.json(await service.updateTestRun(req.workspaceId, req.actor, req.params.projectId, req.params.id, parsed));
}

async function getDraft(req, res) {
  const draft = await service.getRunDraft(req.workspaceId, req.params.projectId);
  res.json(draft || null);
}

async function putDraft(req, res) {
  const parsed = runDraftSchema.parse(req.body);
  res.json(await service.saveRunDraft(req.workspaceId, req.params.projectId, parsed));
}

async function deleteDraft(req, res) {
  await service.deleteRunDraft(req.workspaceId, req.params.projectId);
  res.status(204).send();
}

module.exports = { list, get, create, update, getDraft, putDraft, deleteDraft };
