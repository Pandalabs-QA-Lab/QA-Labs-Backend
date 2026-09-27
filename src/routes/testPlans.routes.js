const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/testPlans.controller');
const { requireRole } = require('../middleware/workspaceScope');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.list));
router.post('/', requireRole('QA_LEAD'), asyncHandler(controller.create));
router.patch('/:id', requireRole('QA_LEAD'), asyncHandler(controller.update));
router.delete('/:id', requireRole('QA_LEAD'), asyncHandler(controller.remove));
router.post('/:id/link-run', requireRole('QA_LEAD'), asyncHandler(controller.linkRun));

module.exports = router;
