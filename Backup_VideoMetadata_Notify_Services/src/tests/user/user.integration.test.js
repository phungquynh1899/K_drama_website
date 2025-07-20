const request = require('supertest');
const app = require('../../app');
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock the database
jest.mock('../../db/BetterSqliteDatabase');

describe('User Routes Integration Tests', () => {
    let mockDb;
    let testUser;
    let validToken;
    let testKeyPair;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Create mock database instance
        mockDb = {
            getUserById: jest.fn(),
            updateUser: jest.fn(),
            deleteUser: jest.fn(),
            getVideosByUserId: jest.fn(),
            deleteVideo: jest.fn(),
            getUploadsByUserId: jest.fn(),
            deleteUpload: jest.fn(),
            getApiKeysByUserId: jest.fn(),
            deleteApiKey: jest.fn(),
            deleteRefreshTokenByUserId: jest.fn(),
            deleteKeyPairByUserId: jest.fn(),
            getUserByEmail: jest.fn(),
            getAllUsers: jest.fn(),
            getKeyPairByUserId: jest.fn()
        };

        // Mock the getInstance method
        BetterSqliteDatabase.getInstance.mockReturnValue(mockDb);

        // Create test user data
        testUser = {
            id: 1,
            email: 'test@example.com',
            password_hash: bcrypt.hashSync('password123', 10),
            role: 'user',
            is_active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Generate RSA key pair for testing
        testKeyPair = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
        });

        // Mock the key pair retrieval
        mockDb.getKeyPairByUserId.mockResolvedValue({
            id: 1,
            user_id: testUser.id,
            public_key: testKeyPair.publicKey,
            private_key: testKeyPair.privateKey,
            is_active: 1
        });

        // Create a valid JWT token for testing using RS256
        validToken = jwt.sign(
            { userId: testUser.id, email: testUser.email },
            testKeyPair.privateKey,
            { algorithm: 'RS256', expiresIn: '1h' }
        );
    });

    describe('GET /api/v1/user/:id - Get User Profile', () => {
        it('should return user profile when user exists', async () => {
            // Mock database response
            mockDb.getUserById.mockResolvedValue(testUser);

            const response = await request(app)
                .get('/api/v1/user/1')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'OK');
            expect(response.body).toHaveProperty('metadata');
            expect(response.body.metadata).toHaveProperty('id', 1);
            expect(response.body.metadata).toHaveProperty('email', 'test@example.com');
            expect(response.body.metadata).toHaveProperty('role', 'user');
            expect(response.body.metadata).toHaveProperty('is_active', 1);
            expect(response.body.metadata).not.toHaveProperty('password_hash');

            expect(mockDb.getUserById).toHaveBeenCalledWith('1');
        });

        it('should return 404 when user does not exist', async () => {
            // Mock database response - user not found
            mockDb.getUserById.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/v1/user/999')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error', 'User not found');
            expect(mockDb.getUserById).toHaveBeenCalledWith('999');
        });

        it('should return 401 when no token provided', async () => {
            const response = await request(app)
                .get('/api/v1/user/1')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });

        it('should return 401 when invalid token provided', async () => {
            const response = await request(app)
                .get('/api/v1/user/1')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('PUT /api/v1/user/updatePassword - Update Password', () => {
        it('should update password successfully with valid old password', async () => {
            // Mock database responses
            mockDb.getUserById.mockResolvedValue(testUser);
            mockDb.updateUser.mockResolvedValue(true);

            const response = await request(app)
                .put('/api/v1/user/updatePassword')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    oldPassword: 'password123',
                    newPassword: 'newpassword456'
                })
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Password changed successfully');
            expect(response.body).toHaveProperty('metadata');
            expect(response.body.metadata).toHaveProperty('message', 'Password updated successfully');
            expect(response.body.metadata).toHaveProperty('user');
            expect(response.body.metadata.user).toHaveProperty('id', 1);
            expect(response.body.metadata.user).toHaveProperty('email', 'test@example.com');

            expect(mockDb.getUserById).toHaveBeenCalledWith(1);
            expect(mockDb.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({
                password_hash: expect.any(String)
            }));
        });

        it('should return 400 when old password is incorrect', async () => {
            // Mock database response
            mockDb.getUserById.mockResolvedValue(testUser);

            const response = await request(app)
                .put('/api/v1/user/updatePassword')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    oldPassword: 'wrongpassword',
                    newPassword: 'newpassword456'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Old password is incorrect');
            expect(mockDb.getUserById).toHaveBeenCalledWith(1);
            expect(mockDb.updateUser).not.toHaveBeenCalled();
        });

        it('should return 404 when user not found', async () => {
            // Mock database response - user not found
            mockDb.getUserById.mockResolvedValue(null);

            const response = await request(app)
                .put('/api/v1/user/updatePassword')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    oldPassword: 'password123',
                    newPassword: 'newpassword456'
                })
                .expect(404);

            expect(response.body).toHaveProperty('error', 'User not found');
            expect(mockDb.getUserById).toHaveBeenCalledWith(1);
            expect(mockDb.updateUser).not.toHaveBeenCalled();
        });

        it('should return 500 when database update fails', async () => {
            // Mock database responses
            mockDb.getUserById.mockResolvedValue(testUser);
            mockDb.updateUser.mockResolvedValue(false);

            const response = await request(app)
                .put('/api/v1/user/updatePassword')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    oldPassword: 'password123',
                    newPassword: 'newpassword456'
                })
                .expect(500);

            expect(response.body).toHaveProperty('error', 'Failed to update password');
            expect(mockDb.getUserById).toHaveBeenCalledWith(1);
            expect(mockDb.updateUser).toHaveBeenCalled();
        });

        it('should return 401 when no token provided', async () => {
            const response = await request(app)
                .put('/api/v1/user/updatePassword')
                .send({
                    oldPassword: 'password123',
                    newPassword: 'newpassword456'
                })
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('DELETE /api/v1/user/deleteAccount - Delete Account', () => {
        it('should delete account successfully', async () => {
            // Mock database responses
            mockDb.getUserById.mockResolvedValue(testUser);
            mockDb.getVideosByUserId.mockResolvedValue([]);
            mockDb.getUploadsByUserId.mockResolvedValue([]);
            mockDb.getApiKeysByUserId.mockResolvedValue([]);
            mockDb.deleteRefreshTokenByUserId.mockResolvedValue();
            mockDb.deleteKeyPairByUserId.mockResolvedValue();
            mockDb.deleteUser.mockResolvedValue(true);

            const response = await request(app)
                .delete('/api/v1/user/deleteAccount')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Account deleted successfully');
            expect(response.body).toHaveProperty('metadata');
            expect(response.body.metadata).toHaveProperty('message', 'Account deleted successfully');

            expect(mockDb.getUserById).toHaveBeenCalledWith(1);
            expect(mockDb.getVideosByUserId).toHaveBeenCalledWith(1);
            expect(mockDb.getUploadsByUserId).toHaveBeenCalledWith(1);
            expect(mockDb.getApiKeysByUserId).toHaveBeenCalledWith(1);
            expect(mockDb.deleteRefreshTokenByUserId).toHaveBeenCalledWith(1);
            expect(mockDb.deleteKeyPairByUserId).toHaveBeenCalledWith(1);
            expect(mockDb.deleteUser).toHaveBeenCalledWith(1);
        });

        it('should delete account with cascade delete of user data', async () => {
            // Mock user data
            const userVideos = [
                { id: 1, title: 'Video 1' },
                { id: 2, title: 'Video 2' }
            ];
            const userUploads = [
                { id: 1, filename: 'upload1.mp4' },
                { id: 2, filename: 'upload2.mp4' }
            ];
            const userApiKeys = [
                { id: 1, name: 'API Key 1' },
                { id: 2, name: 'API Key 2' }
            ];

            // Mock database responses
            mockDb.getUserById.mockResolvedValue(testUser);
            mockDb.getVideosByUserId.mockResolvedValue(userVideos);
            mockDb.getUploadsByUserId.mockResolvedValue(userUploads);
            mockDb.getApiKeysByUserId.mockResolvedValue(userApiKeys);
            mockDb.deleteVideo.mockResolvedValue(true);
            mockDb.deleteUpload.mockResolvedValue(true);
            mockDb.deleteApiKey.mockResolvedValue(true);
            mockDb.deleteRefreshTokenByUserId.mockResolvedValue();
            mockDb.deleteKeyPairByUserId.mockResolvedValue();
            mockDb.deleteUser.mockResolvedValue(true);

            const response = await request(app)
                .delete('/api/v1/user/deleteAccount')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Account deleted successfully');

            // Verify cascade deletes
            expect(mockDb.deleteVideo).toHaveBeenCalledWith(1);
            expect(mockDb.deleteVideo).toHaveBeenCalledWith(2);
            expect(mockDb.deleteUpload).toHaveBeenCalledWith(1);
            expect(mockDb.deleteUpload).toHaveBeenCalledWith(2);
            expect(mockDb.deleteApiKey).toHaveBeenCalledWith(1);
            expect(mockDb.deleteApiKey).toHaveBeenCalledWith(2);
        });

        it('should return 404 when user not found', async () => {
            // Mock database response - user not found
            mockDb.getUserById.mockResolvedValue(null);

            const response = await request(app)
                .delete('/api/v1/user/deleteAccount')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error', 'User not found');
            expect(mockDb.getUserById).toHaveBeenCalledWith(1);
            expect(mockDb.deleteUser).not.toHaveBeenCalled();
        });

        it('should return 500 when database delete fails', async () => {
            // Mock database responses
            mockDb.getUserById.mockResolvedValue(testUser);
            mockDb.getVideosByUserId.mockResolvedValue([]);
            mockDb.getUploadsByUserId.mockResolvedValue([]);
            mockDb.getApiKeysByUserId.mockResolvedValue([]);
            mockDb.deleteRefreshTokenByUserId.mockResolvedValue();
            mockDb.deleteKeyPairByUserId.mockResolvedValue();
            mockDb.deleteUser.mockResolvedValue(false);

            const response = await request(app)
                .delete('/api/v1/user/deleteAccount')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body).toHaveProperty('error', 'Failed to delete user account');
            expect(mockDb.deleteUser).toHaveBeenCalledWith(1);
        });

        it('should return 401 when no token provided', async () => {
            const response = await request(app)
                .delete('/api/v1/user/deleteAccount')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            // Mock database to throw error
            mockDb.getUserById.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app)
                .get('/api/v1/user/1')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body).toHaveProperty('error');
        });

        it('should return 404 for non-existent routes', async () => {
            const response = await request(app)
                .get('/api/v1/user/nonexistent/route')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Authentication Middleware', () => {
        it('should reject requests without Authorization header', async () => {
            const response = await request(app)
                .get('/api/v1/user/1')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });

        it('should reject requests with malformed Authorization header', async () => {
            const response = await request(app)
                .get('/api/v1/user/1')
                .set('Authorization', 'InvalidFormat')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });

        it('should reject requests with expired token', async () => {
            // Create expired token
            const expiredToken = jwt.sign(
                { userId: testUser.id, email: testUser.email },
                testKeyPair.privateKey,
                { algorithm: 'RS256', expiresIn: '-1h' }
            );

            const response = await request(app)
                .get('/api/v1/user/1')
                .set('Authorization', `Bearer ${expiredToken}`)
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });
}); 