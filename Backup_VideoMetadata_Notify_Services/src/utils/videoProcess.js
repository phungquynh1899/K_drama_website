const uploadService = require('../services/upload/upload.service');
const scanVideoWithClamAV = require('./clamAV.util');
const transcodeVideoTo720p = require('./transcodeVideo.util');
const generateStreamingChunks = require('./generateStreamChunk.utils');
const streamService = require('../services/videostreaming/stream.service');
const backupService = require('../services/backup.service');
const fs = require('fs');

/**
 * Background processing for uploaded video: merge, scan, transcode, chunk.
 * @param {Object} params
 * @param {string} params.uploadId
 * @param {number} params.totalChunks
 * @param {string} params.filename
 * @param {string} params.userId
 */
async function processUploadedVideo({ uploadId, totalChunks, filename, userId, videoId }) {
  try {
    // Merge chunks into a single video file
    let mergedFilePath;
    try {
      mergedFilePath = await uploadService.mergeChunks(uploadId, totalChunks, filename);
      console.log(`[${uploadId}] Chunks merged: ${mergedFilePath}`);
    } catch (mergeErr) {
      console.error(`[${uploadId}] Failed to merge chunks:`, mergeErr.message);
      return;
    }

    // Virus scan
    try {
      const scanResult = await scanVideoWithClamAV(mergedFilePath);
      if (!scanResult.isClean) {
        console.warn(`[${uploadId}] Virus detected, cleaning up.`);
        fs.unlinkSync(mergedFilePath);
        return;
      }
      console.log(`[${uploadId}] Virus scan passed.`);
    } catch (scanErr) {
      console.error(`[${uploadId}] Virus scan error:`, scanErr.message);
      fs.unlinkSync(mergedFilePath);
      return;
    }

    // Transcode to 720p
    let transcodedPath;
    try {
      transcodedPath = await transcodeVideoTo720p(mergedFilePath, uploadId);
      if (!transcodedPath) {
        throw new Error('Transcoding failed');
      }
      console.log(`[${uploadId}] Transcoding complete: ${transcodedPath}`);
    } catch (transcodeErr) {
      console.error(`[${uploadId}] Transcoding error:`, transcodeErr.message);
      fs.unlinkSync(mergedFilePath);
      return;
    }

    // Generate streaming chunks
    try {
      const streamingInfo = await generateStreamingChunks(transcodedPath, String(videoId));
      if (!streamingInfo) {
        throw new Error('Streaming chunk generation failed');
      }
      console.log(`[${uploadId}] Streaming chunks generated.`);
    } catch (streamErr) {
      console.error(`[${uploadId}] Streaming chunk error:`, streamErr);
      // Clean up transcoded file on error
      if (fs.existsSync(transcodedPath)) {
        fs.unlinkSync(transcodedPath);
        console.log(`[${uploadId}] Cleaned up transcoded file due to streaming error.`);
      }
      return;
    }

    // Clean up original merged file (keep transcoded version)
    try {
      if (fs.existsSync(mergedFilePath) && mergedFilePath !== transcodedPath) {
        fs.unlinkSync(mergedFilePath);
        console.log(`[${uploadId}] Cleaned up merged file.`);
      }
    } catch (cleanupErr) {
      console.warn(`[${uploadId}] Cleanup error:`, cleanupErr.message);
    }

    // Clean up transcoded video file after streaming chunks are generated
    try {
      if (fs.existsSync(transcodedPath)) {
        fs.unlinkSync(transcodedPath);
        console.log(`[${uploadId}] Cleaned up transcoded video file.`);
      }
    } catch (cleanupErr) {
      console.warn(`[${uploadId}] Failed to clean up transcoded file:`, cleanupErr.message);
    }

    // Trigger backup to server A after streaming chunks are generated
    const backupSizeInfo = backupService.calculateRequiredBackupSize(videoId);
    // Round up to the next MB for requireEmptyDiskSpace
    const requireEmptyDiskSpace = Math.ceil(backupSizeInfo.sizeMB) + 'MB';
    const readyUrl = 'http://localhost:3002/api/v1/backup/readyForBackup'; // Replace with actual sender endpoint
    await backupService.pushBackupJob({
      requireEmptyDiskSpace,
      videoId,
      linkToNoticeThatYouAreReadyToReceiveBackup: readyUrl,
    });

    //send upload database request 
    //notify user email (implement later)

    // Switch back to streaming mode
    try {
      streamService.setMode('streaming');
      console.log(`[${uploadId}] Switched back to streaming mode.`);
    } catch (modeErr) {
      console.error(`[${uploadId}] Failed to switch to streaming mode:`, modeErr.message);
    }
  } catch (err) {
    console.error(`[${uploadId}] Unexpected error in video post-process:`, err);
    
    // Attempt backup even if there was an error (in case chunks were generated)
    if (videoId) {
      try {
        console.log(`[${uploadId}] Attempting backup after error for videoId: ${videoId}`);
        const backupResult = await backupService.triggerBackup(videoId);
        
        if (backupResult.success) {
          console.log(`[${uploadId}] Backup request sent successfully after error: ${backupResult.message}`);
          if (backupResult.calculatedSize) {
            console.log(`[${uploadId}] Calculated backup size after error: ${backupResult.calculatedSize}`);
          }
        } else {
          console.warn(`[${uploadId}] Backup request failed after error: ${backupResult.message}`);
          if (backupResult.retryActive) {
            console.log(`[${uploadId}] Retry mechanism activated after error - will retry every 5 minutes`);
          }
        }
      } catch (backupErr) {
        console.error(`[${uploadId}] Backup error after process error:`, backupErr.message);
      }
    }
    
    // Switch back to streaming mode even on error
    try {
      streamService.setMode('streaming');
      console.log(`[${uploadId}] Switched back to streaming mode after error.`);
    } catch (modeErr) {
      console.error(`[${uploadId}] Failed to switch to streaming mode after error:`, modeErr.message);
    }
  }
}

module.exports = processUploadedVideo; 