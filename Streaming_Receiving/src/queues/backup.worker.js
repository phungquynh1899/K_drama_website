console.log('Backup worker is running and waiting for jobs...');
const { Worker } = require('bullmq');
const axios = require('axios');
const checkDiskSpace = require('check-disk-space').default;
const path = require('path');
const os = require('os');

const connection = { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT };
//file này không thể đọc dữ liệu từ .env file, nên bát buộc viết tay 
const RECEIVER_BASE_URL = "http://localhost:3003"; // Change to your actual host

const backupWorker = new Worker('backup', async job => {
  console.log(`🔄 Processing job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`);
  
  const { requireEmptyDiskSpace, videoId, linkToNoticeThatYouAreReadyToReceiveBackup } = job.data;

  // 1. Check disk space
  // Use the appropriate path for the operating system
  const checkPath = os.platform() === 'win32' ? 'C:\\' : '/';
  const diskInfo = await checkDiskSpace(checkPath);
  const requiredBytes = parseInt(requireEmptyDiskSpace) * 1024 * 1024; // for MB

  if (diskInfo.free < requiredBytes) {
    throw new Error('Not enough disk space');
  }

  // 2. Notify sender with additional links
  const payload = {
    videoId,
    linkToReceive: `${RECEIVER_BASE_URL}/api/v1/backup/receive`,
    linkToNoticeThatBackupComplete: `${RECEIVER_BASE_URL}/api/v1/backup/complete`
  };
  console.log(payload)

  await axios.post(linkToNoticeThatYouAreReadyToReceiveBackup, payload);

  return { status: 'ready', videoId };
}, { 
  connection,
  // Add retry configuration
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
});

backupWorker.on('completed', job => {
  console.log(`✅ Backup job ${job.id} completed successfully`);
});

backupWorker.on('failed', (job, err) => {
  const remainingAttempts = job.opts.attempts - job.attemptsMade;
  
  if (remainingAttempts > 0) {
    console.log(`⚠️  Backup job ${job.id} failed: ${err.message}`);
    console.log(`🔄 BullMQ will automatically retry ${remainingAttempts} more time(s) in ${job.opts.backoff.delay}ms`);
    console.log(`📝 This is attempt ${job.attemptsMade} of ${job.opts.attempts}`);
  } else {
    console.log(`❌ Backup job ${job.id} failed permanently after ${job.attemptsMade} attempts: ${err.message}`);
    console.log(`💡 This job will NOT be retried automatically. Use manage-failed-jobs.js to retry manually.`);
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down backup worker gracefully...');
  await backupWorker.close();
  process.exit(0);
});
