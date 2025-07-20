const express = require('express');
const router = express.Router();
const hlsController = require('../../controllers/videostreaming/hls.controller');

// HLS streaming endpoint with mode checking
router.get('/:videoId', hlsController.streamHLS);

// Serve HLS segments (.ts files)
router.get('/:videoId/segment/:segmentName', hlsController.serveSegment);

module.exports = router; 