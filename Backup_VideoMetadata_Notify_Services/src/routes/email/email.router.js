const express = require('express');
const router = express.Router();
const emailController = require('../../controllers/email/email.controller');

// POST /api/v1/email/send
router.post('/send', emailController.sendEmail);

module.exports = router; 