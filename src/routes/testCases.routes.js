const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/testCases.controller');

// mergeParams so :projectId from the parent mount path is visible here
const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.post('/bulk', asyncHandler(controller.bulkCreate));
router.get('/:id', asyncHandler(controller.get));
router.patch('/:id', asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));

module.exports = router;
