const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/presence.controller');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.heartbeat));
router.delete('/', asyncHandler(controller.leave));

module.exports = router;
