const service = require('../services/backup.service');
const { importSchema } = require('../validators/backup.validators');

async function exportBackup(req, res) {
  res.json(await service.exportWorkspace(req.workspaceId, req.actor));
}

async function importBackup(req, res) {
  const parsed = importSchema.parse(req.body);
  res.json(await service.importWorkspace(req.workspaceId, req.actor, parsed.backup, parsed.mode));
}

module.exports = { exportBackup, importBackup };
