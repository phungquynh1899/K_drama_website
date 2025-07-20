const express = require('express');
const router = express.Router();
const streamController = require('../../controllers/videostreaming/stream.controller');

// Stream a specific chunk
router.get('/chunk/:uploadId/:chunkIndex', streamController.streamChunk);

// Get current streaming status (number of active streams/workers)
router.get('/status', streamController.getStreamingStatus);

// Stop all streaming workers (for mode switch)
router.post('/stop-all', streamController.stopAllStreamingWorkers);

module.exports = router; 