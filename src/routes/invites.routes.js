const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const loadActor = require('../middleware/loadActor');
const { attachWorkspace, requireWorkspaceMember, requireRole } = require('../middleware/workspaceScope');
const controller = require('../controllers/invites.controller');

const router = express.Router();
const requireWorkspaceScope = (req, res, next) => req.membership.scope === 'PROJECT'
  ? res.status(403).json({ error: 'Workspace-wide access is required to manage invitations' })
  : next();

router.get('/pending', requireAuth, loadActor, asyncHandler(controller.pending));
router.get('/managed', requireAuth, attachWorkspace, requireWorkspaceMember, requireRole('QA_LEAD'), requireWorkspaceScope, asyncHandler(controller.managed));
router.post('/managed', requireAuth, attachWorkspace, requireWorkspaceMember, requireRole('QA_LEAD'), requireWorkspaceScope, loadActor, asyncHandler(controller.create));
router.delete('/managed/:id', requireAuth, attachWorkspace, requireWorkspaceMember, requireRole('QA_LEAD'), requireWorkspaceScope, asyncHandler(controller.revoke));

// Public - lets JoinPage show the workspace name before the visitor signs in.
router.get('/:token', asyncHandler(controller.resolve));

// Requires auth, but deliberately skips attachWorkspace: accepting an invite
// means joining a workspace *other* than the one in the caller's current JWT.
router.post('/:token/accept', requireAuth, loadActor, asyncHandler(controller.accept));

module.exports = router;
