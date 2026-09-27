const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/bugs.controller');
const { requireRole } = require('../middleware/workspaceScope');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.list));
router.post('/', requireRole('QA_LEAD', 'TESTER'), asyncHandler(controller.create));
router.post('/bulk', requireRole('QA_LEAD', 'TESTER'), asyncHandler(controller.bulkCreate));
router.get('/:id', asyncHandler(controller.get));
router.patch('/:id', requireRole('QA_LEAD', 'TESTER'), asyncHandler(controller.update));
router.delete('/:id', requireRole('QA_LEAD'), asyncHandler(controller.remove));

module.exports = router;
