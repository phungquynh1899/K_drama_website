const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const receiveController = require('../../controllers/receive/receive.controller');
const apiKeyAuth = require('../../middlewares/apiKeyAuth');

const VIDEO_CHUNKS_ROOT = process.env.VIDEO_CHUNKS_ROOT || path.join(__dirname, '../../data/videos');
const chunkStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const { series, episode } = req.params;
        const dest = path.join(VIDEO_CHUNKS_ROOT, series, episode);
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        const { chunk } = req.params;
        cb(null, chunk);
    }
});
const upload = multer({ storage: chunkStorage });

// POST /api/v1/receive/upload-chunk/:series/:episode/:chunk
router.post('/upload-chunk/:series/:episode/:chunk', apiKeyAuth, upload.single('chunk'), receiveController.receiveChunk);

module.exports = router; 