`use strict`
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const { ConflictError, InternalServerError, BadRequestError, NotFoundError, ForbiddenError } = require('../../response/error.response');
const fs = require('fs').promises;
const path = require('path');

class VideoMetadataService {
    static createVideo = async (req) =>{
        const db = BetterSqliteDatabase.getInstance();
        const videoData = req.body;

        // Validate required fields
        if (!videoData.title || typeof videoData.title !== 'string' || videoData.title.trim() === '') {
            throw new BadRequestError("Title is required and must be a non-empty string.");
        }
        if (!videoData.description || typeof videoData.description !== 'string' || videoData.description.trim() === '') {
            throw new BadRequestError("Description is required and must be a non-empty string.");
        }
        if (!videoData.original_filename || typeof videoData.original_filename !== 'string' || videoData.original_filename.trim() === '') {
            throw new BadRequestError("Original filename is required and must be a non-empty string.");
        }
        if (!videoData.original_filetype || typeof videoData.original_filetype !== 'string' || videoData.original_filetype.trim() === '') {
            throw new BadRequestError("Original filetype is required and must be a non-empty string.");
        }
        if (videoData.uploader_user_id === undefined || videoData.uploader_user_id === null || isNaN(parseInt(videoData.uploader_user_id))) {
            throw new BadRequestError("uploader_user_id is required and must be a valid integer.");
        }

        // Optional fields validation
        let year = null;
        if (videoData.year !== undefined && videoData.year !== null && videoData.year !== '') {
            year = videoData.year === 'unknown' ? null : Number(videoData.year);
            if (year !== null && (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
                throw new BadRequestError("Year must be a valid year between 1900 and next year, or null.");
            }
        }
        let duration = null;
        if (videoData.duration_seconds !== undefined && videoData.duration_seconds !== null && videoData.duration_seconds !== '') {
            duration = Number(videoData.duration_seconds);
            if (isNaN(duration) || duration < 0) {
                throw new BadRequestError("duration_seconds must be a non-negative integer or null.");
            }
        }
        const validStatuses = ['uploading', 'processing', 'completed', 'failed', 'staging'];
        if (videoData.status && !validStatuses.includes(videoData.status)) {
            throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }
        if (videoData.is_public !== undefined && ![0, 1].includes(Number(videoData.is_public))) {
            throw new BadRequestError("is_public must be 0 or 1.");
        }
        if (videoData.actors && !Array.isArray(videoData.actors)) {
            throw new BadRequestError("actors must be an array.");
        }
        if (videoData.genre !== undefined && videoData.genre !== null && typeof videoData.genre !== 'string') {
            throw new BadRequestError("genre must be a string.");
        }
        if (videoData.country !== undefined && videoData.country !== null && typeof videoData.country !== 'string') {
            throw new BadRequestError("country must be a string.");
        }
        // series_id and episode_number validation (optional)
        let series_id = null;
        if (videoData.series_id !== undefined && videoData.series_id !== null && videoData.series_id !== '') {
            series_id = Number(videoData.series_id);
            if (isNaN(series_id)) {
                throw new BadRequestError("series_id must be a valid number or null.");
            }
        }
        let episode_number = null;
        if (videoData.episode_number !== undefined && videoData.episode_number !== null && videoData.episode_number !== '') {
            episode_number = Number(videoData.episode_number);
            if (isNaN(episode_number)) {
                throw new BadRequestError("episode_number must be a valid number or null.");
            }
        }
        // thumbnail_url (optional)
        if (videoData.thumbnail_url !== undefined && videoData.thumbnail_url !== null && typeof videoData.thumbnail_url !== 'string') {
            throw new BadRequestError("thumbnail_url must be a string if provided.");
        }

        // Set defaults
        const safeVideoData = {
            title: videoData.title,
            description: videoData.description || 'unknown',
            year: year,
            genre: videoData.genre || null,
            country: videoData.country || 'unknown',
            actors: videoData.actors || [],
            duration_seconds: duration,
            original_filename: videoData.original_filename,
            original_filetype: videoData.original_filetype,
            uploader_user_id: Number(videoData.uploader_user_id),
            series_id: series_id,
            episode_number: episode_number,
            thumbnail_url: videoData.thumbnail_url || null,
            status: videoData.status || 'staging',
            is_public: videoData.is_public !== undefined ? Number(videoData.is_public) : 1
        };

        // Insert into DB
        const createdVideo = await db.createVideo(safeVideoData);
        if (!createdVideo) {
            throw new InternalServerError("Failed to create video.");
        }
        console.log('crate video successfully with id' + createdVideo.id)
        return createdVideo;
    }

    static createUpload = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const upload = req.body;

        // Validate required fields
        if (upload.id === undefined || upload.id === null || isNaN(Number(upload.id))) {
            throw new BadRequestError("id (uploadId) is required and must be a valid number.");
        }
        if (upload.user_id === undefined || upload.user_id === null || isNaN(Number(upload.user_id))) {
            throw new BadRequestError("user_id is required and must be a valid number.");
        }
        if (upload.filename === undefined || typeof upload.filename !== 'string' || upload.filename.trim() === '') {
            throw new BadRequestError("filename is required and must be a non-empty string.");
        }
        if (upload.total_size === undefined || upload.total_size === null || isNaN(Number(upload.total_size)) || Number(upload.total_size) < 0) {
            throw new BadRequestError("total_size is required and must be a non-negative number.");
        }
        // video_id is optional, but if present, must be a number
        if (upload.video_id !== undefined && upload.video_id !== null && isNaN(Number(upload.video_id))) {
            throw new BadRequestError("video_id must be a valid number if provided.");
        }
        // status is optional, but if present, must be a string
        if (upload.status !== undefined && upload.status !== null && typeof upload.status !== 'string') {
            throw new BadRequestError("status must be a string if provided.");
        }

        // Set default status
        upload.status = upload.status || 'staging';

        // Save to DB
        const uploadData = {
            id: Number(upload.id),
            user_id: Number(upload.user_id),
            video_id: upload.video_id !== undefined && upload.video_id !== null ? Number(upload.video_id) : null,
            filename: upload.filename,
            total_size: Number(upload.total_size),
            status: upload.status
        };
        console.log('Inserting upload with video id:', upload.video_id, typeof upload.id);
        const createdUpload = await db.createUpload(uploadData);
        console.log('Insert result:', createdUpload);
        console.log("upload data in database" + createdUpload.id)
        if (!createdUpload) {
            throw new InternalServerError("Failed to create upload record.");
        }
        return createdUpload;
    }

