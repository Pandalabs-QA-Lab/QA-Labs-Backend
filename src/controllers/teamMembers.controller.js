const service = require('../services/teamMembers.service');
const { createTeamMemberSchema, updateTeamMemberSchema, updateWorkspaceSchema } = require('../validators/teamMembers.validators');

async function list(req, res) {
  res.json(await service.listTeamMembers(req.workspaceId, req.allowedTeamMemberIds));
}

async function create(req, res) {
  const parsed = createTeamMemberSchema.parse(req.body);
  res.status(201).json(await service.createTeamMember(req.workspaceId, req.actor, parsed));
}

async function update(req, res) {
  const parsed = updateTeamMemberSchema.parse(req.body);
  res.json(await service.updateTeamMember(req.workspaceId, req.actor, req.params.id, parsed));
}

async function remove(req, res) {
  await service.deleteTeamMember(req.workspaceId, req.actor, req.params.id);
  res.status(204).send();
}

async function getWorkspace(req, res) {
  res.json(await service.getWorkspace(req.workspaceId));
}

async function updateWorkspace(req, res) {
  const parsed = updateWorkspaceSchema.parse(req.body);
  res.json(await service.updateWorkspace(req.workspaceId, req.actor, parsed));
}

module.exports = { list, create, update, remove, getWorkspace, updateWorkspace };
