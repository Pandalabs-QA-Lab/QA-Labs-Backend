const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/testPlans.controller');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.patch('/:id', asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));
router.post('/:id/link-run', asyncHandler(controller.linkRun));

module.exports = router;
