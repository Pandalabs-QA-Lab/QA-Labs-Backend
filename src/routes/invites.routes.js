const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const loadActor = require('../middleware/loadActor');
const controller = require('../controllers/invites.controller');

const router = express.Router();

// Public - lets JoinPage show the workspace name before the visitor signs in.
router.get('/:token', asyncHandler(controller.resolve));

// Requires auth, but deliberately skips attachWorkspace: accepting an invite
// means joining a workspace *other* than the one in the caller's current JWT.
router.post('/:token/accept', requireAuth, loadActor, asyncHandler(controller.accept));

module.exports = router;
