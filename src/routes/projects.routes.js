const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/projects.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.get));
router.patch('/:id', asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));
router.post('/:id/public-share', asyncHandler(controller.setPublicShare));

module.exports = router;
