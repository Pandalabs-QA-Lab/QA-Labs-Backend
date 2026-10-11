const service = require('../services/notifications.service');

async function list(req, res) {
  res.json(await service.listNotifications(req.workspaceId, req.user.id, req.allowedProjectIds));
}

async function markAsRead(req, res) {
  res.json(await service.markAsRead(req.workspaceId, req.user.id, req.params.id, req.allowedProjectIds));
}

async function markAllAsRead(req, res) {
  await service.markAllAsRead(req.workspaceId, req.user.id, req.allowedProjectIds);
  res.status(204).send();
}

async function clearAll(req, res) {
  await service.clearAll(req.workspaceId, req.user.id, req.allowedProjectIds);
  res.status(204).send();
}

module.exports = { list, markAsRead, markAllAsRead, clearAll };
