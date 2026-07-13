const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/testRuns.controller');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.getDraft));
router.put('/', asyncHandler(controller.putDraft));
router.delete('/', asyncHandler(controller.deleteDraft));

module.exports = router;
