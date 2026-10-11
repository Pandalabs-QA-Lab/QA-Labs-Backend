const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const service = require('../services/accessRequests.service');
const adminUsers = require('../services/adminUsers.service');
const adminWorkspaces = require('../services/adminWorkspaces.service');
const prisma = require('../lib/prisma');

const router = express.Router();
const requestSchema = z.object({
  workspaceName: z.string().trim().min(2).max(100),
  projectName: z.string().trim().min(2).max(100),
  kind: z.enum(['TEAM', 'PERSONAL']),
});
const adminAccountSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(12, 'Temporary password must be at least 12 characters'),
  workspaceId: z.string().uuid().optional(),
});
const listQuerySchema = z.object({
  search: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
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
router.get('/admin/users', requirePlatformAdmin, asyncHandler(async (req, res) => {
  const { search, page } = listQuerySchema.parse(req.query);
  res.json(await service.listAdminUsers(search, page));
}));
router.get('/admin/workspaces', requirePlatformAdmin, asyncHandler(async (req, res) => {
  const { search, page } = listQuerySchema.parse(req.query);
  res.json(await service.listAdminWorkspaces(search, page));
}));
router.delete('/admin/workspaces/:workspaceId', requirePlatformAdmin, asyncHandler(async (req, res) => {
  const workspaceId = z.string().uuid().parse(req.params.workspaceId);
  const { confirmName } = z.object({ confirmName: z.string().min(1).max(100) }).parse(req.body);
  res.json(await adminWorkspaces.deleteWorkspace(workspaceId, confirmName));
}));
router.post('/admin/users', requirePlatformAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await adminUsers.createAccount(req.user.id, adminAccountSchema.parse(req.body)));
}));
router.delete('/admin/users/:userId', requirePlatformAdmin, asyncHandler(async (req, res) => {
  res.json(await adminUsers.deleteAccount(req.user.id, req.params.userId));
}));
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
