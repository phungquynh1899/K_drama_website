const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const uploadController = require('../../controllers/upload/upload.controller');
const fs = require('fs');

// Multer storage for chunk uploads
const chunkStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('uploadId is ', req.headers['x-upload-id'])
    const uploadId = req.headers['x-upload-id']
    const dir = path.join(__dirname, '../../public/uploads/tmp', uploadId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const chunkIndex = req.headers['x-chunk-index']
    cb(null, `chunk_${chunkIndex}`);
  }
});
const chunkUpload = multer({ storage: chunkStorage, limits: { fileSize: 70 * 1024 * 1024 } }); // 64MB max per chunk


// Chunk upload endpoint
router.post('/chunk', chunkUpload.single('chunk'), uploadController.uploadChunk);

// Complete upload endpoint
router.post('/complete', uploadController.completeUpload);

// Get chunk information endpoint
router.get('/chunks/:uploadId', uploadController.getChunkInfo);

// Disk space check endpoint
router.post('/can-accept-upload', uploadController.canAcceptUpload);

router.post('/cancelJob', uploadController.cancelJob)

module.exports = router;
