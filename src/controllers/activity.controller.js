const service = require('../services/activity.service');

async function list(req, res) {
  const { projectId, entityType, entityId, limit } = req.query;
  if (req.allowedProjectIds && projectId && !req.allowedProjectIds.includes(projectId)) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(await service.listActivity(req.workspaceId, { projectId, entityType, entityId, limit, allowedProjectIds: req.allowedProjectIds }));
}

module.exports = { list };
