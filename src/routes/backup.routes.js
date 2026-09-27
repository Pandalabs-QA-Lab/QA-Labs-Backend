const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/backup.controller');
const { requireRole } = require('../middleware/workspaceScope');

const router = express.Router();

router.get('/export', requireRole('QA_LEAD'), asyncHandler(controller.exportBackup));
router.post('/import', requireRole('QA_LEAD'), asyncHandler(controller.importBackup));

module.exports = router;
