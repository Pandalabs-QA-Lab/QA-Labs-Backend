const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/projects.controller');
const { requireRole } = require('../middleware/workspaceScope');

const router = express.Router();

router.get('/', asyncHandler(controller.list));
router.post('/', requireRole('QA_LEAD'), asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.get));
router.patch('/:id', requireRole('QA_LEAD'), asyncHandler(controller.update));
router.delete('/:id', requireRole('QA_LEAD'), asyncHandler(controller.remove));
router.post('/:id/public-share', requireRole('QA_LEAD'), asyncHandler(controller.setPublicShare));

module.exports = router;
