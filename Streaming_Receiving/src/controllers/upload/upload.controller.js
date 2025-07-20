const uploadService = require('../../services/upload/upload.service');
const modeSwitchService = require('../../services/mode-switch/mode-switch.service');

exports.uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Call the service to handle any extra logic (optional for now)
    await uploadService.handleUpload(req.file);
    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
      }
    });
  } catch (error) {
    next(error);
  }
};

// In-memory map to track active uploads per user (replace with DB/Redis in production)
const activeUploads = {};
const MAX_CONCURRENT_UPLOADS = 3;

exports.uploadChunk = async (req, res, next) => {
  try {
    console.log('received chunk size' + req.file.size)
    // TODO: Replace with real user ID from auth middleware
    const userId = req.user ? req.user.id : req.body.userId || 'anonymous';
    const { uploadId, chunkIndex, totalChunks } = req.body;
    if (!uploadId || chunkIndex === undefined || !totalChunks) {
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

    // Save chunk (already handled by multer)
    await uploadService.handleChunkUpload(req.file, uploadId, chunkIndex);
    res.status(200).json({ message: 'Chunk uploaded', chunkIndex });
  } catch (error) {
    next(error);
  }
};

exports.completeUpload = async (req, res, next) => {
  try {
    // TODO: Replace with real user ID from auth middleware
    const userId = req.user ? req.user.id : req.body.userId || 'anonymous';
    const { uploadId, totalChunks, filename } = req.body;
    if (!uploadId || !totalChunks || !filename) {
      return res.status(400).json({ error: 'Missing uploadId, totalChunks, or filename' });
    }
    
    // Verify all chunks are present without merging
    const chunkInfo = await uploadService.verifyChunksComplete(uploadId, totalChunks, filename);
    
    // Remove from active uploads
    if (activeUploads[userId]) {
      activeUploads[userId].delete(uploadId);
    }
    
    // Request laptop to switch to upload mode
    console.log('All chunks received, requesting laptop to switch to upload mode...');
    const modeSwitchResult = await modeSwitchService.requestUploadMode({
      uploadId,
      totalChunks,
      filename,
      chunkDirectory: chunkInfo.chunkDirectory
    });
    
    if (modeSwitchResult.success) {
      console.log('Successfully requested mode switch to laptop');
      res.status(200).json({ 
        message: 'Upload complete - all chunks received and laptop notified', 
        uploadId,
        totalChunks,
        chunkDirectory: chunkInfo.chunkDirectory,
        status: 'chunks_ready',
        laptopModeSwitch: modeSwitchResult.response
      });
    } else {
      console.warn('Failed to request mode switch to laptop:', modeSwitchResult.error);
      res.status(200).json({ 
        message: 'Upload complete - all chunks received (laptop notification failed)', 
        uploadId,
        totalChunks,
        chunkDirectory: chunkInfo.chunkDirectory,
        status: 'chunks_ready',
        laptopModeSwitch: {
          success: false,
          error: modeSwitchResult.error
        }
      });
    }
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

exports.testModeSwitch = async (req, res, next) => {
  try {
    const { uploadId, totalChunks, filename, chunkDirectory } = req.body;
    
    console.log('Testing mode switch with data:', { uploadId, totalChunks, filename, chunkDirectory });
    
    const modeSwitchResult = await modeSwitchService.requestUploadMode({
      uploadId: uploadId || 'test_upload_123',
      totalChunks: totalChunks || 5,
      filename: filename || 'test_video.mp4',
      chunkDirectory: chunkDirectory || '/path/to/test/chunks'
    });
    
    res.status(200).json({
      message: 'Mode switch test completed',
      result: modeSwitchResult
    });
  } catch (error) {
    next(error);
  }
};
