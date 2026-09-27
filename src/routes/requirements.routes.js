const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/requirements.controller');
const { requireRole } = require('../middleware/workspaceScope');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.list));
router.post('/', requireRole('QA_LEAD'), asyncHandler(controller.create));
router.post('/bulk', requireRole('QA_LEAD'), asyncHandler(controller.bulkCreate));
router.patch('/:id', requireRole('QA_LEAD'), asyncHandler(controller.update));
router.delete('/:id', requireRole('QA_LEAD'), asyncHandler(controller.remove));

module.exports = router;
