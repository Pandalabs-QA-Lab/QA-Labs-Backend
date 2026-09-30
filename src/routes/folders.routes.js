const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole } = require('../middleware/workspaceScope');
const folders = require('../services/folders.service');

const router = express.Router({ mergeParams: true });
router.get('/', asyncHandler(async (req, res) => {
  res.json(await folders.listFolders(req.workspaceId, req.params.projectId));
}));
router.post('/', requireRole('QA_LEAD'), asyncHandler(async (req, res) => {
  res.status(201).json(await folders.createFolder(req.workspaceId, req.params.projectId, req.body));
}));
router.patch('/:id', requireRole('QA_LEAD'), asyncHandler(async (req, res) => {
  res.json(await folders.updateFolder(req.workspaceId, req.params.projectId, req.params.id, req.body));
}));
router.delete('/:id', requireRole('QA_LEAD'), asyncHandler(async (req, res) => {
  await folders.deleteFolder(req.workspaceId, req.params.projectId, req.params.id);
  res.status(204).send();
}));
module.exports = router;
