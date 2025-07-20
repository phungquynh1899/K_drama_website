const uploadService = require('../../services/upload/upload.service');
const { execSync } = require('child_process');
const streamService = require('../../services/videostreaming/stream.service');
const axios = require('axios');
const processUploadedVideo = require('../../utils/videoProcess');
// In-memory map to track active uploads per user (replace with DB/Redis in production)
const activeUploads = {};
const MAX_CONCURRENT_UPLOADS = 3;

exports.uploadChunk = async (req, res, next) => {
  try {
    console.log('received chunk size ' + req.file.size)
    // TODO: Replace with real user ID from auth middleware
    const uploadId = req.headers['x-upload-id'];
    const chunkIndex = req.headers['x-chunk-index'];
    const { totalChunks, userId } = req.body;
    if (!uploadId || !totalChunks || !userId) {
      console.log('thieu ')
      console.log(req.body.totalChunks)
      console.log(req.body.userId)
      console.log(uploadId)
      return res.status(400).json({ error: 'Missing uploadId, chunkIndex, or totalChunks' });
    }

    // Restrict concurrent uploads
    activeUploads[userId] = activeUploads[userId] || new Set();
    activeUploads[userId].add(uploadId);
    if (activeUploads[userId].size > MAX_CONCURRENT_UPLOADS) {
      activeUploads[userId].delete(uploadId);
      return res.status(429).json({ error: 'Max concurrent uploads reached (3)' });
    }

    // Retry logic: If chunk already exists, return success (idempotent)
    const chunkPath = req.file.path;
    const fs = require('fs');
    if (fs.existsSync(chunkPath)) {
      return res.status(200).json({ message: 'Chunk already uploaded', chunkIndex });
    }
  } catch (error) {
    next(error);
  }
};

exports.canAcceptUpload = async (req, res, next) => {
  try {
    console.log('morrnign')
    console.log('req.body:', req.body)
    const { requiredSpaceMB, notifyUrl, uploadId, userId } = req.body;
    console.log('destructured values:', { requiredSpaceMB, notifyUrl, uploadId, userId })
    console.log('about to check validation...')

    if (!requiredSpaceMB || !notifyUrl || !uploadId || !userId) {
      console.log('validation failed - missing required fields')
      return res.json({
        canAccept: false,
        message: 'Missing requiredSpaceMB, notifyUrl, userId or uploadId'
      });
    }
    console.log('hellllllllllo')

    // Check free disk space (cross-platform)
    let freeMB = 0;
    try {
      if (process.platform === 'win32') {
        // Windows: use wmic
        const stdout = execSync('wmic logicaldisk get size,freespace,caption');
        const lines = stdout.toString().split('\n');
        for (const line of lines) {
          if (line.includes(':')) {
            const parts = line.trim().split(/\s+/);
            if (parts.length === 3) {
              const free = parseInt(parts[1], 10);
              freeMB = Math.max(freeMB, Math.floor(free / (1024 * 1024)));
            }
          }
        }
      } else {
        // Unix-like: use df
        const stdout = execSync('df -m /');
        const lines = stdout.toString().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(/\s+/);
          freeMB = parseInt(parts[3], 10);
        }
      }
    } catch (err) {
      return res.json({
        canAccept: false,
        message: `Failed to check disk space: ${err.message}`
      });
    }
console.log('hiiiiiiiiiiiiiiii')
    if (freeMB >= requiredSpaceMB) {
      console.log('im in backup ')
      // Wait for all streams to finish, then notify Server A
      streamService.waitForStreamsThenNotify(async () => {
        //uploadId không truyền vào được await phía dưới,
        //vì đầy là 1 hàm callbackback
        try {
          console.log('im in wait for stream')
          await axios.post(notifyUrl, {
            uploadId: String(uploadId),
            userId: String(userId),
            serverB_chunk_URL: `/chunk`,
            serverB_complete_URL: `/complete`
          });
          console.log('Notified Server A: ready for upload');
        } catch (err) {
          console.error('Failed to notify Server A:', err.message);
        }
      });
      return res.json({ canAccept: true, freeMB });
    } else {
      return res.json({
        canAccept: false,
        freeMB,
        message: 'Not enough space available'
      });
    }
  } catch (error) {
    return res.json({ canAccept: false, message: error.message });
  }
};


