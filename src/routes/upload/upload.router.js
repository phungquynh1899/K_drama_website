const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const uploadController = require('../../controllers/upload/upload.controller');
const fs = require('fs');
const authUser = require('../../middlewares/authUser.middleware')

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
const chunkUpload = multer({ 
  storage: chunkStorage, 
  limits: { fileSize: 70 * 1024 * 1024 } 
}); // 64MB max per chunk

// Chunk upload endpoint
router.post('/chunk', authUser, chunkUpload.single('chunk'), uploadController.uploadChunk);

// Complete upload endpoint
router.post('/complete', authUser, uploadController.completeUpload);

// Series chunk upload endpoint
router.post('/series-chunk', authUser, chunkUpload.single('chunk'), uploadController.uploadSeriesChunk);

// Series complete upload endpoint
router.post('/series-complete', authUser, uploadController.completeSeriesUpload);

module.exports = router;
