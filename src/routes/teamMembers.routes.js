const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole } = require('../middleware/workspaceScope');
const controller = require('../controllers/teamMembers.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.list));
router.post('/', requireRole('QA_LEAD'), asyncHandler(controller.create));
router.patch('/:id', requireRole('QA_LEAD'), asyncHandler(controller.update));
router.delete('/:id', requireRole('QA_LEAD'), asyncHandler(controller.remove));

module.exports = router;