    static createSeries = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const series = req.body;

        // Validate required fields
        if (!series.name || typeof series.name !== 'string' || series.name.trim() === '') {
            throw new BadRequestError("name is required and must be a non-empty string.");
        }
        if (series.total_episodes === undefined || isNaN(Number(series.total_episodes)) || Number(series.total_episodes) < 2) {
            throw new BadRequestError("total_episodes is required and must be an integer >= 2.");
        }
        if (series.uploader_user_id === undefined || isNaN(Number(series.uploader_user_id))) {
            throw new BadRequestError("uploader_user_id is required and must be a valid integer.");
        }

        // Optional fields validation
        let year = null;
        if (series.year !== undefined && series.year !== null && series.year !== '') {
            year = series.year === 'unknown' ? null : Number(series.year);
            if (year !== null && (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
                throw new BadRequestError("year must be a valid year between 1900 and next year, or null.");
            }
        }
        if (series.genre !== undefined && series.genre !== null && typeof series.genre !== 'string') {
            throw new BadRequestError("genre must be a string.");
        }
        if (series.country !== undefined && series.country !== null && typeof series.country !== 'string') {
            throw new BadRequestError("country must be a string.");
        }
        if (series.director !== undefined && series.director !== null && typeof series.director !== 'string') {
            throw new BadRequestError("director must be a string.");
        }
        if (series.cast !== undefined && series.cast !== null && typeof series.cast !== 'string') {
            throw new BadRequestError("cast must be a string.");
        }
        if (series.description !== undefined && series.description !== null && typeof series.description !== 'string') {
            throw new BadRequestError("description must be a string.");
        }
        if (series.poster !== undefined && series.poster !== null && typeof series.poster !== 'string') {
            throw new BadRequestError("poster must be a string.");
        }
        if (series.status !== undefined && series.status !== null && typeof series.status !== 'string') {
            throw new BadRequestError("status must be a string.");
        }
        if (series.is_public !== undefined && ![0, 1].includes(Number(series.is_public))) {
            throw new BadRequestError("is_public must be 0 or 1.");
        }

        // Construct safe object
        const seriesData = {
            name: series.name,
            description: series.description || 'unknown',
            year: year,
            genre: series.genre || null,
            country: series.country || 'unknown',
            director: series.director || 'Unknown',
            cast: series.cast || 'Unknown',
            poster: series.poster || null,
            total_episodes: Number(series.total_episodes),
            status: series.status || 'active',
            uploader_user_id: Number(series.uploader_user_id),
            is_public: series.is_public !== undefined ? Number(series.is_public) : 1
        };

        // Save to DB
        const createdSeries = await db.createSeries(seriesData);
        if (!createdSeries) {
            throw new InternalServerError("Failed to create series.");
        }
        return createdSeries;
    }

