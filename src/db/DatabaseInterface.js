// db/DatabaseInterface.js
// Abstract interface for the K-drama streaming website database
// Implementations (e.g., SQLite, MongoDB) should extend this class

class DatabaseInterface {
    // USERS
    async createUser(user) { throw new Error('Not implemented'); }
    async getUserById(id) { throw new Error('Not implemented'); }
    async getUserByEmail(email) { throw new Error('Not implemented'); }
    async updateUser(id, updates) { throw new Error('Not implemented'); }
    async deleteUser(id) { throw new Error('Not implemented'); }

    // API KEYS
    async createApiKey(apiKey) { throw new Error('Not implemented'); }
    async getApiKeyById(id) { throw new Error('Not implemented'); }
    async getApiKeyByKey(apiKey) { throw new Error('Not implemented'); }
    async getApiKeysByUserId(userId) { throw new Error('Not implemented'); }
    async deactivateApiKey(id) { throw new Error('Not implemented'); }
    async deleteApiKey(id) { throw new Error('Not implemented'); }

    // KEYS (public/private)
    async createKeyPair(keyPair) { throw new Error('Not implemented'); }
    async getKeyPairByUserId(userId) { throw new Error('Not implemented'); }
    async deactivateKeyPair(id) { throw new Error('Not implemented'); }
    async deleteKeyPair(id) { throw new Error('Not implemented'); }

    // VIDEOS
    async createVideo(video) { throw new Error('Not implemented'); }
    async getVideoById(id) { throw new Error('Not implemented'); }
    async getVideosByUserId(userId) { throw new Error('Not implemented'); }
    async updateVideo(id, updates) { throw new Error('Not implemented'); }
    async deleteVideo(id) { throw new Error('Not implemented'); }
    async listVideos(filter) { throw new Error('Not implemented'); }

    // UPLOADS
    async createUpload(upload) { throw new Error('Not implemented'); }
    async getUploadById(id) { throw new Error('Not implemented'); }
    async getUploadsByUserId(userId) { throw new Error('Not implemented'); }
    async updateUpload(id, updates) { throw new Error('Not implemented'); }
    async deleteUpload(id) { throw new Error('Not implemented'); }

    // UPLOAD CHUNKS
    async createUploadChunk(chunk) { throw new Error('Not implemented'); }
    async getUploadChunk(uploadId, chunkNumber) { throw new Error('Not implemented'); }
    async updateUploadChunk(id, updates) { throw new Error('Not implemented'); }
    async listUploadChunks(uploadId) { throw new Error('Not implemented'); }
    async deleteUploadChunk(id) { throw new Error('Not implemented'); }

    // TRANSCODING JOBS
    async createTranscodingJob(job) { throw new Error('Not implemented'); }
    async getTranscodingJobById(id) { throw new Error('Not implemented'); }
    async getTranscodingJobsByVideoId(videoId) { throw new Error('Not implemented'); }
    async updateTranscodingJob(id, updates) { throw new Error('Not implemented'); }
    async deleteTranscodingJob(id) { throw new Error('Not implemented'); }

    // VIDEO FILES
    async createVideoFile(file) { throw new Error('Not implemented'); }
    async getVideoFileById(id) { throw new Error('Not implemented'); }
    async getVideoFilesByVideoId(videoId) { throw new Error('Not implemented'); }
    async updateVideoFile(id, updates) { throw new Error('Not implemented'); }
    async deleteVideoFile(id) { throw new Error('Not implemented'); }

    // SERIES
    async createSeries(series) { throw new Error('Not implemented'); }
    async getSeriesById(id) { throw new Error('Not implemented'); }
    async getSeriesByUserId(userId) { throw new Error('Not implemented'); }
    async updateSeries(id, updates) { throw new Error('Not implemented'); }
    async deleteSeries(id) { throw new Error('Not implemented'); }
    async listSeries(filter) { throw new Error('Not implemented'); }
    async getEpisodesBySeriesId(seriesId) { throw new Error('Not implemented'); }
    async getEpisodeBySeriesAndNumber(seriesId, episodeNumber) { throw new Error('Not implemented'); }
}

module.exports = DatabaseInterface;
