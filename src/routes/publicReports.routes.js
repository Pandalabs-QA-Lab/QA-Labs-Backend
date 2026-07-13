const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/publicReports.controller');

const router = express.Router();

router.get('/:shareToken', asyncHandler(controller.get));

module.exports = router;
