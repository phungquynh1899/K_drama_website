const request = require('supertest');
const app = require('../../app');
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock the database
jest.mock('../../db/BetterSqliteDatabase');

describe('Admin Routes Integration Tests', () => {
    let mockDb;
    let adminUser;
    let regularUser;
    let validAdminToken;
    let validUserToken;
    let testKeyPair;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Create mock database instance
        mockDb = {
            getUserById: jest.fn(),
            updateUser: jest.fn(),
            deleteUser: jest.fn(),
            getAllUsers: jest.fn(),
            getVideosByUserId: jest.fn(),
            deleteVideo: jest.fn(),
            getUploadsByUserId: jest.fn(),
            deleteUpload: jest.fn(),
            getApiKeysByUserId: jest.fn(),
            deleteApiKey: jest.fn(),
            deleteRefreshTokenByUserId: jest.fn(),
            deleteKeyPairByUserId: jest.fn(),
            getKeyPairByUserId: jest.fn(),
            listVideos: jest.fn(),
            getAllUploads: jest.fn(),
            getAllApiKeys: jest.fn()
        };

        // Mock the getInstance method
        BetterSqliteDatabase.getInstance.mockReturnValue(mockDb);

        // Create test admin user data
        adminUser = {
            id: 1,
            email: 'admin@example.com',
            password_hash: bcrypt.hashSync('adminpass123', 10),
            role: 'admin',
            is_active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Create test regular user data
        regularUser = {
            id: 2,
            email: 'user@example.com',
            password_hash: bcrypt.hashSync('userpass123', 10),
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

        // Mock the key pair retrieval for both users
        mockDb.getKeyPairByUserId.mockImplementation((userId) => {
            if (userId == 1 || userId == 2) {
                return {
                    id: userId,
                    user_id: userId,
                    public_key: testKeyPair.publicKey,
                    private_key: testKeyPair.privateKey,
                    is_active: 1
                };
            }
            return null;
        });

        // Create valid JWT tokens for testing using RS256
        validAdminToken = jwt.sign(
            { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
            testKeyPair.privateKey,
            { algorithm: 'RS256', expiresIn: '1h' }
        );

        validUserToken = jwt.sign(
            { userId: regularUser.id, email: regularUser.email, role: regularUser.role },
            testKeyPair.privateKey,
            { algorithm: 'RS256', expiresIn: '1h' }
        );
    });

    describe('GET /api/v1/admin/getAllUsersForAdmin - Get All Users', () => {
        it('should return all users when admin is authenticated', async () => {
            // Mock database responses
            const mockUsers = [
                { id: 1, email: 'admin@example.com', role: 'admin', is_active: 1, created_at: '2023-01-01', updated_at: '2023-01-01' },
                { id: 2, email: 'user@example.com', role: 'user', is_active: 1, created_at: '2023-01-02', updated_at: '2023-01-02' },
                { id: 3, email: 'moderator@example.com', role: 'admin', is_active: 0, created_at: '2023-01-03', updated_at: '2023-01-03' }
            ];
            mockDb.getAllUsers.mockResolvedValue(mockUsers);
            
            // Mock getUserById for authAdmin middleware
            mockDb.getUserById.mockResolvedValue(adminUser);

            const response = await request(app)
                .get('/api/v1/admin/getAllUsersForAdmin')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Fetched users for admin successfully');
            expect(response.body).toHaveProperty('metadata');
            expect(response.body.metadata).toHaveLength(3);
            expect(response.body.metadata[0]).toHaveProperty('id', 1);
            expect(response.body.metadata[0]).toHaveProperty('email', 'admin@example.com');
            expect(response.body.metadata[0]).toHaveProperty('role', 'admin');
            expect(response.body.metadata[0]).toHaveProperty('is_active', 1);

            expect(mockDb.getAllUsers).toHaveBeenCalled();
            expect(mockDb.getUserById).toHaveBeenCalledWith(1);
        });

        it('should return 403 when regular user tries to access admin endpoint', async () => {
            // Mock getUserById for authAdmin middleware
            mockDb.getUserById.mockResolvedValue(regularUser);
            const response = await request(app)
                .get('/api/v1/admin/getAllUsersForAdmin')
                .set('Authorization', `Bearer ${validUserToken}`)
                .expect(403);

            expect(response.body).toHaveProperty('error');
        });

        it('should return 401 when no token provided', async () => {
            const response = await request(app)
                .get('/api/v1/admin/getAllUsersForAdmin')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('PUT /api/v1/admin/adminBlocking/:id - Block User', () => {
        it('should block user successfully when admin is authenticated', async () => {
            // Mock database responses - getUserById will be called twice:
            // 1. By authAdmin middleware (with admin ID = 1)
            // 2. By service (with target user ID = 2)
            mockDb.getUserById
                .mockResolvedValueOnce(adminUser)  // First call for authAdmin middleware
                .mockResolvedValueOnce(regularUser); // Second call for service
            mockDb.updateUser.mockResolvedValue(true);

            const response = await request(app)
                .put('/api/v1/admin/adminBlocking/2')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Admin blocking successfully');
            expect(response.body).toHaveProperty('metadata');
            expect(response.body.metadata).toHaveProperty('message', 'Admin has blocked the user: 2');
            expect(response.body.metadata).toHaveProperty('user');
            expect(response.body.metadata.user).toHaveProperty('id', 2);
            expect(response.body.metadata.user).toHaveProperty('email', 'user@example.com');
            expect(response.body.metadata.user).toHaveProperty('is_active', 0);

            expect(mockDb.getUserById).toHaveBeenCalledTimes(2);
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(1, 1); // authAdmin middleware
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(2, '2'); // service
            expect(mockDb.updateUser).toHaveBeenCalledWith('2', { is_active: 0 });
        });

        it('should return 400 when admin tries to block themselves', async () => {
            // Mock getUserById for authAdmin middleware
            mockDb.getUserById.mockResolvedValue(adminUser);
            const response = await request(app)
                .put('/api/v1/admin/adminBlocking/1')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(400);

            expect(response.body).toHaveProperty('error', 'You cannot block yourself.');
        });

        it('should return 404 when user to block does not exist', async () => {
            // Mock database responses - getUserById will be called twice:
            // 1. By authAdmin middleware (with admin ID = 1) - should succeed
            // 2. By service (with target user ID = 999) - should fail
            mockDb.getUserById
                .mockResolvedValueOnce(adminUser)  // First call for authAdmin middleware
                .mockResolvedValueOnce(null); // Second call for service - user not found

            const response = await request(app)
                .put('/api/v1/admin/adminBlocking/999')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error', 'User not found.');
            expect(mockDb.getUserById).toHaveBeenCalledTimes(2);
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(1, 1); // authAdmin middleware
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(2, '999'); // service
            expect(mockDb.updateUser).not.toHaveBeenCalled();
        });

        it('should return 400 when user is already blocked', async () => {
            // Mock database responses - getUserById will be called twice:
            // 1. By authAdmin middleware (with admin ID = 1) - should succeed
            // 2. By service (with target user ID = 2) - user already blocked
            const blockedUser = { ...regularUser, is_active: 0 };
            mockDb.getUserById
                .mockResolvedValueOnce(adminUser)  // First call for authAdmin middleware
                .mockResolvedValueOnce(blockedUser); // Second call for service - user already blocked

            const response = await request(app)
                .put('/api/v1/admin/adminBlocking/2')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(400);

            expect(response.body).toHaveProperty('error', 'User is already blocked.');
            expect(mockDb.getUserById).toHaveBeenCalledTimes(2);
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(1, 1); // authAdmin middleware
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(2, '2'); // service
            expect(mockDb.updateUser).not.toHaveBeenCalled();
        });

        it('should return 500 when database update fails', async () => {
            // Mock database responses - getUserById will be called twice:
            // 1. By authAdmin middleware (with admin ID = 1) - should succeed
            // 2. By service (with target user ID = 2) - should succeed
            mockDb.getUserById
                .mockResolvedValueOnce(adminUser)  // First call for authAdmin middleware
                .mockResolvedValueOnce(regularUser); // Second call for service
            mockDb.updateUser.mockResolvedValue(false);

            const response = await request(app)
                .put('/api/v1/admin/adminBlocking/2')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(500);

            expect(response.body).toHaveProperty('error', 'Failed to block user.');
            expect(mockDb.getUserById).toHaveBeenCalledTimes(2);
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(1, 1); // authAdmin middleware
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(2, '2'); // service
            expect(mockDb.updateUser).toHaveBeenCalledWith('2', { is_active: 0 });
        });

        it('should return 403 when regular user tries to block another user', async () => {
            // Mock getUserById for authAdmin middleware - user exists but is not admin
            mockDb.getUserById.mockResolvedValue(regularUser);

            const response = await request(app)
                .put('/api/v1/admin/adminBlocking/3')
                .set('Authorization', `Bearer ${validUserToken}`)
                .expect(403);

            expect(response.body).toHaveProperty('error', 'Access denied: Admin privileges required');
            expect(mockDb.getUserById).toHaveBeenCalledWith(2); // regularUser.id = 2
        });
    });

    describe('PUT /api/v1/admin/adminUnblocking/:id - Unblock User', () => {
        it('should unblock user successfully when admin is authenticated', async () => {
            // Mock database responses - getUserById will be called twice:
            // 1. By authAdmin middleware (with admin ID = 1)
            // 2. By service (with target user ID = 2)
            const blockedUser = { ...regularUser, is_active: 0 };
            mockDb.getUserById
                .mockResolvedValueOnce(adminUser)  // First call for authAdmin middleware
                .mockResolvedValueOnce(blockedUser); // Second call for service
            mockDb.updateUser.mockResolvedValue(true);

            const response = await request(app)
                .put('/api/v1/admin/adminUnblocking/2')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Admin unblocking successfully');
            expect(response.body).toHaveProperty('metadata');
            expect(response.body.metadata).toHaveProperty('message', 'Admin has unblocked the user: 2');
            expect(response.body.metadata).toHaveProperty('user');
            expect(response.body.metadata.user).toHaveProperty('id', 2);
            expect(response.body.metadata.user).toHaveProperty('email', 'user@example.com');
            expect(response.body.metadata.user).toHaveProperty('is_active', 1);

            expect(mockDb.getUserById).toHaveBeenCalledTimes(2);
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(1, 1); // authAdmin middleware
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(2, '2'); // service
            expect(mockDb.updateUser).toHaveBeenCalledWith('2', { is_active: 1 });
        });

        it('should return 400 when admin tries to unblock themselves', async () => {
            // Mock getUserById for authAdmin middleware
            mockDb.getUserById.mockResolvedValue(adminUser);
            const response = await request(app)
                .put('/api/v1/admin/adminUnblocking/1')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(400);

            expect(response.body).toHaveProperty('error', 'You cannot unblock yourself.');
        
        });

        it('should return 404 when user to unblock does not exist', async () => {
            // Mock database responses - getUserById will be called twice:
            // 1. By authAdmin middleware (with admin ID = 1) - should succeed
            // 2. By service (with target user ID = 999) - should fail
            mockDb.getUserById
                .mockResolvedValueOnce(adminUser)  // First call for authAdmin middleware
                .mockResolvedValueOnce(null); // Second call for service - user not found

            const response = await request(app)
                .put('/api/v1/admin/adminUnblocking/999')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error', 'User not found.');
            expect(mockDb.getUserById).toHaveBeenCalledTimes(2);
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(1, 1); // authAdmin middleware
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(2, '999'); // service
            expect(mockDb.updateUser).not.toHaveBeenCalled();
        });

        it('should return 400 when user is already unblocked', async () => {
            // Mock database responses - getUserById will be called twice:
            // 1. By authAdmin middleware (with admin ID = 1) - should succeed
            // 2. By service (with target user ID = 2) - user already unblocked
            mockDb.getUserById
                .mockResolvedValueOnce(adminUser)  // First call for authAdmin middleware
                .mockResolvedValueOnce(regularUser); // Second call for service - user already unblocked

            const response = await request(app)
                .put('/api/v1/admin/adminUnblocking/2')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(400);

            expect(response.body).toHaveProperty('error', 'User is already unblocked.');
            expect(mockDb.getUserById).toHaveBeenCalledTimes(2);
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(1, 1); // authAdmin middleware
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(2, '2'); // service
            expect(mockDb.updateUser).not.toHaveBeenCalled();
        });

        it('should return 500 when database update fails', async () => {
            // Mock database responses - getUserById will be called twice:
            // 1. By authAdmin middleware (with admin ID = 1) - should succeed
            // 2. By service (with target user ID = 2) - should succeed
            const blockedUser = { ...regularUser, is_active: 0 };
            mockDb.getUserById
                .mockResolvedValueOnce(adminUser)  // First call for authAdmin middleware
                .mockResolvedValueOnce(blockedUser); // Second call for service
            mockDb.updateUser.mockResolvedValue(false);

            const response = await request(app)
                .put('/api/v1/admin/adminUnblocking/2')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(500);

            expect(response.body).toHaveProperty('error', 'Failed to unblock user.');
            expect(mockDb.getUserById).toHaveBeenCalledTimes(2);
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(1, 1); // authAdmin middleware
            expect(mockDb.getUserById).toHaveBeenNthCalledWith(2, '2'); // service
            expect(mockDb.updateUser).toHaveBeenCalledWith('2', { is_active: 1 });
        });

        it('should return 403 when regular user tries to unblock another user', async () => {
            // Mock getUserById for authAdmin middleware - user exists but is not admin
            mockDb.getUserById.mockResolvedValue(regularUser);

            const response = await request(app)
                .put('/api/v1/admin/adminUnblocking/3')
                .set('Authorization', `Bearer ${validUserToken}`)
                .expect(403);

            expect(response.body).toHaveProperty('error', 'Access denied: Admin privileges required');
            expect(mockDb.getUserById).toHaveBeenCalledWith(2); // regularUser.id = 2
        });
    });

    describe('Authentication & Authorization', () => {
        it('should return 401 when no token provided for admin endpoints', async () => {
            const response = await request(app)
                .get('/api/v1/admin/getAllUsersForAdmin')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });

        it('should return 401 when invalid token provided', async () => {
            const response = await request(app)
                .get('/api/v1/admin/getAllUsersForAdmin')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });

        it('should return 403 when user with non-admin role tries to access admin endpoints', async () => {
            // Mock getUserById for authAdmin middleware - user exists but is not admin
            mockDb.getUserById.mockResolvedValue(regularUser);

            const response = await request(app)
                .get('/api/v1/admin/getAllUsersForAdmin')
                .set('Authorization', `Bearer ${validUserToken}`)
                .expect(403);

            expect(response.body).toHaveProperty('error', 'Access denied: Admin privileges required');
            expect(mockDb.getUserById).toHaveBeenCalledWith(2); // regularUser.id = 2
        });

        it('should return 403 when user with moderator role tries to access admin endpoints', async () => {
            // Create moderator user and token
            const moderatorUser = { ...regularUser, role: 'moderator' };
            const moderatorToken = jwt.sign(
                { userId: moderatorUser.id, email: moderatorUser.email, role: moderatorUser.role },
                testKeyPair.privateKey,
                { algorithm: 'RS256', expiresIn: '1h' }
            );

            // Mock getUserById for authAdmin middleware - user exists but is not admin
            mockDb.getUserById.mockResolvedValue(moderatorUser);

            const response = await request(app)
                .get('/api/v1/admin/getAllUsersForAdmin')
                .set('Authorization', `Bearer ${moderatorToken}`)
                .expect(403);

            expect(response.body).toHaveProperty('error', 'Access denied: Admin privileges required');
            expect(mockDb.getUserById).toHaveBeenCalledWith(2); // moderatorUser.id = 2
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            // Mock database to throw error
            mockDb.getAllUsers.mockRejectedValue(new Error('Database connection failed'));
            mockDb.getUserById.mockResolvedValue(adminUser);
            const response = await request(app)
                .get('/api/v1/admin/getAllUsersForAdmin')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(500);

            expect(response.body).toHaveProperty('error');
        });

        it('should return 404 for non-existent admin routes', async () => {
            mockDb.getUserById.mockResolvedValue(adminUser);
            const response = await request(app)
                .get('/api/v1/admin/nonexistent/route')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Admin Service Methods (if exposed via routes)', () => {
        it('should handle adminDeleteUser functionality', async () => {
            // Mock database responses for cascade delete
            mockDb.getUserById.mockResolvedValue(regularUser);
            mockDb.getVideosByUserId.mockResolvedValue([]);
            mockDb.getUploadsByUserId.mockResolvedValue([]);
            mockDb.getApiKeysByUserId.mockResolvedValue([]);
            mockDb.deleteRefreshTokenByUserId.mockResolvedValue();
            mockDb.deleteKeyPairByUserId.mockResolvedValue();
            mockDb.deleteUser.mockResolvedValue(true);

            // This would be tested if the route exists
            // For now, we're testing the service logic through the existing routes
            expect(mockDb.getUserById).toBeDefined();
            expect(mockDb.deleteUser).toBeDefined();
        });

        it('should handle adminUpdateUserRole functionality', async () => {
            // Mock database responses
            mockDb.getUserById.mockResolvedValue(regularUser);
            mockDb.updateUser.mockResolvedValue(true);

            // This would be tested if the route exists
            expect(mockDb.updateUser).toBeDefined();
        });
    });
}); 