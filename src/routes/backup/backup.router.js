const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const backupController = require('../../controllers/backup/backup.controller.js');

// Multer storage config: dynamically set destination based on videoId in header
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const videoId = req.headers['videoid'];
      if (!videoId) return cb(new Error('Missing videoId in header'));
      const dir = path.join(__dirname, '../../public/hls', videoId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      // Use the filename from the form field if provided, else originalname
      cb(null, req.body.filename || file.originalname);
    }
  });
  
  const upload = multer({ storage: storage });

// Endpoint for server B to check if server A can accept backup
router.post('/can-accept-backup', backupController.canAcceptBackup);


// Endpoint for server B to send backup to server A
router.post('/receive-backup', upload.single('segment'), backupController.receiveBackup);

// Endpoint for server B to complete backup process
router.post('/complete-backup', backupController.completeBackup);

module.exports = router;