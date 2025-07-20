const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const backupController = require('../../controllers/backup/backup.controller');

// Configure multer for file uploads
const BACKUP_ROOT = process.env.BACKUP_ROOT || path.join(__dirname, '../../hls/');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { videoId } = req.body;
    const dest = path.join(BACKUP_ROOT, videoId ? videoId.toString() : 'unknown');
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// POST /api/v1/backup/receive
router.post('/receive', upload.single('file'), backupController.receiveFile);

// POST /api/v1/backup/complete
router.post('/complete', backupController.completeBackup);

router.post('/cancelJob', backupController.cancelJob)

// (Optional) GET /api/v1/backup/status/:videoId
router.get('/status/:videoId', backupController.getBackupStatus);

module.exports = router; 