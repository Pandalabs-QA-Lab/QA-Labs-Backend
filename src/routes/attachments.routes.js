const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const upload = require('../middleware/upload');
const controller = require('../controllers/attachments.controller');
const { requireRole } = require('../middleware/workspaceScope');

const router = express.Router();

router.post('/', requireRole('QA_LEAD', 'TESTER'), upload.single('file'), asyncHandler(controller.upload));
router.get('/:id/download', asyncHandler(controller.download));
router.delete('/:id', requireRole('QA_LEAD'), asyncHandler(controller.remove));

module.exports = router;
