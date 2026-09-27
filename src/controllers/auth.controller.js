const authService = require('../services/auth.service');
const { registerSchema, loginSchema, updateMeSchema } = require('../validators/auth.validators');

async function register(req, res) {
  const parsed = registerSchema.parse(req.body);
  const result = await authService.register(parsed);
  res.status(201).json(result);
}

async function login(req, res) {
  const parsed = loginSchema.parse(req.body);
  const result = await authService.login(parsed);
  res.json(result);
}

async function me(req, res) {
  const result = await authService.me({ userId: req.user.id, workspaceId: req.user.workspaceId });
  res.json(result);
}

async function updateMe(req, res) {
  const parsed = updateMeSchema.parse(req.body);
  const result = await authService.updateMe({ userId: req.user.id, workspaceId: req.user.workspaceId }, parsed);
  res.json(result);
}

async function listWorkspaces(req, res) {
  res.json(await authService.listWorkspaces(req.user.id));
}

async function switchWorkspace(req, res) {
  res.json(await authService.switchWorkspace(req.user.id, req.params.workspaceId));
}

module.exports = { register, login, me, updateMe, listWorkspaces, switchWorkspace };
