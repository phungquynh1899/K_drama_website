`use strict`
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const { InternalServerError, BadRequestError, NotFoundError, ForbiddenError } = require('../../response/error.response');
const bcrypt = require('bcrypt');

class UserService {
    static getProfile = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.user.id;
        
        const user = await db.getUserById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        
        // Return user data with specific fields (excluding sensitive info)
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at
        };
    }

    static getDashboardStats = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.user.id;
        
        // Get user's uploaded videos
        const uploadedVideos = await db.getVideosByUserId(userId);
        const uploadedCount = uploadedVideos.length;
        
        // Calculate total views for user's videos
        let totalViews = 0;
        for (const video of uploadedVideos) {
            const analytics = await db.getAnalyticsByVideoId(video.id);
            totalViews += analytics.length;
        }
        
        // Get user's watch history
        const userAnalytics = await db.getAnalyticsByUserId(userId);
        const watchedCount = userAnalytics.length;
        
        // Calculate total watch time (in hours)
        const totalWatchTime = userAnalytics.reduce((total, analytics) => {
            return total + (analytics.watch_duration || 0);
        }, 0);
        const watchTimeHours = Math.round(totalWatchTime / 3600);
        
        // Mock data for favorites and playlists (since we don't have these tables yet)
        const favoritesCount = 0;
        const playlistsCount = 0;
        
        return {
            uploadedCount,
            totalViews,
            watchedCount,
            watchTime: watchTimeHours,
            favoritesCount,
            playlistsCount
        };
    }

    static userProfile = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.params.id;
        
        const user = await db.getUserById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        
        // Return user data with specific fields (excluding sensitive info)
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at
        };
    }

    static deleteAccount = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.user.id; // Changed from req.user.accountID to req.user.id
        
        const user = await db.getUserById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        
        // Delete all videos uploaded by the user
        const userVideos = await db.getVideosByUserId(userId);
        for (const video of userVideos) {
            await db.deleteVideo(video.id);
        }
        
        // Delete all uploads by the user
        const userUploads = await db.getUploadsByUserId(userId);
        for (const upload of userUploads) {
            await db.deleteUpload(upload.id);
        }
        
        // Delete all API keys for the user
        const userApiKeys = await db.getApiKeysByUserId(userId);
        for (const apiKey of userApiKeys) {
            await db.deleteApiKey(apiKey.id);
        }
        
        // Delete refresh tokens and key pairs
        await db.deleteRefreshTokenByUserId(userId);
        await db.deleteKeyPairByUserId(userId);
        
        // Finally delete the user
        const deleted = await db.deleteUser(userId);
        if (!deleted) {
            throw new InternalServerError('Failed to delete user account');
        }
        
        return { message: 'Account deleted successfully' };
    }

    static updatePassword = async (req) => {
        const { oldPassword, newPassword } = req.body;
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.user.id; // Changed from req.user.accountID to req.user.id
        
        const user = await db.getUserById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        
        // Verify old password
        const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isPasswordCorrect) {
            throw new BadRequestError('Old password is incorrect');
        }
        
        // Hash new password
        const hashPassword = await bcrypt.hash(newPassword, 10);
        
        // Update user password
        const updated = await db.updateUser(userId, {
            password_hash: hashPassword
        });
        
        if (!updated) {
            throw new InternalServerError('Failed to update password');
        }
        
        return { 
            message: 'Password updated successfully',
            user: { 
                id: user.id, 
                email: user.email 
            } 
        };
    }

    static getUserVideos = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.user.id;
        
        const videos = await db.getVideosByUserId(userId);
        
        // Add view count for each video
        const videosWithStats = await Promise.all(videos.map(async (video) => {
            const analytics = await db.getAnalyticsByVideoId(video.id);
            return {
                ...video,
                views: analytics.length
            };
        }));
        
        return videosWithStats;
    }

    static deleteUserVideo = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.user.id;
        const videoId = req.params.id;
        
        // Check if video exists and belongs to user
        const video = await db.getVideoById(videoId);
        if (!video) {
            throw new NotFoundError('Video not found');
        }
        
        if (video.uploader_user_id !== userId) {
            throw new ForbiddenError('You can only delete your own videos');
        }
        
        // Delete the video
        const deleted = await db.deleteVideo(videoId);
        if (!deleted) {
            throw new InternalServerError('Failed to delete video');
        }
        
        return { message: 'Video deleted successfully' };
    }

    static logout = async ({ userId }) => {
        const db = BetterSqliteDatabase.getInstance();
        await db.deleteRefreshTokenByUserId(userId);
        await db.deleteKeyPairByUserId(userId);
        return 'OK';
    }
}

module.exports = UserService;