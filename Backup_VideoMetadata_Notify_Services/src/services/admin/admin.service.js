`use strict`
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const { ConflictError, InternalServerError, BadRequestError, NotFoundError, ForbiddenError } = require('../../response/error.response');

class AdminService {
    static getAllUsersForAdmin = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        
        const users = await db.getAllUsers();
        
        // Return users without sensitive information
        return users.map(user => ({
            id: user.id,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at
        }));
    }

    static adminBlocking = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.params.id;

        // Prevent admin from blocking themselves
        if (req.user.id === parseInt(userId)) {
            throw new BadRequestError("You cannot block yourself.");
        }

        // Find the user
        const user = await db.getUserById(userId);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        // Check if user is already blocked
        if (!user.is_active) {
            throw new BadRequestError("User is already blocked.");
        }

        // Block the user by setting is_active to 0
        const updated = await db.updateUser(userId, { is_active: 0 });
        
        if (!updated) {
            throw new InternalServerError("Failed to block user.");
        }

        return {
            message: `Admin has blocked the user: ${userId}`,
            user: {
                id: user.id,
                email: user.email,
                is_active: 0
            }
        };
    }

    static adminUnblocking = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.params.id;

        // Prevent admin from unblocking themselves
        if (req.user.id === parseInt(userId)) {
            throw new BadRequestError("You cannot unblock yourself.");
        }

        // Find the user
        const user = await db.getUserById(userId);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        // Check if user is already unblocked
        if (user.is_active) {
            throw new BadRequestError("User is already unblocked.");
        }

        // Unblock the user by setting is_active to 1
        const updated = await db.updateUser(userId, { is_active: 1 });
        
        if (!updated) {
            throw new InternalServerError("Failed to unblock user.");
        }

        return {
            message: `Admin has unblocked the user: ${userId}`,
            user: {
                id: user.id,
                email: user.email,
                is_active: 1
            }
        };
    }

    static adminDeleteUser = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (req.user.id === parseInt(userId)) {
            throw new BadRequestError("You cannot delete yourself.");
        }

        // Find the user
        const user = await db.getUserById(userId);
        if (!user) {
            throw new NotFoundError("User not found.");
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
            throw new InternalServerError("Failed to delete user.");
        }

        return {
            message: `Admin has deleted the user: ${userId}`,
            deletedUser: {
                id: user.id,
                email: user.email
            }
        };
    }

    static adminUpdateUserRole = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.params.id;
        const { role } = req.body;

        // Validate role
        const validRoles = ['user', 'admin', 'moderator'];
        if (!validRoles.includes(role)) {
            throw new BadRequestError("Invalid role. Must be one of: user, admin, moderator");
        }

        // Prevent admin from changing their own role
        if (req.user.id === parseInt(userId)) {
            throw new BadRequestError("You cannot change your own role.");
        }

        // Find the user
        const user = await db.getUserById(userId);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        // Update user role
        const updated = await db.updateUser(userId, { role });
        
        if (!updated) {
            throw new InternalServerError("Failed to update user role.");
        }

        return {
            message: `Admin has updated user role to: ${role}`,
            user: {
                id: user.id,
                email: user.email,
                role: role
            }
        };
    }

    static adminGetUserStats = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        const userId = req.params.id;

        // Find the user
        const user = await db.getUserById(userId);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        // Get user's videos
        const userVideos = await db.getVideosByUserId(userId);
        
        // Get user's uploads
        const userUploads = await db.getUploadsByUserId(userId);
        
        // Get user's API keys
        const userApiKeys = await db.getApiKeysByUserId(userId);

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                is_active: user.is_active,
                created_at: user.created_at
            },
            stats: {
                totalVideos: userVideos.length,
                totalUploads: userUploads.length,
                totalApiKeys: userApiKeys.length,
                activeApiKeys: userApiKeys.filter(key => key.is_active).length
            }
        };
    }

    static adminGetSystemStats = async (req) => {
        const db = BetterSqliteDatabase.getInstance();
        
        // Get all users
        const allUsers = await db.getAllUsers();
        
        // Get all videos
        const allVideos = await db.listVideos();
        
        // Get all uploads
        const allUploads = await db.getAllUploads ? await db.getAllUploads() : [];
        
        // Get all API keys
        const allApiKeys = await db.getAllApiKeys ? await db.getAllApiKeys() : [];

        return {
            systemStats: {
                totalUsers: allUsers.length,
                activeUsers: allUsers.filter(user => user.is_active).length,
                blockedUsers: allUsers.filter(user => !user.is_active).length,
                totalVideos: allVideos.length,
                totalUploads: allUploads.length,
                totalApiKeys: allApiKeys.length,
                activeApiKeys: allApiKeys.filter(key => key.is_active).length
            },
            userBreakdown: {
                admins: allUsers.filter(user => user.role === 'admin').length,
                moderators: allUsers.filter(user => user.role === 'moderator').length,
                regularUsers: allUsers.filter(user => user.role === 'user').length
            }
        };
    }
}

module.exports = AdminService;