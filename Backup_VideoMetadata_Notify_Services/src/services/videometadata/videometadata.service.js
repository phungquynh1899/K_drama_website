`use strict`
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const { ConflictError, InternalServerError, BadRequestError, NotFoundError, ForbiddenError } = require('../../response/error.response');

class VideoMetadataService {
    // ========================================
    // FRONTEND USER OPERATIONS (Read-focused)
    // ========================================
    // These methods handle frontend user requests
    // Focus on public data, minimal writes, optimized for reading

    static getPublicVideoMetadata = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        
        const { 
            series, 
            episode, 
            quality, 
            limit = 50, 
            offset = 0,
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = req.query;
        
        // Build filter for public videos only
        const filter = { is_public: 1 };
        if (series) filter.series = series;
        if (episode) filter.episode = parseInt(episode);
        if (quality) filter.quality = quality;
        
        // Get only public videos
        const videos = await db.listVideos(filter);
        
        // Apply sorting
        videos.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];
            
            if (sortBy === 'created_at' || sortBy === 'updated_at') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }
            
            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
        
        // Apply pagination
        const total = videos.length;
        const paginatedVideos = videos.slice(offset, offset + parseInt(limit));
        
        return {
            videos: paginatedVideos,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + paginatedVideos.length < total
            }
        };
    }

    static getPublicVideoMetadataById = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;

        const video = await db.getVideoById(videoId);
        if (!video || !video.is_public) {
            throw new NotFoundError("Video not found or not public.");
        }

        // Get public video files only
        const videoFiles = await db.getVideoFilesByVideoId(videoId);
        const publicFiles = videoFiles.filter(file => file.storage_provider !== 'internal');

        return {
            video: {
                ...video,
                files: publicFiles
            }
        };
    }

    static getPublicSeriesEpisodes = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const seriesName = req.params.seriesName;
        const { sortBy = 'year', sortOrder = 'asc' } = req.query;

        // Get only public videos
        const allVideos = await db.listVideos({ is_public: 1 });
        const seriesVideos = allVideos.filter(video => 
            video.title && video.title.toLowerCase().includes(seriesName.toLowerCase())
        );

        if (seriesVideos.length === 0) {
            throw new NotFoundError("Series not found.");
        }

        // Sort episodes
        seriesVideos.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];
            
            if (sortBy === 'year' || sortBy === 'created_at') {
                aValue = parseInt(aValue) || 0;
                bValue = parseInt(bValue) || 0;
            }
            
            if (sortOrder === 'asc') {
                return aValue - bValue;
            } else {
                return bValue - aValue;
            }
        });

        return {
            series: seriesName,
            totalEpisodes: seriesVideos.length,
            episodes: seriesVideos
        };
    }

    static searchPublicVideoMetadata = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const { 
            q, 
            series, 
            episode, 
            quality, 
            limit = 20,
            offset = 0 
        } = req.query;
        
        if (!q && !series && !episode && !quality) {
            throw new BadRequestError("At least one search parameter is required.");
        }
        
        // Get only public videos
        const allVideos = await db.listVideos({ is_public: 1 });
        let results = allVideos;
        
        // Apply search filters
        if (q) {
            const query = q.toLowerCase();
            results = results.filter(video => 
                video.title && video.title.toLowerCase().includes(query) ||
                video.description && video.description.toLowerCase().includes(query)
            );
        }
        
        if (series) {
            results = results.filter(video => 
                video.title && video.title.toLowerCase().includes(series.toLowerCase())
            );
        }
        
        if (episode) {
            results = results.filter(video => 
                video.title && video.title.toLowerCase().includes(`episode ${episode}`)
            );
        }
        
        if (quality) {
            const videosWithQuality = [];
            for (const video of results) {
                const videoFiles = await db.getVideoFilesByVideoId(video.id);
                const publicFiles = videoFiles.filter(file => file.storage_provider !== 'internal');
                const hasQuality = publicFiles.some(file => 
                    file.file_type && file.file_type.toLowerCase().includes(quality.toLowerCase())
                );
                if (hasQuality) {
                    videosWithQuality.push(video);
                }
            }
            results = videosWithQuality;
        }
        
        // Apply pagination
        const total = results.length;
        const paginatedResults = results.slice(offset, offset + parseInt(limit));
        
        return {
            query: { q, series, episode, quality },
            results: paginatedResults,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + paginatedResults.length < total
            }
        };
    }

    static getPublicOverviewStats = async (req) => {
        const db = BetterSqliteDatabase.getInstance();

        // Get only public videos
        const allVideos = await db.listVideos({ is_public: 1 });
        
        const stats = {
            totalVideos: allVideos.length,
            totalDuration: allVideos.reduce((sum, v) => sum + (v.duration_seconds || 0), 0),
            byStatus: {
                completed: allVideos.filter(v => v.status === 'completed').length
            },
            byYear: {}
        };

        // Group by year
        allVideos.forEach(video => {
            if (video.year) {
                stats.byYear[video.year] = (stats.byYear[video.year] || 0) + 1;
            }
        });

        return stats;
    }

    static getPublicPopularVideos = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const { limit = 10 } = req.query;

        // Get only public videos
        const allVideos = await db.listVideos({ is_public: 1 });
        
        // Sort by most recent (in real implementation, sort by view count)
        const popularVideos = allVideos
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, parseInt(limit));

        return {
            videos: popularVideos
        };
    }

    // User authenticated operations
    static getUserVideoMetadata = async (req) => {
        // Similar to public but can include user-specific data
        return await VideoMetadataService.getPublicVideoMetadata(req);
    }

    static getUserVideoMetadataById = async (req) => {
        // Similar to public but can include user-specific data
        return await VideoMetadataService.getPublicVideoMetadataById(req);
    }

    static incrementViewCount = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;

        // Check if video exists and is public
        const video = await db.getVideoById(videoId);
        if (!video || !video.is_public) {
            throw new NotFoundError("Video not found or not public.");
        }

        // Create analytics record
        const analytics = {
            video_id: parseInt(videoId),
            user_id: req.user.id,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            watch_duration: 0,
            viewed_at: new Date().toISOString()
        };

        await db.createVideoAnalytics(analytics);

        return {
            message: "View count updated",
            videoId: videoId
        };
    }

    static likeVideo = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;

        // Check if video exists and is public
        const video = await db.getVideoById(videoId);
        if (!video || !video.is_public) {
            throw new NotFoundError("Video not found or not public.");
        }

        // For now, just return success
        // In real implementation, you'd have a likes table
        return {
            message: "Video liked",
            videoId: videoId
        };
    }

    static dislikeVideo = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;

        // Check if video exists and is public
        const video = await db.getVideoById(videoId);
        if (!video || !video.is_public) {
            throw new NotFoundError("Video not found or not public.");
        }

        // For now, just return success
        // In real implementation, you'd have a dislikes table
        return {
            message: "Video disliked",
            videoId: videoId
        };
    }

    // ========================================
    // BACKEND SERVICE OPERATIONS (Write-focused)
    // ========================================
    // These methods handle backend service requests (laptops)
    // Focus on internal operations, heavy writes, full data access

    static getServiceVideoMetadata = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        
        const { 
            status, 
            uploader_user_id,
            limit = 100, 
            offset = 0
        } = req.query;
        
        // Build filter for service operations
        const filter = {};
        if (status) filter.status = status;
        if (uploader_user_id) filter.uploader_user_id = parseInt(uploader_user_id);
        
        // Get all videos (including internal ones)
        const videos = await db.listVideos(filter);
        
        // Apply pagination
        const total = videos.length;
        const paginatedVideos = videos.slice(offset, offset + parseInt(limit));
        
        return {
            videos: paginatedVideos,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + paginatedVideos.length < total
            }
        };
    }

    static getServiceVideoMetadataById = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;

        const video = await db.getVideoById(videoId);
        if (!video) {
            throw new NotFoundError("Video metadata not found.");
        }

        // Get all video files (including internal ones)
        const videoFiles = await db.getVideoFilesByVideoId(videoId);
        const transcodingJobs = await db.getTranscodingJobsByVideoId(videoId);

        return {
            video: {
                ...video,
                files: videoFiles,
                transcodingJobs: transcodingJobs
            }
        };
    }

    static createVideoMetadata = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoData = req.body;

        // Validate required fields
        if (!videoData.title || !videoData.description) {
            throw new BadRequestError("Title and description are required.");
        }

        if (videoData.duration_seconds && videoData.duration_seconds <= 0) {
            throw new BadRequestError("Duration must be greater than 0.");
        }

        // Add service user ID (from service authentication)
        videoData.uploader_user_id = req.service.id || 1; // Default to system user

        // Create video in database
        const createdVideo = await db.createVideo(videoData);
        
        if (!createdVideo) {
            throw new InternalServerError("Failed to create video metadata.");
        }

        return {
            video: createdVideo,
            message: "Video metadata created successfully"
        };
    }

    static updateVideoMetadata = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;
        const updates = req.body;

        // Check if video exists
        const existingVideo = await db.getVideoById(videoId);
        if (!existingVideo) {
            throw new NotFoundError("Video metadata not found.");
        }

        // Service can update any video
        // Validate updates
        if (updates.duration_seconds && updates.duration_seconds <= 0) {
            throw new BadRequestError("Duration must be greater than 0.");
        }

        // Update video
        const updatedVideo = await db.updateVideo(videoId, updates);
        
        if (!updatedVideo) {
            throw new InternalServerError("Failed to update video metadata.");
        }

        return {
            video: updatedVideo,
            message: "Video metadata updated successfully"
        };
    }

    static deleteVideoMetadata = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;

        // Check if video exists
        const existingVideo = await db.getVideoById(videoId);
        if (!existingVideo) {
            throw new NotFoundError("Video metadata not found.");
        }

        // Service can delete any video
        const deleted = await db.deleteVideo(videoId);
        
        if (!deleted) {
            throw new InternalServerError("Failed to delete video metadata.");
        }

        return {
            message: "Video metadata deleted successfully",
            deletedVideo: {
                id: existingVideo.id,
                title: existingVideo.title
            }
        };
    }

    static updateVideoStatus = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;
        const { status } = req.body;

        if (!status) {
            throw new BadRequestError("Status is required.");
        }

        const validStatuses = ['uploading', 'processing', 'completed', 'failed'];
        if (!validStatuses.includes(status)) {
            throw new BadRequestError("Invalid status.");
        }

        const updatedVideo = await db.updateVideo(videoId, { status });
        
        if (!updatedVideo) {
            throw new InternalServerError("Failed to update video status.");
        }

        return {
            video: updatedVideo,
            message: "Video status updated successfully"
        };
    }

    static updateTranscodingStatus = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;
        const { jobId, status, progress, error_message } = req.body;

        if (!jobId) {
            throw new BadRequestError("Job ID is required.");
        }

        // Update transcoding job
        const job = await db.getTranscodingJobById(jobId);
        if (!job) {
            throw new NotFoundError("Transcoding job not found.");
        }

        const updates = { status };
        if (progress !== undefined) updates.progress = progress;
        if (error_message !== undefined) updates.error_message = error_message;
        if (status === 'completed') updates.completed_at = new Date().toISOString();

        const updatedJob = await db.updateTranscodingJob(jobId, updates);
        
        if (!updatedJob) {
            throw new InternalServerError("Failed to update transcoding status.");
        }

        return {
            job: updatedJob,
            message: "Transcoding status updated successfully"
        };
    }

    static updateVideoFiles = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;
        const { files } = req.body;

        if (!files || !Array.isArray(files)) {
            throw new BadRequestError("Files array is required.");
        }

        const results = [];
        for (const fileData of files) {
            fileData.video_id = parseInt(videoId);
            const createdFile = await db.createVideoFile(fileData);
            results.push(createdFile);
        }

        return {
            files: results,
            message: "Video files updated successfully"
        };
    }

    static getProcessingStats = async (req) => {
        const db = BetterSqliteDatabase.getInstance();

        // Get all videos
        const allVideos = await db.listVideos({});
        
        const stats = {
            totalVideos: allVideos.length,
            byStatus: {
                uploading: allVideos.filter(v => v.status === 'uploading').length,
                processing: allVideos.filter(v => v.status === 'processing').length,
                completed: allVideos.filter(v => v.status === 'completed').length,
                failed: allVideos.filter(v => v.status === 'failed').length
            },
            byUploader: {}
        };

        // Group by uploader
        allVideos.forEach(video => {
            const uploaderId = video.uploader_user_id;
            if (!stats.byUploader[uploaderId]) {
                stats.byUploader[uploaderId] = 0;
            }
            stats.byUploader[uploaderId]++;
        });

        return stats;
    }

    static getStorageStats = async (req) => {
        const db = BetterSqliteDatabase.getInstance();

        // Get all video files
        const allVideos = await db.listVideos({});
        let totalSize = 0;
        const byProvider = {};

        for (const video of allVideos) {
            const videoFiles = await db.getVideoFilesByVideoId(video.id);
            
            videoFiles.forEach(file => {
                totalSize += file.file_size || 0;
                const provider = file.storage_provider;
                if (!byProvider[provider]) {
                    byProvider[provider] = { count: 0, size: 0 };
                }
                byProvider[provider].count++;
                byProvider[provider].size += file.file_size || 0;
            });
        }

        return {
            totalSize,
            totalFiles: Object.values(byProvider).reduce((sum, provider) => sum + provider.count, 0),
            byProvider
        };
    }

    static updateChunks = async ({ videoId, chunkList, serverDPath }) => {
        // Simulate metadata update logic (replace with real DB/API call as needed)
        try {
            // TODO: Implement actual metadata update logic
            return { status: 200, message: 'Metadata updated', videoId, chunkList, serverDPath };
        } catch (err) {
            return { status: 500, message: 'Failed to update metadata', error: err.message };
        }
    };
}

module.exports = VideoMetadataService 