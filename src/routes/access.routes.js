const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const service = require('../services/accessRequests.service');
const prisma = require('../lib/prisma');

const router = express.Router();
const requestSchema = z.object({
  workspaceName: z.string().trim().min(2).max(100),
  projectName: z.string().trim().min(2).max(100),
  kind: z.enum(['TEAM', 'PERSONAL']),
});

async function requirePlatformAdmin(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isPlatformAdmin: true } });
    if (!user?.isPlatformAdmin) return res.status(403).json({ error: 'Platform admin access required' });
    next();
  } catch (err) { next(err); }
}

router.use(requireAuth);
router.get('/requests/mine', asyncHandler(async (req, res) => res.json(await service.myRequests(req.user.id))));
router.post('/requests', asyncHandler(async (req, res) => {
  res.status(201).json(await service.requestWorkspace(req.user.id, requestSchema.parse(req.body)));
}));
router.get('/admin/requests', requirePlatformAdmin, asyncHandler(async (req, res) => res.json(await service.listRequests())));
router.post('/admin/requests/:id/approve', requirePlatformAdmin, asyncHandler(async (req, res) => {
  res.json(await service.reviewRequest(req.params.id, req.user.id, true));
}));
router.post('/admin/requests/:id/reject', requirePlatformAdmin, asyncHandler(async (req, res) => {
  res.json(await service.reviewRequest(req.params.id, req.user.id, false));
}));
router.get('/admin/overview', requirePlatformAdmin, asyncHandler(async (req, res) => res.json(await service.overview())));
router.patch('/admin/workspaces/:workspaceId/users/:userId/role', requirePlatformAdmin, asyncHandler(async (req, res) => {
  const { role } = z.object({ role: z.enum(['QA_LEAD', 'TESTER', 'VIEWER']) }).parse(req.body);
  res.json(await service.changeMemberRole(req.params.workspaceId, req.params.userId, role, req.user.id));
}));
router.post('/admin/workspaces/:workspaceId/enter', requirePlatformAdmin, asyncHandler(async (req, res) => {
  res.json(await service.enterWorkspace(req.params.workspaceId, req.user.id));
}));
router.delete('/admin/workspaces/:workspaceId/users/:userId', requirePlatformAdmin, asyncHandler(async (req, res) => {
  res.json(await service.removeMember(req.params.workspaceId, req.params.userId, req.user.id));
}));

module.exports = router;
