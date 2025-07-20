const VideoMetadataService = require('../../services/videometadata/videometadata.service')
const { OK, CREATED } = require("../../response/success.response")

class VideoMetadataController {
    static createVideo = async (req, res, next) =>{
        return new OK({
            message: "Video created successfully",
            metadata: await VideoMetadataService.createVideo(req)
        }).send(res)
    }
    static createUpload = async (req, res, next) => {
        return new OK({
            message: "Upload created successfully",
            metadata: await VideoMetadataService.createUpload(req)
        }).send(res)
    }
    static createSeries = async (req, res, next) => {
        return new OK({
            message: "Series created successfully",
            metadata: await VideoMetadataService.createSeries(req)
        }).send(res)
    }
    static getSeriesById = async (req, res, next) => {
        return new OK({
            message: "Series fetched successfully",
            metadata: await VideoMetadataService.getSeriesById(req)
        }).send(res)
    }

    static getEpisodeBySeriesAndNumber = async (req, res, next) => {
        return new OK({
            message: "Episode fetched successfully",
            metadata: await VideoMetadataService.getEpisodeBySeriesAndNumber(req)
        }).send(res)
    }

    static getVideoById = async (req, res, next) => {
        return new OK({
            message: "Video fetched successfully",
            metadata: await VideoMetadataService.getVideoById(req)
        }).send(res)
    }
    static uploadVideo = async (req, res, next) => {
        return new OK({
            message: "Video thumbnail uploaded successfully",
            metadata: await VideoMetadataService.uploadVideo(req)
        }).send(res)
    }

    static updateSeries = async (req, res, next) => {
        return new OK({
            message: "Series updated successfully",
            metadata: await VideoMetadataService.updateSeries(req)
        }).send(res)
    }

    static getVideoByUploadId = async (req, res)=>{
        return new OK({
            message: "Video fetched by uploadId successfully",
            metadata: await VideoMetadataService.getVideoByUploadId(req)
        }).send(res)
    }


    // ========================================
    // FRONTEND USER ENDPOINTS (Read-focused)
    // ========================================

    // Public endpoints (no auth required)
    static getPublicVideoMetadata = async (req, res, next) => {
        return new OK({
            "message": "Fetched public video metadata successfully",
            "metadata": await VideoMetadataService.getPublicVideoMetadata(req)
        }).send(res)
    }

    static getPublicVideoMetadataById = async (req, res, next) => {
        return new OK({
            "message": "Fetched public video metadata successfully",
            "metadata": await VideoMetadataService.getPublicVideoMetadataById(req)
        }).send(res)
    }

    static getPublicSeriesEpisodes = async (req, res, next) => {
        return new OK({
            "message": "Fetched public series episodes successfully",
            "metadata": await VideoMetadataService.getPublicSeriesEpisodes(req)
        }).send(res)
    }

    static searchPublicVideoMetadata = async (req, res, next) => {
        return new OK({
            "message": "Public search completed successfully",
            "metadata": await VideoMetadataService.searchPublicVideoMetadata(req)
        }).send(res)
    }

    static getPublicOverviewStats = async (req, res, next) => {
        return new OK({
            "message": "Public overview statistics fetched successfully",
            "metadata": await VideoMetadataService.getPublicOverviewStats(req)
        }).send(res)
    }

    static getPublicPopularVideos = async (req, res, next) => {
        return new OK({
            "message": "Public popular videos fetched successfully",
            "metadata": await VideoMetadataService.getPublicPopularVideos(req)
        }).send(res)
    }

    static getMiniMetadataForPlayer = async (req, res, next) => {
        return new OK({
            "message": "Mini metadata for player fetched successfully",
            "metadata": await VideoMetadataService.getMiniMetadataForPlayer(req)
        }).send(res)
    }

    // User authenticated endpoints
    static getUserVideoMetadata = async (req, res, next) => {
        return new OK({
            "message": "Fetched user video metadata successfully",
            "metadata": await VideoMetadataService.getUserVideoMetadata(req)
        }).send(res)
    }

    static getUserVideoMetadataById = async (req, res, next) => {
        return new OK({
            "message": "Fetched user video metadata successfully",
            "metadata": await VideoMetadataService.getUserVideoMetadataById(req)
        }).send(res)
    }

    static incrementViewCount = async (req, res, next) => {
        return new OK({
            "message": "View count updated successfully",
            "metadata": await VideoMetadataService.incrementViewCount(req)
        }).send(res)
    }

    static likeVideo = async (req, res, next) => {
        return new OK({
            "message": "Video liked successfully",
            "metadata": await VideoMetadataService.likeVideo(req)
        }).send(res)
    }

    static dislikeVideo = async (req, res, next) => {
        return new OK({
            "message": "Video disliked successfully",
            "metadata": await VideoMetadataService.dislikeVideo(req)
        }).send(res)
    }

    // ========================================
    // BACKEND SERVICE ENDPOINTS (Write-focused)
    // ========================================

    static getServiceVideoMetadata = async (req, res, next) => {
        return new OK({
            "message": "Fetched service video metadata successfully",
            "metadata": await VideoMetadataService.getServiceVideoMetadata(req)
        }).send(res)
    }

    static getServiceVideoMetadataById = async (req, res, next) => {
        return new OK({
            "message": "Fetched service video metadata successfully",
            "metadata": await VideoMetadataService.getServiceVideoMetadataById(req)
        }).send(res)
    }

    static createVideoMetadata = async (req, res, next) => {
        return new CREATED({
            "message": "Video metadata created successfully",
            "metadata": await VideoMetadataService.createVideoMetadata(req)
        }).send(res)
    }

    static updateVideoMetadata = async (req, res, next) => {
        return new OK({
            "message": "Video metadata updated successfully",
            "metadata": await VideoMetadataService.updateVideoMetadata(req)
        }).send(res)
    }

    static deleteVideoMetadata = async (req, res, next) => {
        return new OK({
            "message": "Video metadata deleted successfully",
            "metadata": await VideoMetadataService.deleteVideoMetadata(req)
        }).send(res)
    }

    static updateVideoStatus = async (req, res, next) => {
        return new OK({
            "message": "Video status updated successfully",
            "metadata": await VideoMetadataService.updateVideoStatus(req)
        }).send(res)
    }

    static updateTranscodingStatus = async (req, res, next) => {
        return new OK({
            "message": "Transcoding status updated successfully",
            "metadata": await VideoMetadataService.updateTranscodingStatus(req)
        }).send(res)
    }

    static updateVideoFiles = async (req, res, next) => {
        return new OK({
            "message": "Video files updated successfully",
            "metadata": await VideoMetadataService.updateVideoFiles(req)
        }).send(res)
    }

    static getProcessingStats = async (req, res, next) => {
        return new OK({
            "message": "Processing statistics fetched successfully",
            "metadata": await VideoMetadataService.getProcessingStats(req)
        }).send(res)
    }

    static getStorageStats = async (req, res, next) => {
        return new OK({
            "message": "Storage statistics fetched successfully",
            "metadata": await VideoMetadataService.getStorageStats(req)
        }).send(res)
    }

    static videoReadyToServe = async (req, res, next) => {
        return new OK({
            "message": "Video ready to serve notification processed successfully",
            "metadata": await VideoMetadataService.videoReadyToServe(req)
        }).send(res)
    }
}

module.exports = VideoMetadataController 