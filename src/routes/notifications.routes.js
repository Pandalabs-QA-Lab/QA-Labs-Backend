const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/notifications.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.list));
router.post('/read-all', asyncHandler(controller.markAllAsRead));
router.post('/:id/read', asyncHandler(controller.markAsRead));
router.delete('/', asyncHandler(controller.clearAll));

module.exports = router;
