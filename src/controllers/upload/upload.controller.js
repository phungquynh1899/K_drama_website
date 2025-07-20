const uploadService = require('../../services/upload/upload.service');
const modeSwitchService = require('../../services/mode-switch/mode-switch.service');
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const FileType = require('file-type');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

exports.uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // --- Video validation start ---
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv'];
    const fileName = req.file.originalname.toLowerCase();
    const ext = path.extname(fileName);
    // Extension check
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file extension' });
    }
    // Double extension check
    const base = fileName.slice(0, fileName.lastIndexOf('.'));
    if (base.includes('.')) {
      return res.status(400).json({ error: 'Invalid file name (double extension)' });
    }
    // MIME type check
    if (!req.file.mimetype.startsWith('video/')) {
      return res.status(400).json({ error: 'Invalid MIME type' });
    }
    // File signature check
    const buffer = fs.readFileSync(req.file.path);
    const type = await FileType.fromBuffer(buffer);
    if (!type || !['video/mp4', 'video/x-msvideo'].includes(type.mime)) {
      return res.status(400).json({ error: 'File content is not a valid mp4 or avi video' });
    }
    // --- Video validation end ---
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
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // --- Basic chunk validation start ---
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
    // Use filename from metadata if available, else from req.file
    const fileName = req.body.filename ? req.body.filename.toLowerCase() : req.file.originalname.toLowerCase();
    const ext = path.extname(fileName);
    // Extension check
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file extension' });
    }
    // Double extension check
    const base = fileName.slice(0, fileName.lastIndexOf('.'));
    if (base.includes('.')) {
      return res.status(400).json({ error: 'Invalid file name (double extension)' });
    }
    // --- Basic chunk validation end ---
    console.log('received chunk size' + req.file.size)
    // TODO: Replace with real user ID from auth middleware
    if(!req.body.userId){
      return res.status(400).json({error: `missing userId`})
    }
    const userId = req.body.userId;
    let { uploadId, chunkIndex, totalChunks, filename } = req.body;
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
  console.log('request user: ' + req.body.userId)
  try {
    // TODO: Replace with real user ID from auth middleware
    if(!req.body.userId){
      return res.status(400).json({error: `missing userId`})
    }
    const userId = req.body.userId;
    const { uploadId, totalChunks, filename, filetype, title, category, genre, year, country, description, total_size } = req.body;
    if (!uploadId || !totalChunks || !filename || !filetype || !title || !category || !genre) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Remove from active uploads
    if (activeUploads[userId]) {
      activeUploads[userId].delete(uploadId);
    }

    // 1. Create video in the database
    const db = BetterSqliteDatabase.getInstance();
    const video = await db.createVideo({
      title,
      description,
      year: year === 'unknown' ? null : year,
      genre,
      country,
      actors: [],
      duration_seconds: null,
      original_filename: filename,
      original_filetype: filetype,
      uploader_user_id: userId,
      status: 'staging',
      is_public: 1
    });
    const videoId = video.id;

    // 2. Create upload record in the database
    await db.createUpload({
      id: uploadId, // Use the uploadId from frontend as the primary key
      user_id: userId,
      video_id: videoId,
      filename,
      total_size: total_size,
      status: 'staging'
    });

    // Check with Server B if upload can be accepted
    const notifyUrl = `http://localhost:3000/api/v1/transfer/TransferFileFromServerAtoServerB`;
    const serverBResult = await uploadService.checkWithServerBAndUpdateStatus(uploadId, userId, filename, Math.ceil(total_size / (1024 * 1024)), notifyUrl);
    // Respond to client with the result from Server B and chunk info
    res.status(200).json({
      message: 'Upload complete - all chunks received',
      uploadId,
      totalChunks,
      videoId,
      status: serverBResult === 'accepted' ? 'chunks_sent_to_server_b' : 'pending',
      serverBResult
    });
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

// Series upload methods
exports.uploadSeriesChunk = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Basic chunk validation
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
    const fileName = req.body.filename ? req.body.filename.toLowerCase() : req.file.originalname.toLowerCase();
    const ext = path.extname(fileName);
    
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file extension' });
    }
    
    const base = fileName.slice(0, fileName.lastIndexOf('.'));
    if (base.includes('.')) {
      return res.status(400).json({ error: 'Invalid file name (double extension)' });
    }
    
    console.log('received series chunk size: ' + req.file.size);
    
    if (!req.body.userId) {
      return res.status(400).json({ error: 'missing userId' });
    }
    
    const userId = req.body.userId;
    let { uploadId, chunkIndex, totalChunks, filename } = req.body;
    
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
    if (fs.existsSync(chunkPath)) {
      return res.status(200).json({ message: 'Chunk already uploaded', chunkIndex });
    }
    
    // Save chunk (already handled by multer)
    await uploadService.handleChunkUpload(req.file, uploadId, chunkIndex);
    res.status(200).json({ message: 'Series chunk uploaded', chunkIndex });
  } catch (error) {
    next(error);
  }
};