exports.completeUpload = async (req, res, next) => {
  try {
    const { uploadId, userId, totalChunks, filename, filetype, videoId } = req.body;
    if (!uploadId || !totalChunks || !userId || !filename || !filetype || !videoId) {
      console.log(uploadId + "-" + userId + "-" + totalChunks + "-" +  filename + "-" + filetype + "-" + videoId)
      return res.status(400).json({ error: 'Missing uploadId, totalChunks' });
    }

    // Remove from active uploads
    if (activeUploads[userId]) {
      activeUploads[userId].delete(uploadId);
    }

    // Respond immediately
    res.status(200).json({ message: 'Upload complete, processing will continue in background.' });

    // Start heavy processing in background (do not await)
    processUploadedVideo({ uploadId, totalChunks, filename, userId, videoId });

  } catch (error) {
    next(error);
  }
};


exports.getChunkInfo = async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    if (!uploadId) {
      return res.status(400).json({ error: 'Missing uploadId' });
    }
    
    const chunkInfo = await uploadService.getChunkInfo(uploadId);
    res.status(200).json(chunkInfo);
  } catch (error) {
    next(error);
  }
};

exports.getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ error: 'Missing jobId' });
    }
    
    const jobStatus = backgroundProcessor.getJobStatus(jobId);
    if (!jobStatus) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.status(200).json(jobStatus);
  } catch (error) {
    next(error);
  }
};

exports.getUserJobs = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    
    const userJobs = backgroundProcessor.getUserJobs(userId);
    res.status(200).json({
      userId,
      jobs: userJobs,
      totalJobs: userJobs.length
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelJob = async (req, res, next) => {
  try {
    const { uploadId, userId, reason, totalChunks, error, failedChunkIndex } = req.body;
    
    console.log('Cancel job request received:', { uploadId, userId, reason, totalChunks, error, failedChunkIndex });
    
    // Validate required fields
    if (!uploadId || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: uploadId and userId',
        received: { uploadId, userId }
      });
    }

    // Remove from active uploads tracking
    let wasActiveUpload = false;
    if (activeUploads[userId]) {
      wasActiveUpload = activeUploads[userId].has(uploadId);
      activeUploads[userId].delete(uploadId);
      console.log(`Removed uploadId ${uploadId} from active uploads for userId ${userId}`);
    }

    // Clean up uploaded chunks
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '../../../uploads', uploadId);
    
    let chunksCleaned = 0;
    let totalChunksToClean = totalChunks || 0;
    
    try {
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        
        for (const file of files) {
          if (file.startsWith('chunk_') && file.endsWith('.tmp')) {
            const chunkPath = path.join(uploadDir, file);
            fs.unlinkSync(chunkPath);
            chunksCleaned++;
            console.log(`Deleted chunk: ${file}`);
          }
        }
        
        // Remove the upload directory if it's empty or only contains metadata
        const remainingFiles = fs.readdirSync(uploadDir);
        if (remainingFiles.length === 0 || (remainingFiles.length === 1 && remainingFiles[0] === 'metadata.json')) {
          fs.rmdirSync(uploadDir);
          console.log(`Removed upload directory: ${uploadDir}`);
        }
      }
    } catch (cleanupError) {
      console.error('Error during chunk cleanup:', cleanupError.message);
      // Don't fail the request if cleanup fails
    }

    // Log cancellation details
    const cancellationDetails = {
      uploadId,
      userId,
      reason: reason || 'User cancelled',
      wasActiveUpload,
      chunksCleaned,
      totalChunksToClean,
      failedChunkIndex: failedChunkIndex || null,
      error: error || null,
      timestamp: new Date().toISOString()
    };
    
    console.log('Upload cancelled successfully:', cancellationDetails);

    // Return success response
    return res.status(200).json({
      message: 'Upload cancelled successfully',
      uploadId,
      userId,
      cancellationDetails
    });

  } catch (error) {
    console.error('Error in cancelJob:', error);
    return res.status(500).json({ 
      error: 'Internal server error during cancellation',
      message: error.message 
    });
  }
};


