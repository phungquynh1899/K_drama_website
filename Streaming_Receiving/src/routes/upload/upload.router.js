const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const uploadController = require('../../controllers/upload/upload.controller');
const fs = require('fs');

// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
    storage: storage,
    limits: {fileSize: 70 * 1024 * 1024} //64mb max per chunk + some more data
 });

// Multer storage for chunk uploads
const chunkStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadId = req.body.uploadId;
    const dir = path.join(__dirname, '../../public/uploads/tmp', uploadId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `chunk_${req.body.chunkIndex}`);
  }
});
const chunkUpload = multer({ storage: chunkStorage, limits: { fileSize: 70 * 1024 * 1024 } }); // 64MB max per chunk

// POST /api/v1/upload/
router.post('/', upload.single('videoFile'), uploadController.uploadVideo);

// Chunk upload endpoint
router.post('/chunk', chunkUpload.single('chunk'), uploadController.uploadChunk);

// Complete upload endpoint
router.post('/complete', uploadController.completeUpload);

// Get chunk information endpoint
router.get('/chunks/:uploadId', uploadController.getChunkInfo);

// Test mode switch endpoint (for debugging)
router.post('/test-mode-switch', uploadController.testModeSwitch);

module.exports = router;
