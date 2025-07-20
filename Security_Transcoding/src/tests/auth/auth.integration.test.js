const request = require('supertest');
const app = require('../../app');
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

// Mock the database for integration tests
jest.mock('../../db/BetterSqliteDatabase');

describe('Auth API Integration Tests', () => {
    let mockDb;
    let testUser;
    let testKeyPair;
    let testRefreshToken;
    let accessToken;
    let refreshToken;

    beforeEach(() => {
        jest.clearAllMocks();
        //tạo các hàm của db giả 
        mockDb = {
            getUserByEmail: jest.fn(),
            createUser: jest.fn(),
            deleteRefreshTokenByUserId: jest.fn(),
            deleteKeyPairByUserId: jest.fn(),
            createKeyPair: jest.fn(),
            createRefreshToken: jest.fn(),
            getRefreshTokenByToken: jest.fn(),
            getKeyPairByUserId: jest.fn(),
            deleteRefreshTokenByToken: jest.fn()
        };

        BetterSqliteDatabase.getInstance.mockReturnValue(mockDb);
        //tạo kết quả giả 
        testUser = {
            id: 1,
            email: 'test@example.com',
            password_hash: '$2b$10$hashedpassword123',
            is_active: 1
        };

        testKeyPair = {
            user_id: 1,
            public_key: 'mock-public-key',
            private_key: 'mock-private-key',
            is_active: 1
        };

        testRefreshToken = {
            user_id: 1,
            refresh_token: 'mock-refresh-token',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };
    });

    describe('POST /api/v1/auth/register', () => {
        it('should register a new user successfully', async () => {
            // tạo input thật 
            const newUser = { id: 2, email: 'newuser@example.com' };
            mockDb.getUserByEmail.mockResolvedValue(null);
            mockDb.createUser.mockResolvedValue(newUser);

            //mô phỏng cách sử dụng trong thực tế, gửi request đi 
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'newuser@example.com',
                    password: 'password123'
                });
            //dự đoán kết quả
            expect(response.status).toBe(201);
            expect(response.body.message).toBe('Register successfully, please login');
            expect(response.body.metadata.user.email).toBe('newuser@example.com');
            expect(response.body.metadata.user.id).toBe(2);
        });

        it('should return 409 when email already exists', async () => {
            mockDb.getUserByEmail.mockResolvedValue(testUser);

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(409);
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    password: 'password123'
                });

            expect(response.status).toBe(400);
        });

        it('should return 400 when password is missing', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com'
                });

            expect(response.status).toBe(400);
        });

        it('should return 400 when email format is invalid', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'invalid-email',
                    password: 'password123'
                });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('should login successfully and return tokens', async () => {
            const bcrypt = require('bcrypt');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');

            const crypto = require('crypto');
            jest.spyOn(crypto, 'generateKeyPairSync').mockReturnValue({
                publicKey: 'mock-public-key',
                privateKey: 'mock-private-key'
            });

            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'sign')
                .mockReturnValueOnce('mock-access-token')
                .mockReturnValueOnce('mock-refresh-token');

            mockDb.getUserByEmail.mockResolvedValue(testUser);
            mockDb.createKeyPair.mockResolvedValue({ id: 1 });
            mockDb.createRefreshToken.mockResolvedValue({ id: 1 });
            mockDb.deleteRefreshTokenByUserId.mockResolvedValue();
            mockDb.deleteKeyPairByUserId.mockResolvedValue();

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Login successfully');
            expect(response.body.metadata.accessToken).toBeDefined();
            expect(response.body.metadata.refreshToken).toBeDefined();
            expect(response.body.metadata.user.email).toBe('test@example.com');

            // Store tokens for other tests
            accessToken = response.body.metadata.accessToken;
            refreshToken = response.body.metadata.refreshToken;
        });

        it('should return 400 when user does not exist', async () => {
            mockDb.getUserByEmail.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(400);
        });

        it('should return 400 when password is incorrect', async () => {
            const bcrypt = require('bcrypt');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

            mockDb.getUserByEmail.mockResolvedValue(testUser);
            mockDb.deleteRefreshTokenByUserId.mockResolvedValue();
            mockDb.deleteKeyPairByUserId.mockResolvedValue();

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(400);
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    password: 'password123'
                });

            expect(response.status).toBe(400);
        });

        it('should return 400 when password is missing', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com'
                });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/v1/auth/refreshToken', () => {
        beforeEach(async () => {
            // Setup for refresh token tests
            const bcrypt = require('bcrypt');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');

            const crypto = require('crypto');
            jest.spyOn(crypto, 'generateKeyPairSync').mockReturnValue({
                publicKey: 'mock-public-key',
                privateKey: 'mock-private-key'
            });

            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'sign')
                .mockReturnValueOnce('mock-access-token')
                .mockReturnValueOnce('mock-refresh-token');

            mockDb.getUserByEmail.mockResolvedValue(testUser);
            mockDb.createKeyPair.mockResolvedValue({ id: 1 });
            mockDb.createRefreshToken.mockResolvedValue({ id: 1 });

            // Login to get tokens
            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            accessToken = loginResponse.body.metadata.accessToken;
            refreshToken = loginResponse.body.metadata.refreshToken;
        });

        it('should refresh access token successfully', async () => {
            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 1, email: 'test@example.com' });
            jest.spyOn(jwt, 'sign').mockReturnValue('new-access-token');

            mockDb.getRefreshTokenByToken.mockResolvedValue(testRefreshToken);
            mockDb.getKeyPairByUserId.mockResolvedValue(testKeyPair);

            const response = await request(app)
                .post('/api/v1/auth/refreshToken')
                .send({
                    refreshToken: refreshToken
                });

            expect(response.status).toBe(201);
            expect(response.body.message).toBe('New access token created');
            expect(response.body.metadata.accessToken).toBeDefined();
        });

        it('should return 400 when refresh token is missing', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refreshToken')
                .send({});

            expect(response.status).toBe(400);
        });

        it('should return 400 when refresh token is invalid', async () => {
            mockDb.getRefreshTokenByToken.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/v1/auth/refreshToken')
                .send({
                    refreshToken: 'invalid-refresh-token'
                });

            expect(response.status).toBe(400);
        });

        it('should return 400 when refresh token has expired', async () => {
            const expiredToken = {
                ...testRefreshToken,
                expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000)
            };
            mockDb.getRefreshTokenByToken.mockResolvedValue(expiredToken);

            const response = await request(app)
                .post('/api/v1/auth/refreshToken')
                .send({
                    refreshToken: refreshToken
                });

            expect(response.status).toBe(400);
        });

        it('should return 400 when key pair not found', async () => {
            mockDb.getRefreshTokenByToken.mockResolvedValue(testRefreshToken);
            mockDb.getKeyPairByUserId.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/v1/auth/refreshToken')
                .send({
                    refreshToken: refreshToken
                });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        beforeEach(async () => {
            // Setup for logout tests
            const bcrypt = require('bcrypt');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');

            const crypto = require('crypto');
            jest.spyOn(crypto, 'generateKeyPairSync').mockReturnValue({
                publicKey: 'mock-public-key',
                privateKey: 'mock-private-key'
            });

            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'sign')
                .mockReturnValueOnce('mock-access-token')
                .mockReturnValueOnce('mock-refresh-token');

            mockDb.getUserByEmail.mockResolvedValue(testUser);
            mockDb.createKeyPair.mockResolvedValue({ id: 1 });
            mockDb.createRefreshToken.mockResolvedValue({ id: 1 });

            // Login to get tokens
            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            accessToken = loginResponse.body.metadata.accessToken;
            console.log(accessToken) // ra mock-access-token
        });

        it('should logout successfully', async () => {
            // Create a proper mock JWT token that can be decoded
            const jwt = require('jsonwebtoken');
            const mockDecodedToken = { userId: 1, email: 'test@example.com' };
            
            // Mock jwt.decode to return a valid decoded token
            jest.spyOn(jwt, 'decode').mockReturnValue(mockDecodedToken);
            
            // Mock the database call for keyPair
            mockDb.getKeyPairByUserId.mockResolvedValue({
                user_id: 1,
                public_key: 'mock-public-key',
                private_key: 'mock-private-key',
                is_active: 1
            });
            
            // Mock jwt.verify to return the verified token
            jest.spyOn(jwt, 'verify').mockReturnValue(mockDecodedToken);

            mockDb.deleteRefreshTokenByUserId.mockResolvedValue();
            mockDb.deleteKeyPairByUserId.mockResolvedValue();

            const response = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Logout successfully');
            expect(response.body.metadata).toBe('OK');
        });

        it('should return 401 when no authorization header', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout');

            expect(response.status).toBe(401);
        });
    });

    describe('Error handling', () => {
        it('should handle database connection errors gracefully', async () => {
            mockDb.getUserByEmail.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(500);
        });

        it('should handle JWT verification errors', async () => {
            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'verify').mockImplementation(() => {
                throw new jwt.JsonWebTokenError('jwt malformed');
            });

            mockDb.getRefreshTokenByToken.mockResolvedValue(testRefreshToken);
            mockDb.getKeyPairByUserId.mockResolvedValue(testKeyPair);

            const response = await request(app)
                .post('/api/v1/auth/refreshToken')
                .send({
                    refreshToken: 'malformed.jwt.token'
                });

            expect(response.status).toBe(500);
        });

        it('should not expose sensitive information in error responses', async () => {
            mockDb.getUserByEmail.mockRejectedValue(new Error('Database error with sensitive info'));

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(500);
            expect(response.body.message).toBe('Internal server error');
            expect(response.body).not.toHaveProperty('stack');
            expect(response.body).not.toHaveProperty('details');
        });

        it('should validate input data properly', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'invalid-email-format',
                    password: '123' // too short
                });

            expect(response.status).toBe(400);
        });
    });

    describe('Security tests', () => {
        it('should not expose sensitive information in error responses', async () => {
            mockDb.getUserByEmail.mockRejectedValue(new Error('Database error with sensitive info'));

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(500);
            expect(response.body.message).toBe('Internal server error');
            expect(response.body).not.toHaveProperty('stack');
            expect(response.body).not.toHaveProperty('details');
        });

        it('should validate input data properly', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'invalid-email-format',
                    password: '123' // too short
                });

            expect(response.status).toBe(400);
        });
    });
}); 