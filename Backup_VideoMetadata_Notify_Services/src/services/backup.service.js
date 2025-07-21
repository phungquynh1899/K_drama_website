const { Queue } = require('bullmq');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getFolderSizeSync, formatBytes } = require('../utils/diskSpace.util');

// Configuration (replace with your actual config or env variables)
const REDIS_OPTIONS = { host: '192.168.1.34', port: 6379 };
const BACKUP_QUEUE_NAME = 'backup';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Initialize BullMQ queue
const backupQueue = new Queue(BACKUP_QUEUE_NAME, { connection: REDIS_OPTIONS });

/**
 * Push a backup job to BullMQ
 * @param {Object} jobData - { requireEmptyDiskSpace, videoId, linkToNoticeThatYouAreReadyToReceiveBackup }
 */
async function pushBackupJob(jobData) {
  await backupQueue.add('backup', jobData);
}

/**
 * Wait for receiver notification (polling or webhook-based, here is polling for simplicity)
 * @param {string} readyUrl - The URL to poll for readiness
 * @param {number} videoId
 * @returns {Promise<Object>} - { linkToReceive, linkToNoticeThatBackupComplete }
 */
async function waitForReceiverReady(readyUrl, videoId) {
  // Poll every 2 seconds for up to 2 minutes
  for (let i = 0; i < 60; i++) {
    try {
      const res = await axios.post(readyUrl, { videoId });
      if (res.status === 200) {
        const data = res.data;
        if (data.linkToReceive && data.linkToNoticeThatBackupComplete) {
          return data;
        }
      }
    } catch (err) {
      // Ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Timeout waiting for receiver to be ready');
}

/**
 * Upload a single file with retry logic
 */
async function uploadFileWithRetry(linkToReceive, filePath, videoId) {
  const fileName = path.basename(filePath);
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const stat = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);
      const res = await axios.post(linkToReceive, fileStream, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'videoid': videoId,
          'filename': fileName,
        },
      });
      if (res.status === 200) return true;
      throw new Error(`Upload failed: ${res.status}`);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

/**
 * Notify receiver that backup is complete and get missing files (if any)
 */
async function notifyBackupComplete(linkToNoticeThatBackupComplete, videoId) {
  const res = await axios.post(linkToNoticeThatBackupComplete, { videoId });
  if (res.status !== 200) throw new Error('Failed to notify backup complete');
  return res.data;
}

/**
 * Calculate the required MB for a given videoId (size of public/hls/{videoId})
 * @param {number|string} videoId
 * @returns {Object} { sizeBytes, sizeMB, formatted }
 */
function calculateRequiredBackupSize(videoId) {
  const hlsFolder = path.join(__dirname, '../public/hls', String(videoId));
  const sizeBytes = getFolderSizeSync(hlsFolder);
  const sizeMB = sizeBytes / (1024 * 1024);
  return {
    sizeBytes,
    sizeMB: parseFloat(sizeMB.toFixed(2)),
    formatted: formatBytes(sizeBytes),
    folder: hlsFolder,
  };
}

/**
 * Main sender backup workflow
 * @param {Object} options - { videoId, files, requireEmptyDiskSpace, readyUrl }
 */
async function runSenderBackupWorkflow({ videoId, files, requireEmptyDiskSpace, readyUrl }) {
  // 1. Push job to BullMQ
  await pushBackupJob({
    requireEmptyDiskSpace,
    videoId,
    linkToNoticeThatYouAreReadyToReceiveBackup: readyUrl,
  });

  // 2. Wait for receiver to be ready
  const { linkToReceive, linkToNoticeThatBackupComplete } = await waitForReceiverReady(readyUrl, videoId);

  // 3. Upload files with retry logic
  for (const filePath of files) {
    await uploadFileWithRetry(linkToReceive, filePath, videoId);
  }

  // 4. Notify receiver and handle missing files
  let response = await notifyBackupComplete(linkToNoticeThatBackupComplete, videoId);
  while (response.missingFiles && response.missingFiles.length > 0) {
    for (const missingFile of response.missingFiles) {
      const filePath = files.find(f => path.basename(f) === missingFile);
      if (filePath) {
        await uploadFileWithRetry(linkToReceive, filePath, videoId);
      }
    }
    response = await notifyBackupComplete(linkToNoticeThatBackupComplete, videoId);
  }
  return { status: 'OK' };
}

module.exports = {
  pushBackupJob,
  waitForReceiverReady,
  uploadFileWithRetry,
  notifyBackupComplete,
  runSenderBackupWorkflow,
  calculateRequiredBackupSize,
};
