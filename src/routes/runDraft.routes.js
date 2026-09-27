const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/testRuns.controller');
const { requireRole } = require('../middleware/workspaceScope');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.getDraft));
router.put('/', requireRole('QA_LEAD', 'TESTER'), asyncHandler(controller.putDraft));
router.delete('/', requireRole('QA_LEAD', 'TESTER'), asyncHandler(controller.deleteDraft));

module.exports = router;
