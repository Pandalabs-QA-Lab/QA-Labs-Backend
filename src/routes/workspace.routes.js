const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole } = require('../middleware/workspaceScope');
const controller = require('../controllers/teamMembers.controller');

const router = express.Router();

router.get('/', requireRole('QA_LEAD'), asyncHandler(controller.getWorkspace));
router.patch('/', requireRole('QA_LEAD'), asyncHandler(controller.updateWorkspace));

module.exports = router;
