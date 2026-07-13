const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/testRuns.controller');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.get));
router.patch('/:id', asyncHandler(controller.update));

module.exports = router;