exports.completeSeriesUpload = async (req, res, next) => {
  console.log('request user: ' + req.body.userId);
  try {
    if (!req.body.userId) {
      return res.status(400).json({ error: 'missing userId' });
    }
    
    const userId = req.body.userId;
    const { 
      uploadId, 
      totalChunks, 
      filename, 
      filetype, 
      title, 
      genre, 
      year, 
      country, 
      description, 
      actors,
      total_size,
      episodeNumber,
      seriesId,
      seriesName,
      seriesOption
    } = req.body;
    
    if (!uploadId || !totalChunks || !filename || !filetype || !title || !genre || !episodeNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Remove from active uploads
    if (activeUploads[userId]) {
      activeUploads[userId].delete(uploadId);
    }

    const db = BetterSqliteDatabase.getInstance();
    let finalSeriesId = seriesId;

    // Handle series creation if this is a new series
    if (!seriesId && seriesName) {
      // Get total episodes from request body
      const totalEpisodes = req.body.total_episodes;
      
      if (!totalEpisodes || totalEpisodes < 2) {
        return res.status(400).json({ 
          error: 'Series must have at least 2 episodes',
          message: 'Series phải có ít nhất 2 tập'
        });
      }
      
      // Create new series first
      const seriesData = {
        name: seriesName,
        description: description || 'unknown',
        year: year === 'unknown' ? null : year,
        genre,
        country: country || 'unknown',
        director: 'Unknown',
        cast: actors || 'Unknown',
        total_episodes: parseInt(totalEpisodes),
        uploader_user_id: userId,
        is_public: 1
      };
      
      const newSeries = await db.createSeries(seriesData);
      finalSeriesId = newSeries.id;
      console.log('Created new series with ID:', finalSeriesId);
    } else if (!seriesId) {
      return res.status(400).json({ error: 'Either seriesId or seriesName must be provided' });
    }

    // Verify series exists if using existing series
    if (seriesId) {
      const existingSeries = await db.getSeriesById(seriesId);
      if (!existingSeries) {
        return res.status(404).json({ error: 'Series not found' });
      }
      console.log('Using existing series with ID:', seriesId);
    }

    // Check if episode number already exists for this series
    if (finalSeriesId) {
      const existingEpisode = await db.getEpisodeBySeriesAndNumber(finalSeriesId, episodeNumber);
      if (existingEpisode) {
        return res.status(409).json({ 
          error: `Episode ${episodeNumber} already exists for this series` 
        });
      }
    }

    // Create video in the database with series information
    const video = await db.createVideo({
      title,
      description: description || 'unknown',
      year: year === 'unknown' ? null : year,
      genre,
      country: country || 'unknown',
      actors,
      duration_seconds: null,
      original_filename: filename,
      original_filetype: filetype,
      uploader_user_id: userId,
      series_id: finalSeriesId,
      episode_number: episodeNumber,
      status: 'staging',
      is_public: 1
    });
    
    const videoId = video.id;

    // Create upload record in the database
    await db.createUpload({
      id: uploadId,
      user_id: userId,
      video_id: videoId,
      filename,
      total_size: total_size,
      status: 'staging'
    });

    // Check with Server B if upload can be accepted
    const notifyUrl = `http://localhost:3000/api/v1/transfer/TransferFileFromServerAtoServerB`;
    const serverBResult = await uploadService.checkWithServerBAndUpdateStatus(uploadId, userId, filename, Math.ceil(total_size / (1024 * 1024)), notifyUrl);
    
    res.status(200).json({
      message: 'Series upload complete - all chunks received',
      uploadId,
      totalChunks,
      videoId,
      status: serverBResult === 'accepted' ? 'chunks_sent_to_server_b' : 'pending',
      serverBResult
    });
  } catch (error) {
    next(error);
  }
};
