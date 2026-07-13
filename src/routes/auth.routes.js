const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const controller = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', asyncHandler(controller.register));
router.post('/login', asyncHandler(controller.login));
router.get('/me', requireAuth, asyncHandler(controller.me));
router.patch('/me', requireAuth, asyncHandler(controller.updateMe));

module.exports = router;
