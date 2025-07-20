const thumbnailService = require('../../services/thumbnail/thumbnail.service');
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

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
      const db = BetterSqliteDatabase.getInstance();
      
      // Check if video exists and belongs to user
      const video = await db.getVideoById(req.body.videoId);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }
      
      if (video.uploader_user_id !== parseInt(userId)) {
        return res.status(403).json({ error: 'You can only upload thumbnails for your own videos' });
      }

      // Update video with thumbnail URL
      thumbnailRecord = await db.updateVideo(req.body.videoId, {
        thumbnail_url: processingResult.url
      });
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
      const db = BetterSqliteDatabase.getInstance();
      // Check if series exists and belongs to user
      const series = await db.getSeriesById(req.body.seriesId);
      if (!series) {
        return res.status(404).json({ error: 'Video not found' });
      }
      if (series.uploader_user_id !== parseInt(userId)) {
        return res.status(403).json({ error: 'You can only upload thumbnails for your own series' });
      }
      // Update series with thumbnail URL
      const updateRes = await db.updateSeries(req.body.seriesId, {thumbnail_url: processingResult.url});
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

    const db = BetterSqliteDatabase.getInstance();
    
    // Check if video exists and belongs to user
    const video = await db.getVideoById(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    if (video.uploader_user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'You can only update thumbnails for your own videos' });
    }

    // Update video with thumbnail URL
    const thumbnailRecord = await db.updateVideo(videoId, {
      thumbnail_url: thumbnailUrl
    });

    res.status(200).json({
      message: 'Video thumbnail updated successfully',
      thumbnail: {
        url: thumbnailUrl
      },
      database_record: thumbnailRecord
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

    const db = BetterSqliteDatabase.getInstance();
    
    // Check if video exists and belongs to user
    const video = await db.getVideoById(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    if (video.uploader_user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'You can only delete thumbnails for your own videos' });
    }

    // Get current thumbnail URL
    const currentThumbnailUrl = video.thumbnail_url;
    
    // Remove thumbnail URL from video
    const updated = await db.updateVideo(videoId, {
      thumbnail_url: null
    });
    
    // Delete file from filesystem if it exists
    let fileDeleted = false;
    if (currentThumbnailUrl) {
      const filename = currentThumbnailUrl.split('/').pop(); // Extract filename from URL
      fileDeleted = thumbnailService.deleteThumbnail(filename);
    }

    res.status(200).json({
      message: 'Thumbnail deleted successfully',
      database_updated: updated,
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