    static getSeriesById = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const seriesId = req.params.seriesId || req.body.seriesId || req.query.seriesId;
        if (!seriesId || isNaN(Number(seriesId))) {
            throw new BadRequestError("seriesId is required and must be a valid number.");
        }
        const series = await db.getSeriesById(Number(seriesId));
        if (!series) {
            throw new NotFoundError("Series not found");
        }
        return series;
    }
    static getEpisodeBySeriesAndNumber = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        // Accept seriesId and episodeNumber from params, body, or query
        const seriesId = req.params.seriesId || req.body.seriesId || req.query.seriesId;
        const episodeNumber = req.params.episodeNumber || req.body.episodeNumber || req.query.episodeNumber;
        if (!seriesId || isNaN(Number(seriesId))) {
            throw new BadRequestError("seriesId is required and must be a valid number.");
        }
        if (!episodeNumber || isNaN(Number(episodeNumber))) {
            throw new BadRequestError("episodeNumber is required and must be a valid number.");
        }
        const episode = await db.getEpisodeBySeriesAndNumber(Number(seriesId), Number(episodeNumber));
        // Return the episode (could be null if not found)
        return episode;
    }

    static getVideoById = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId || req.body.videoId || req.query.videoId;
        if (!videoId || isNaN(Number(videoId))) {
            throw new BadRequestError("videoId is required and must be a valid number.");
        }
        const video = await db.getVideoById(Number(videoId));
        if (!video) {
            throw new NotFoundError("Video not found");
        }
        return video;
    }

    static uploadVideo = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId || req.body.videoId || req.query.videoId;
        const { thumbnail_url } = req.body;

        if (!videoId || isNaN(Number(videoId))) {
            throw new BadRequestError("videoId is required and must be a valid number.");
        }
        if (!thumbnail_url || typeof thumbnail_url !== 'string') {
            throw new BadRequestError("thumbnail_url is required and must be a string.");
        }

        // Check if video exists
        const existingVideo = await db.getVideoById(Number(videoId));
        if (!existingVideo) {
            throw new NotFoundError("Video not found.");
        }

        // Update thumbnail_url
        const updated = await db.updateVideo(Number(videoId), { thumbnail_url });
        if (!updated) {
            throw new InternalServerError("Failed to update video thumbnail.");
        }
        return { videoId: Number(videoId), thumbnail_url, message: "Thumbnail updated successfully" };
    }

    static updateSeries = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const seriesId = req.params.seriesId || req.body.seriesId || req.query.seriesId;
        const { poster } = req.body;

        if (!seriesId || isNaN(Number(seriesId))) {
            throw new BadRequestError("seriesId is required and must be a valid number.");
        }
        if (!poster || typeof poster !== 'string') {
            throw new BadRequestError("poster is required and must be a string (thumbnail URL/path).");
        }

        // Check if series exists
        const existingSeries = await db.getSeriesById(Number(seriesId));
        if (!existingSeries) {
            throw new NotFoundError("Series not found.");
        }

        // Update poster
        const updated = await db.updateSeries(Number(seriesId), { poster });
        if (!updated) {
            throw new InternalServerError("Failed to update series poster.");
        }
        return { seriesId: Number(seriesId), poster, message: "Series poster updated successfully" };
    }

    static getVideoByUploadId = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        console.log('params:', req.params, 'query:', req.query, 'body:', req.body);
        // Get uploadId from params, body, or query
        const uploadId = req.query.uploadId;
        
        if (!uploadId || isNaN(Number(uploadId))) {
            throw new BadRequestError("uploadId is required and must be a valid number.");
        }

        // Get video by upload ID using the database method
        const video = await db.getVideoByUploadId(Number(uploadId));
        
        if (!video) {
            console.log(`No video found for uploadId: ${uploadId}`);
            throw new NotFoundError(`No video found for uploadId: ${uploadId}`);
        }

        // Return the video object with original_filetype and original_filename
        // as expected by the sender logic
        return {
            id: video.id,
            title: video.title,
            description: video.description,
            year: video.year,
            genre: video.genre,
            country: video.country,
            actors: video.actors,
            duration_seconds: video.duration_seconds,
            original_filename: video.original_filename,
            original_filetype: video.original_filetype,
            uploader_user_id: video.uploader_user_id,
            series_id: video.series_id,
            episode_number: video.episode_number,
            thumbnail_url: video.thumbnail_url,
            status: video.status,
            is_public: video.is_public,
            created_at: video.created_at,
            updated_at: video.updated_at
        };
    }
    
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

    static getMiniMetadataForPlayer = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const videoId = req.params.videoId;

        // Helper function to format duration
        const formatDuration = (seconds) => {
            if (!seconds) return "Unknown";
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else {
                return `${minutes}m`;
            }
        };

        // Get the video by videoId
        const video = await db.getVideoById(videoId);
        if (!video || !video.is_public) {
            throw new NotFoundError("Video not found or not public.");
        }

        // Check if this video belongs to a series
        if (video.series_id) {
            console.log("video series id: " + video.series_id);
            // This video is part of a series
            const series = await db.getSeriesById(video.series_id);
            console.log("series found: ", series ? "yes" : "no");
            console.log("series is_public: ", series?.is_public);
            
            if (series && series.is_public) {
                // Get all episodes of this series
                const allEpisodes = await db.getEpisodesBySeriesId(video.series_id);
                console.log("all episodes count: ", allEpisodes.length);
                console.log("all episodes: ", allEpisodes.map(ep => ({ id: ep.id, episode_number: ep.episode_number, is_public: ep.is_public })));
                
                const publicEpisodes = allEpisodes.filter(ep => ep.is_public);
                console.log("public episodes count: ", publicEpisodes.length);
                console.log("public episodes: ", publicEpisodes.map(ep => ({ id: ep.id, episode_number: ep.episode_number })));

                // Create episode buttons with current episode highlighted
                const episodeButtons = publicEpisodes.map(ep => ({
                    videoId: ep.id,
                    number: ep.episode_number,
                    title: ep.title,
                    isCurrentEpisode: ep.id === parseInt(videoId),
                    playerUrl: `/player/${ep.id}`,
                    status: ep.status
                }));
                
                console.log("episode buttons created: ", episodeButtons);

                // Get current episode info
                const currentEpisode = publicEpisodes.find(ep => ep.id === parseInt(videoId));
                const episodeInfo = currentEpisode ? {
                    number: currentEpisode.episode_number,
                    title: currentEpisode.title,
                    description: currentEpisode.description,
                    duration: currentEpisode.duration_seconds ? formatDuration(currentEpisode.duration_seconds) : "Unknown"
                } : null;

                const result = {
                    id: series.id,
                    title: series.name,
                    year: series.year || new Date().getFullYear(),
                    duration: episodeInfo?.duration || "Unknown",
                    genre: series.genre || "Unknown",
                    country: series.country || "Unknown",
                    rating: series.rating || 8.5,
                    views: series.views || 0,
                    type: "series",
                    description: series.description || "",
                    poster: series.poster || null,
                    director: series.director || "Unknown",
                    cast: series.cast || "Unknown",
                    totalEpisodes: series.total_episodes || publicEpisodes.length,
                    episode: episodeInfo,
                    episodeButtons: episodeButtons,
                    // Add streaming info
                    streaming: {
                        hlsUrl: `/api/v1/stream/hls/${videoId}`,
                        available: video.status === 'completed'
                    }
                };
                
                console.log("returning series metadata with episodeButtons: ", result.episodeButtons.length);
                return result;
            } else {
                console.log("series not found or not public");
            }
        } else {
            console.log("video does not belong to a series");
        }

        // This is a standalone movie
        return {
            id: video.id,
            title: video.title,
            year: video.year || new Date().getFullYear(),
            duration: video.duration_seconds ? formatDuration(video.duration_seconds) : "Unknown",
            genre: video.genre || "Unknown",
            country: video.country || "Unknown",
            rating: video.rating || 8.5,
            views: video.views || 0,
            type: "movie",
            description: video.description || "",
            poster: video.poster || null,
            director: video.director || "Unknown",
            cast: video.actors || "Unknown",
            totalEpisodes: 1,
            episode: null,
            episodeButtons: [],
            // Add streaming info
            streaming: {
                hlsUrl: `/api/v1/stream/hls/${videoId}`,
                available: video.status === 'completed'
            }
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

    static videoReadyToServe = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const { videoId } = req.body;

        if (!videoId) {
            throw new BadRequestError("Video ID is required.");
        }

        // Check if video exists
        const video = await db.getVideoById(videoId);
        if (!video) {
            throw new NotFoundError("Video not found.");
        }

        // Update video status to 'ready' or 'completed'
        const updatedVideo = await db.updateVideo(videoId, { 
            status: 'ready',
            updated_at: new Date().toISOString()
        });

        if (!updatedVideo) {
            throw new InternalServerError("Failed to update video status.");
        }

        // Find and update the corresponding upload record
        const uploads = await db.getUploadsByUserId(video.uploader_user_id);
        const upload = uploads.find(upload => upload.video_id === parseInt(videoId));
        
        let uploadUpdated = false;
        let tempFolderCleaned = false;
        
        if (upload) {
            await db.updateUpload(upload.id, {
                status: 'completed',
                completed_at: new Date().toISOString()
            });
            uploadUpdated = true;
            
            // Clean up temporary upload folder
            try {
                const tempFolderPath = path.join(process.cwd(), 'uploads', 'tmp', upload.id.toString());
                await fs.rm(tempFolderPath, { recursive: true, force: true });
                tempFolderCleaned = true;
                console.log(`✅ Cleaned up temporary folder: ${tempFolderPath}`);
            } catch (cleanupError) {
                console.warn(`⚠️ Warning: Could not clean up temporary folder for upload ${upload.id}:`, cleanupError.message);
                // Don't throw error for cleanup failure, just log it
            }
        }

        return {
            video: updatedVideo,
            message: "Video marked as ready to serve successfully",
            uploadUpdated: uploadUpdated,
            tempFolderCleaned: tempFolderCleaned,
            transcodingJobsUpdated: transcodingJobs.length
        };
    }
}

module.exports = VideoMetadataService 