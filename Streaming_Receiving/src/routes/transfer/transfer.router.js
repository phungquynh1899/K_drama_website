const express = require('express');
const router = express.Router();
const transferController = require('../../controllers/transfer/transfer.controller');

// POST /api/v1/transfer/notify-chunks-ready
router.post('/notify-chunks-ready', transferController.notifyChunksReady);

module.exports = router; 