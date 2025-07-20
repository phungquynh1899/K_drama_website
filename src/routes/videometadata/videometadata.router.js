const express = require('express')
const videometadataRouter = express.Router()
const VideoMetadataController = require(`../../controllers/videometadata/videometadata.controller`)
const asyncHandler = require(`../../utils/asyncHandler.util`)
const authUser = require(`../../middlewares/authUser.middleware`)
const authenticationService = require('../../middlewares/authenticationService.middleware')
//SERVICE ENDPOINTS
//server B would annouce they have done video processing
videometadataRouter.post('/service/video-ready-to-serve', asyncHandler(VideoMetadataController.videoReadyToServe))

//server upload updates upload status 
videometadataRouter.post('/createVideo', authenticationService, asyncHandler(VideoMetadataController.createVideo))
videometadataRouter.post('/createUpload', authenticationService, asyncHandler(VideoMetadataController.createUpload))
videometadataRouter.post('/createSeries', authenticationService, asyncHandler(VideoMetadataController.createSeries))
videometadataRouter.post('/getSeriesById/:seriesId', authenticationService, asyncHandler(VideoMetadataController.getSeriesById))
videometadataRouter.post('/getEpisodeBySeriesAndNumber', authenticationService, asyncHandler(VideoMetadataController.getEpisodeBySeriesAndNumber))
videometadataRouter.post('/getVideoById', authenticationService, asyncHandler(VideoMetadataController.getVideoById))
videometadataRouter.post('/updateVideo', authenticationService, asyncHandler(VideoMetadataController.updateVideo))
videometadataRouter.post('/updateSeries', authenticationService, asyncHandler(VideoMetadataController.updateSeries))
videometadataRouter.get('/getVideoByUploadId', authenticationService, asyncHandler(VideoMetadataController.getVideoByUploadId))
// ========================================
// FRONTEND USER ENDPOINTS (Read-focused)
// ========================================
// These endpoints are for frontend users browsing and watching videos
// Mostly read operations, minimal writes (view counting)


// Public endpoints (no auth required for browsing)
//rate limit sẽ để cho cdn đảm nhận
videometadataRouter.get('/public', asyncHandler(VideoMetadataController.getPublicVideoMetadata))
videometadataRouter.get('/public/:videoId', asyncHandler(VideoMetadataController.getPublicVideoMetadataById))
videometadataRouter.get('/public/series/:seriesName', asyncHandler(VideoMetadataController.getPublicSeriesEpisodes))
videometadataRouter.get('/public/search', asyncHandler(VideoMetadataController.searchPublicVideoMetadata))
videometadataRouter.get('/public/stats/overview', asyncHandler(VideoMetadataController.getPublicOverviewStats))
videometadataRouter.get('/public/stats/popular', asyncHandler(VideoMetadataController.getPublicPopularVideos))

// Player-specific mini metadata endpoint
videometadataRouter.get('/mini-metadata-for-player/:videoId', asyncHandler(VideoMetadataController.getMiniMetadataForPlayer))


// User authenticated endpoints (for view counting, likes, etc.)
videometadataRouter.use('/user', authUser)
videometadataRouter.get('/user', asyncHandler(VideoMetadataController.getUserVideoMetadata))
videometadataRouter.get('/user/:videoId', asyncHandler(VideoMetadataController.getUserVideoMetadataById))
videometadataRouter.post('/user/:videoId/views', asyncHandler(VideoMetadataController.incrementViewCount))


// ========================================
// BACKEND SERVICE ENDPOINTS (Write-focused)
// ========================================
// These endpoints are for backend services (laptops) handling upload/transcode/storage
// Heavy write operations, internal service authentication

videometadataRouter.get('/service', asyncHandler(VideoMetadataController.getServiceVideoMetadata))
videometadataRouter.get('/service/:videoId', asyncHandler(VideoMetadataController.getServiceVideoMetadataById))
videometadataRouter.post('/service', asyncHandler(VideoMetadataController.createVideoMetadata))
videometadataRouter.put('/service/:videoId', asyncHandler(VideoMetadataController.updateVideoMetadata))
videometadataRouter.delete('/service/:videoId', asyncHandler(VideoMetadataController.deleteVideoMetadata))
videometadataRouter.put('/service/:videoId/status', asyncHandler(VideoMetadataController.updateVideoStatus))
videometadataRouter.put('/service/:videoId/transcoding', asyncHandler(VideoMetadataController.updateTranscodingStatus))
videometadataRouter.put('/service/:videoId/files', asyncHandler(VideoMetadataController.updateVideoFiles))
videometadataRouter.get('/service/stats/processing', asyncHandler(VideoMetadataController.getProcessingStats))
videometadataRouter.get('/service/stats/storage', asyncHandler(VideoMetadataController.getStorageStats))

module.exports = videometadataRouter 