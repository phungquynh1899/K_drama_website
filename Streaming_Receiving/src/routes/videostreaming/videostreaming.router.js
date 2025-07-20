const express = require('express');
const router = express.Router();
const videostreamingController = require('../../controllers/videostreaming/videostreaming.controller');

// GET /api/v1/videostreaming/:series/:episode/:chunk
router.get('/:series/:episode/:chunk', videostreamingController.streamChunk);

module.exports = router; 