const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/requirements.controller');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.post('/bulk', asyncHandler(controller.bulkCreate));
router.patch('/:id', asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));

module.exports = router;
