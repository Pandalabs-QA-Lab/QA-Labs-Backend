const service = require('../services/projects.service');
const { createProjectSchema, updateProjectSchema } = require('../validators/projects.validators');

async function list(req, res) {
  const projects = await service.listProjects(req.workspaceId, req.allowedProjectIds);
  res.json(projects);
}

async function get(req, res) {
  const project = await service.getProject(req.workspaceId, req.params.id);
  res.json(project);
}

async function create(req, res) {
  const parsed = createProjectSchema.parse(req.body);
  const project = await service.createProject(req.workspaceId, req.actor, parsed);
  res.status(201).json(project);
}

async function update(req, res) {
  const parsed = updateProjectSchema.parse(req.body);
  const project = await service.updateProject(req.workspaceId, req.actor, req.params.id, parsed);
  res.json(project);
}

async function remove(req, res) {
  await service.deleteProject(req.workspaceId, req.actor, req.params.id);
  res.status(204).send();
}

async function setPublicShare(req, res) {
  const project = await service.setPublicShare(req.workspaceId, req.actor, req.params.id, !!req.body.enabled);
  res.json(project);
}

module.exports = { list, get, create, update, remove, setPublicShare };
