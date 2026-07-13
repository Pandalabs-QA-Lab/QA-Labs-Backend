const service = require('../services/activity.service');

async function list(req, res) {
  const { projectId, entityType, entityId, limit } = req.query;
  res.json(await service.listActivity(req.workspaceId, { projectId, entityType, entityId, limit }));
}

module.exports = { list };
