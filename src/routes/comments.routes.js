const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/comments.controller');

// mergeParams so :projectId from the parent mount path is visible here
const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.delete('/:id', asyncHandler(controller.remove));

module.exports = router;
