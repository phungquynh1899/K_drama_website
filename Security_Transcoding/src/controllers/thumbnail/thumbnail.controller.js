const thumbnailService = require('../../services/thumbnail/thumbnail.service');
const axios = require('axios');

/**
 * Upload and process thumbnail
 */
exports.uploadThumbnail = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No thumbnail file uploaded' });
    }

    // Validate the image file
    const validation = thumbnailService.validateImageFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Get user ID from request
    const userId = req.body.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Process and save thumbnail
    const processingResult = await thumbnailService.processAndSaveThumbnail(
      req.file.buffer,
      req.file.originalname,
      {
        width: 320,
        height: 180,
        quality: 85
      }
    );

    if (!processingResult.success) {
      return res.status(500).json({ 
        error: 'Failed to process thumbnail', 
        details: processingResult.error 
      });
    }

    // Save thumbnail info to database if videoId is provided
    let thumbnailRecord = null;
    if (req.body.videoId) {
      const axiosConfig = { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY } };
      // Check if video exists and belongs to user
      const videoRes = await axios.get(`${process.env.DB_SERVER_HOST}/getVideoById/${req.body.videoId}`, axiosConfig);
      const video = videoRes.data;
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }
      if (video.uploader_user_id !== parseInt(userId)) {
        return res.status(403).json({ error: 'You can only upload thumbnails for your own videos' });
      }
      // Update video with thumbnail URL
      const updateRes = await axios.put(`${process.env.DB_SERVER_HOST}/updateVideo/${req.body.videoId}`, { thumbnail_url: processingResult.url }, axiosConfig);
      thumbnailRecord = updateRes.data;
    }

    res.status(200).json({
      message: 'Thumbnail uploaded and processed successfully',
      thumbnail: {
        filename: processingResult.filename,
        url: processingResult.url,
        size: processingResult.size,
        width: processingResult.width,
        height: processingResult.height,
        format: processingResult.format
      },
      database_record: thumbnailRecord
    });

  } catch (error) {
    console.error('Thumbnail upload error:', error);
    next(error);
  }
};
//upload series thumbnail
exports.thumbnailSeriesUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No thumbnail file uploaded' });
    }

    // Validate the image file
    const validation = thumbnailService.validateImageFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Get user ID from request
    const userId = req.body.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Process and save thumbnail
    const processingResult = await thumbnailService.processAndSaveThumbnail(
      req.file.buffer,
      req.file.originalname,
      {
        width: 320,
        height: 180,
        quality: 85
      }
    );

    if (!processingResult.success) {
      return res.status(500).json({ 
        error: 'Failed to process thumbnail', 
        details: processingResult.error 
      });
    }

    // Save thumbnail info to database if seriesId is provided
    let thumbnailRecord = null;
    if (req.body.seriesId) {
      const axiosConfig = { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY } };
      // Check if series exists and belongs to user
      const seriesRes = await axios.get(`${process.env.DB_SERVER_HOST}/getSeriesById/${req.body.seriesId}`, axiosConfig);
      const series = seriesRes.data;
      if (!series) {
        return res.status(404).json({ error: 'Video not found' });
      }
      if (series.uploader_user_id !== parseInt(userId)) {
        return res.status(403).json({ error: 'You can only upload thumbnails for your own series' });
      }
      // Update series with thumbnail URL
      const updateRes = await axios.put(`${process.env.DB_SERVER_HOST}/updateSeries/${req.body.seriesId}`, { thumbnail_url: processingResult.url }, axiosConfig);
      thumbnailRecord = updateRes.data;
    }

    res.status(200).json({
      message: 'Thumbnail uploaded and processed successfully',
      thumbnail: {
        filename: processingResult.filename,
        url: processingResult.url,
        size: processingResult.size,
        width: processingResult.width,
        height: processingResult.height,
        format: processingResult.format
      },
      database_record: thumbnailRecord
    });

  } catch (error) {
    console.error('Thumbnail upload error:', error);
    next(error);
  }
}


/**
 * Update video with thumbnail URL
 */
exports.updateVideoThumbnail = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const { thumbnailUrl } = req.body;
    
    if (!videoId || !thumbnailUrl) {
      return res.status(400).json({ error: 'Video ID and thumbnail URL are required' });
    }

    const userId = req.body.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const axiosConfig = { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY } };
    
    // Check if video exists and belongs to user
    const videoRes = await axios.get(`${process.env.DB_SERVER_HOST}/getVideoById/${videoId}`, axiosConfig);
    const video = videoRes.data;
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    if (video.uploader_user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'You can only update thumbnails for your own videos' });
    }

    // Update video with thumbnail URL
    const thumbnailRecord = await axios.put(`${process.env.DB_SERVER_HOST}/updateVideo/${videoId}`, { thumbnail_url: thumbnailUrl }, axiosConfig);

    res.status(200).json({
      message: 'Video thumbnail updated successfully',
      thumbnail: {
        url: thumbnailUrl
      },
      database_record: thumbnailRecord.data
    });

  } catch (error) {
    console.error('Update video thumbnail error:', error);
    next(error);
  }
};

/**
 * Delete thumbnail
 */
exports.deleteThumbnail = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const userId = req.body.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const axiosConfig = { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY } };
    
    // Check if video exists and belongs to user
    const videoRes = await axios.get(`${process.env.DB_SERVER_HOST}/getVideoById/${videoId}`, axiosConfig);
    const video = videoRes.data;
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    if (video.uploader_user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'You can only delete thumbnails for your own videos' });
    }

    // Get current thumbnail URL
    const currentThumbnailUrl = video.thumbnail_url;
    
    // Remove thumbnail URL from video
    const updated = await axios.put(`${process.env.DB_SERVER_HOST}/updateVideo/${videoId}`, { thumbnail_url: null }, axiosConfig);
    
    // Delete file from filesystem if it exists
    let fileDeleted = false;
    if (currentThumbnailUrl) {
      const filename = currentThumbnailUrl.split('/').pop(); // Extract filename from URL
      fileDeleted = thumbnailService.deleteThumbnail(filename);
    }

    res.status(200).json({
      message: 'Thumbnail deleted successfully',
      database_updated: updated.data,
      file_deleted: fileDeleted
    });

  } catch (error) {
    console.error('Delete thumbnail error:', error);
    next(error);
  }
};

/**
 * Get thumbnail info
 */
exports.getThumbnailInfo = async (req, res, next) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const info = thumbnailService.getThumbnailInfo(filename);
    
    res.status(200).json({
      thumbnail_info: info
    });

  } catch (error) {
    console.error('Get thumbnail info error:', error);
    next(error);
  }
}; 