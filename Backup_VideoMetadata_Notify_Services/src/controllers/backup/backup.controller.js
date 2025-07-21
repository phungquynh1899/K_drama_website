const backupService = require('../../services/backup.service');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Added axios for notification




/**
 * POST /api/v1/backup/readyForBackup
 * Receives notification from receiver, then uploads all .m3u8 and .ts files for the given videoId
 */
exports.readyForBackup = async (req, res, next) => {
  try {
    const { videoId, linkToReceive, linkToNoticeThatBackupComplete } = req.body;
    if (!videoId || !linkToReceive || !linkToNoticeThatBackupComplete) {
      // Re-add job to BullMQ for retry
      await backupService.pushBackupJob(req.body);
      return res.status(400).json({ error: 'Missing required fields: videoId, linkToReceive, linkToNoticeThatBackupComplete. Job re-queued.' });
    }

    console.log("link to receiver" + linkToReceive)
    console.log("link to complete" + linkToNoticeThatBackupComplete)

    // 1. Find all .m3u8 and .ts files in public/hls/{videoId}
    const videoDir = path.join(__dirname, '../../public/hls', String(videoId));
    if (!fs.existsSync(videoDir)) {
      // Re-add job to BullMQ for retry
      await backupService.pushBackupJob(req.body);
      return res.status(404).json({ error: `Video folder not found: ${videoDir}. Job re-queued.` });
    }
    const allFiles = fs.readdirSync(videoDir);
    const filesToSend = allFiles.filter(f => f.endsWith('.m3u8') || f.endsWith('.ts'));
    if (filesToSend.length === 0) {
      // Re-add job to BullMQ for retry
      await backupService.pushBackupJob(req.body);
      return res.status(404).json({ error: 'No .m3u8 or .ts files found to send. Job re-queued.' });
    }

    // Respond to sender immediately
    res.json({ status: 'processing', message: 'ok' });

    // 2. Upload each file with up to 3 retries
    const uploadedFiles = [];
    for (const fileName of filesToSend) {
      const filePath = path.join(videoDir, fileName);
      let success = false;
      for (let attempt = 1; attempt <= 3 && !success; attempt++) {
        try {
          const stat = fs.statSync(filePath);
          const fileStream = fs.createReadStream(filePath);
          const uploadRes = await axios.post(linkToReceive, fileStream, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'videoid': videoId,
              'filename': fileName,
            },
          });
          if (uploadRes.status === 200) {
            success = true;
            uploadedFiles.push(fileName);
          }
        } catch (err) {
          if (attempt === 3) {
            // After 3 failed attempts to upload this file, call cancelJob and let job fail
            try {
              await axios.post(process.env.BACKUP_RECEIVER_SERVER + `/api/v1/backup/cancelJob`, {
                videoId: String(videoId),
                reason: 'Backup upload failed after 3 retries',
                error: `Failed to upload file: ${fileName} after 3 attempts`,
                failedFiles: [fileName],
                uploadedFiles: uploadedFiles
              });
              console.log(`Called cancelJob for videoId ${videoId} due to upload failure of ${fileName}`);
            } catch (cancelError) {
              console.error('Failed to call cancelJob:', cancelError.message);
            }
            
            // Let the job fail - don't re-add to BullMQ
            return;
          }
        }
      }
    }

    // 3. Notify receiver of completion status with retry logic
    let completeStatus = 'success';
    let completeMessage = 'All files uploaded successfully.';
    let notificationSuccess = false;
    
    for (let attempt = 1; attempt <= 3 && !notificationSuccess; attempt++) {
      try {
        const completeRes = await axios.post(linkToNoticeThatBackupComplete, {
          videoId,
          status: completeStatus,
          message: completeMessage,
          uploadedFiles,
        });
        if (completeRes.status === 200) {
          notificationSuccess = true;
        } else {
          if (attempt === 3) {
            // After 3 failed attempts to notify receiver, call cancelJob and let job fail
            try {
              await axios.post(process.env.BACKUP_RECEIVER_SERVER + `/api/v1/backup/cancelJob`, {
                videoId: String(videoId),
                reason: 'Failed to notify receiver of backup completion after 3 retries',
                error: `Failed to notify receiver at ${linkToNoticeThatBackupComplete}`,
                failedFiles: [],
                uploadedFiles: uploadedFiles
              });
              console.log(`Called cancelJob for videoId ${videoId} due to notification failure`);
            } catch (cancelError) {
              console.error('Failed to call cancelJob:', cancelError.message);
            }
            
            // Let the job fail - don't re-add to BullMQ
            return;
          }
        }
      } catch (err) {
        if (attempt === 3) {
          // After 3 failed attempts to notify receiver, call cancelJob and let job fail
          try {
            await axios.post(process.env.BACKUP_RECEIVER_SERVER + `/api/backup/cancelJob`, {
              videoId: String(videoId),
              reason: 'Failed to notify receiver of backup completion after 3 retries',
              error: `Failed to notify receiver at ${linkToNoticeThatBackupComplete}: ${err.message}`,
              failedFiles: [],
              uploadedFiles: uploadedFiles
            });
            console.log(`Called cancelJob for videoId ${videoId} due to notification failure`);
          } catch (cancelError) {
            console.error('Failed to call cancelJob:', cancelError.message);
          }
          
          // Let the job fail - don't re-add to BullMQ
          return;
        }
      }
    }
  } catch (err) {
    next(err);
  }
};
