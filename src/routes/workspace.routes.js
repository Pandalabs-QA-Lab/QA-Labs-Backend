const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole } = require('../middleware/workspaceScope');
const controller = require('../controllers/teamMembers.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.getWorkspace));
router.patch('/', requireRole('QA_LEAD'), asyncHandler(controller.updateWorkspace));
router.post('/invite-link', requireRole('QA_LEAD'), asyncHandler(controller.generateInviteLink));
router.delete('/invite-link', requireRole('QA_LEAD'), asyncHandler(controller.revokeInviteLink));

module.exports = router;
