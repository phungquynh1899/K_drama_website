const express = require('express');
const router = express.Router();
const multer = require('multer');
const thumbnailController = require('../../controllers/thumbnail/thumbnail.controller');
const authUser = require('../../middlewares/authUser.middleware');

// Configure multer for thumbnail uploads (store in memory for processing)
const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1 // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// POST /api/v1/thumbnail/upload - Upload and process thumbnail
router.post('/upload', authUser, thumbnailUpload.single('thumbnail'), thumbnailController.uploadThumbnail);

//POST /api/v1/thumbnail/upload/series-upload - Upload and process thumbnail for series
router.post('/series-upload', authUser, thumbnailUpload.single('thumbnail'), thumbnailController.thumbnailSeriesUpload)

// PUT /api/v1/thumbnail/video/:videoId - Update video with thumbnail URL
router.put('/video/:videoId', authUser, thumbnailController.updateVideoThumbnail);


// DELETE /api/v1/thumbnail/video/:videoId - Delete thumbnail
router.delete('/video/:videoId', authUser, thumbnailController.deleteThumbnail);

// GET /api/v1/thumbnail/info/:filename - Get thumbnail info
router.get('/info/:filename', thumbnailController.getThumbnailInfo);

module.exports = router; 