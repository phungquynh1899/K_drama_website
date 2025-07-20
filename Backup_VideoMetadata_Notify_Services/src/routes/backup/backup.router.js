const express = require('express');
const router = express.Router();
const backupController = require('../../controllers/backup/backup.controller');


router.post('/readyForBackup', backupController.readyForBackup);
module.exports = router;
