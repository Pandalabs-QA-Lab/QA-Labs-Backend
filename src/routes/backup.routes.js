const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/backup.controller');

const router = express.Router();

router.get('/export', asyncHandler(controller.exportBackup));
router.post('/import', asyncHandler(controller.importBackup));

module.exports = router;
