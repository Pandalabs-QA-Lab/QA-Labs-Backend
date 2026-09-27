const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/comments.controller');
const { requireRole } = require('../middleware/workspaceScope');

// mergeParams so :projectId from the parent mount path is visible here
const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.list));
router.post('/', requireRole('QA_LEAD', 'TESTER'), asyncHandler(controller.create));
router.delete('/:id', requireRole('QA_LEAD', 'TESTER'), asyncHandler(controller.remove));

module.exports = router;
