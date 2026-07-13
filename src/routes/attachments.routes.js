const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const upload = require('../middleware/upload');
const controller = require('../controllers/attachments.controller');

const router = express.Router();

router.post('/', upload.single('file'), asyncHandler(controller.upload));
router.get('/:id/download', asyncHandler(controller.download));
router.delete('/:id', asyncHandler(controller.remove));

module.exports = router;
