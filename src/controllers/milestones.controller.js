const service = require('../services/milestones.service');
const { createMilestoneSchema, updateMilestoneSchema } = require('../validators/milestones.validators');

async function list(req, res) {
  res.json(await service.listMilestones(req.workspaceId, req.params.projectId));
}

async function create(req, res) {
  const parsed = createMilestoneSchema.parse(req.body);
  res.status(201).json(await service.createMilestone(req.workspaceId, req.actor, req.params.projectId, parsed));
}

async function update(req, res) {
  const parsed = updateMilestoneSchema.parse(req.body);
  res.json(await service.updateMilestone(req.workspaceId, req.actor, req.params.projectId, req.params.id, parsed));
}

async function remove(req, res) {
  await service.deleteMilestone(req.workspaceId, req.actor, req.params.projectId, req.params.id);
  res.status(204).send();
}

module.exports = { list, create, update, remove };
