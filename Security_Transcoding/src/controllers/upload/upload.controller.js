const uploadService = require('../../services/upload/upload.service');
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const FileType = require('file-type');
const path = require('path');
const fs = require('fs');
const axios = require('axios')


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
    activeUploads[userId].add(String(uploadId));
    console.log(`[uploadChunk] activeUploads for user ${userId}:`, Array.from(activeUploads[userId]));
    if (activeUploads[userId].size > MAX_CONCURRENT_UPLOADS) {
      activeUploads[userId].delete(String(uploadId));
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
    // Clean up chunks if error occurs
    if (req.body.uploadId) {
      uploadService.deleteUploadChunks(req.body.uploadId);
    }
    next(error);
  }
};

exports.completeUpload = async (req, res, next) => {
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
      console.log(`[completeUpload] BEFORE remove: activeUploads for user ${userId}:`, Array.from(activeUploads[userId]));
      console.log("remove upload id " + uploadId)
      // Debug: log types and values
      console.log('typeof uploadId:', typeof uploadId, 'value:', uploadId);
      console.log('Set contents:', Array.from(activeUploads[userId]).map(x => ({ type: typeof x, value: x })));
      activeUploads[userId].delete(String(uploadId));
      console.log(`[completeUpload] AFTER remove: activeUploads for user ${userId}:`, Array.from(activeUploads[userId]));
    }

    // 1. Create video by calling external server
    const createVideoPayload = {
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
    };
    // Add x-api-key header
    const axiosConfig = { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY } };
    const createVideoResponse = await axios.post(process.env.DB_SERVER_HOST+'/createVideo', createVideoPayload, axiosConfig);
    const videoId = createVideoResponse.data.id || createVideoResponse.data.videoId || (createVideoResponse.data.metadata && createVideoResponse.data.metadata.id);


    // 2. Create upload record in the database via HTTP
    const uploadPayload = {
      id: uploadId, // Use the uploadId from frontend as the primary key
      user_id: userId,
      video_id: videoId,
      filename,
      total_size: total_size,
      status: 'staging'
    };
    //save upload status 
    await axios.post(process.env.DB_SERVER_HOST + '/createUpload', uploadPayload, axiosConfig);
    // Respond to client with the result from Server B and chunk info
    res.status(200).json({
    message: 'Upload complete - all chunks received',
    uploadId,
    totalChunks,
    videoId,
    });
    // Check with Server B if upload can be accepted
    const totalSizeMB = uploadService.getActualUploadSizeMB(uploadId);
    const notifyUrl = process.env.TEMP_UPLOAD_SERVER_HOST + `/api/v1/transfer/TransferFileFromServerAtoServerB`;
    await axios.post(
      process.env.TRANSCODE_SERVER_HOST + `/api/v1/upload/can-accept-upload`,
      { 
        requiredSpaceMB: totalSizeMB,
        notifyUrl: notifyUrl,
        uploadId: uploadId,
        userId: userId
      },
      { 
        timeout: 10000,
        headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY }
      }
    );
    
  } catch (error) {
    // Clean up chunks if error occurs
    if (req.body.uploadId) {
      uploadService.deleteUploadChunks(req.body.uploadId);
    }
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

// Cancel an upload and clean up
exports.cancelUpload = async (req, res, next) => {
  try {
    const { userId, uploadId } = req.body;
    if (!userId || !uploadId) {
      return res.status(400).json({ error: 'Missing userId or uploadId' });
    }

    // Remove uploadId from activeUploads set
    if (activeUploads[userId]) {
      console.log('remove upload id ' + uploadId)
      activeUploads[userId].delete(String(uploadId));
      // If the set is empty, remove the user entry
      if (activeUploads[userId].size === 0) {
        delete activeUploads[userId];
      }
    }

    // Clean up any partial chunks
    uploadService.deleteUploadChunks(uploadId);

    return res.status(200).json({ message: 'Upload cancelled', uploadId });
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
    activeUploads[userId].add(String(uploadId));
    if (activeUploads[userId].size > MAX_CONCURRENT_UPLOADS) {
      activeUploads[userId].delete(String(uploadId));
      return res.status(429).json({ error: 'Max concurrent uploads reached (3)' });
    }
    
    // Retry logic: If chunk already exists, return success (idempotent)
    const chunkPath = req.file.path;
    if (fs.existsSync(chunkPath)) {
      return res.status(200).json({ message: 'Chunk already uploaded', chunkIndex });
    }
    
    // Save chunk (already handled by multer)
    res.status(200).json({ message: 'Series chunk uploaded', chunkIndex });
  } catch (error) {
    // Clean up chunks if error occurs
    if (req.body.uploadId) {
      uploadService.deleteUploadChunks(req.body.uploadId);
    }
    next(error);
  }
};

exports.completeSeriesUpload = async (req, res, next) => {
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
      activeUploads[userId].delete(String(uploadId));
    }

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

      // Add x-api-key header
      const axiosConfig = { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY } };
      // Create series via API
      const newSeriesResponse = await axios.post(process.env.DB_SERVER_HOST + '/createSeries', seriesData, axiosConfig);
      finalSeriesId = newSeriesResponse.data.id || newSeriesResponse.data.seriesId || (newSeriesResponse.data.metadata && newSeriesResponse.data.metadata.id);
      console.log('Created new series with ID:', finalSeriesId);
    } else if (!seriesId) {
      return res.status(400).json({ error: 'Either seriesId or seriesName must be provided' });
    }

    // Verify series exists if using existing series
    if (seriesId) {
      const axiosConfig = { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY } };
      const existingSeriesResponse = await axios.get(process.env.DB_SERVER_HOST + `/getSeriesById/${seriesId}`, axiosConfig);
      const existingSeries = existingSeriesResponse.data;
      if (!existingSeries) {
        return res.status(404).json({ error: 'Series not found' });
      }
      console.log('Using existing series with ID:', seriesId);
    }

    // Check if episode number already exists for this series
    if (finalSeriesId) {
      const axiosConfig = { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY } };
      const existingEpisodeResponse = await axios.get(process.env.DB_SERVER_HOST + `/getEpisodeBySeriesAndNumber`, {
        params: { seriesId: finalSeriesId, episodeNumber },
        headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY }
      });
      const existingEpisode = existingEpisodeResponse.data;
      if (existingEpisode) {
        return res.status(409).json({ 
          error: `Episode ${episodeNumber} already exists for this series` 
        });
      }
    }

    // Create video in the database with series information via API
    let actorsArray = [];
    if (Array.isArray(actors)) {
      actorsArray = actors;
    } else if (typeof actors === 'string') {
      actorsArray = actors.split(',').map(a => a.trim()).filter(a => a.length > 0);
    }

    const videoPayload = {
      title,
      description: description || 'unknown',
      year: year === 'unknown' ? null : year,
      genre,
      country: country || 'unknown',
      actors: actorsArray,
      duration_seconds: null,
      original_filename: filename,
      original_filetype: filetype,
      uploader_user_id: userId,
      series_id: finalSeriesId,
      episode_number: episodeNumber,
      status: 'staging',
      is_public: 1
    };
    const createVideoResponse = await axios.post(process.env.DB_SERVER_HOST + '/createVideo', videoPayload, { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY }});
    const videoId = createVideoResponse.data.id || createVideoResponse.data.videoId || (createVideoResponse.data.metadata && createVideoResponse.data.metadata.id);

    // Create upload record in the database via API
    const uploadPayload = {
      id: uploadId,
      user_id: userId,
      video_id: videoId,
      filename,
      total_size: total_size,
      status: 'staging'
    };
    await axios.post(process.env.DB_SERVER_HOST + '/createUpload', 
      uploadPayload, 
      { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY }});

    res.status(200).json({
      message: 'Series upload complete - all chunks received',
      uploadId,
      totalChunks,
      videoId
    });

    // Check with Server B if upload can be accepted (using actual chunk size)
    const totalSizeMB = uploadService.getActualUploadSizeMB(String(uploadId));
    const notifyUrl = process.env.TEMP_UPLOAD_SERVER_HOST + `/api/v1/transfer/TransferFileFromServerAtoServerB`;
    axios.post(
      process.env.TRANSCODE_SERVER_HOST + `/api/v1/upload/can-accept-upload`,
      { 
        requiredSpaceMB: totalSizeMB,
        notifyUrl: notifyUrl,
        uploadId: uploadId,
        userId: userId
      },
      { 
        timeout: 10000,
        headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY }
      }
    );
    
    
  } catch (error) {
    // Clean up chunks if error occurs
    if (req.body.uploadId) {
      uploadService.deleteUploadChunks(req.body.uploadId);
    }
    next(error);
  }
};
