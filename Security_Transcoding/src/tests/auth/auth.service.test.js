const AuthService = require('../../services/auth/auth.service');
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { 
    ConflictError, 
    BadRequestError, 
    NotFoundError, 
    ForbiddenError 
} = require('../../response/error.response');

// Mock the database
jest.mock('../../db/BetterSqliteDatabase');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('crypto');

describe('AuthService', () => {
    let mockDb;
    let mockUser;
    let mockKeyPair;
    let mockRefreshToken;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        
        // Setup mock database instance
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

        // Setup mock data
        mockUser = {
            id: 1,
            email: 'test@example.com',
            password_hash: 'hashedPassword123',
            is_active: 1
        };

        mockKeyPair = {
            user_id: 1,
            public_key: 'mock-public-key',
            private_key: 'mock-private-key',
            is_active: 1
        };

        mockRefreshToken = {
            user_id: 1,
            refresh_token: 'mock-refresh-token',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        };
    });

    describe('register', () => {
        it('should successfully register a new user', async () => {
            // Arrange
            const userData = { email: 'newuser@example.com', password: 'password123' };
            const hashedPassword = 'hashedPassword123';
            const newUser = { id: 2, email: userData.email };

            mockDb.getUserByEmail.mockResolvedValue(null);
            mockDb.createUser.mockResolvedValue(newUser);

            // Mock bcrypt.hash
            bcrypt.hash.mockResolvedValue(hashedPassword);

            // Act
            const result = await AuthService.register(userData);

            // Assert
            expect(mockDb.getUserByEmail).toHaveBeenCalledWith(userData.email);
            expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
            expect(mockDb.createUser).toHaveBeenCalledWith({
                email: userData.email,
                password_hash: hashedPassword,
                is_active: 1
            });
            expect(result).toEqual({
                user: { id: newUser.id, email: newUser.email }
            });
        });

        it('should throw ConflictError when email already exists', async () => {
            // Arrange
            const userData = { email: 'existing@example.com', password: 'password123' };
            mockDb.getUserByEmail.mockResolvedValue(mockUser);

            // Act & Assert
            await expect(AuthService.register(userData)).rejects.toThrow(ConflictError);
            await expect(AuthService.register(userData)).rejects.toThrow('This email has been used, please try again');
            expect(mockDb.getUserByEmail).toHaveBeenCalledWith(userData.email);
            expect(mockDb.createUser).not.toHaveBeenCalled();
        });

        it('should handle database errors during registration', async () => {
            // Arrange
            const userData = { email: 'newuser@example.com', password: 'password123' };
            mockDb.getUserByEmail.mockRejectedValue(new Error('Database error'));

            // Act & Assert
            await expect(AuthService.register(userData)).rejects.toThrow('Database error');
        });
    });

    describe('login', () => {
        it('should successfully login a user and return tokens', async () => {
            // Arrange
            const loginData = { email: 'test@example.com', password: 'password123' };
            const mockPublicKey = 'mock-public-key';
            const mockPrivateKey = 'mock-private-key';
            const mockAccessToken = 'mock-access-token';
            const mockRefreshToken = 'mock-refresh-token';

            mockDb.getUserByEmail.mockResolvedValue(mockUser);
            mockDb.createKeyPair.mockResolvedValue({ id: 1 });
            mockDb.createRefreshToken.mockResolvedValue({ id: 1 });

            // Mock bcrypt.compare
            bcrypt.compare.mockResolvedValue(true);

            // Mock crypto.generateKeyPairSync
            crypto.generateKeyPairSync.mockReturnValue({
                publicKey: mockPublicKey,
                privateKey: mockPrivateKey
            });

            // Mock jwt.sign
            jwt.sign.mockReturnValueOnce(mockAccessToken).mockReturnValueOnce(mockRefreshToken);

            // Act
            const result = await AuthService.login(loginData);

            // Assert
            expect(mockDb.getUserByEmail).toHaveBeenCalledWith(loginData.email);
            expect(mockDb.deleteRefreshTokenByUserId).toHaveBeenCalledWith(mockUser.id);
            expect(mockDb.deleteKeyPairByUserId).toHaveBeenCalledWith(mockUser.id);
            expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.password_hash);
            expect(crypto.generateKeyPairSync).toHaveBeenCalledWith('rsa', {
                modulusLength: 4096,
                publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
            });
            expect(mockDb.createKeyPair).toHaveBeenCalledWith({
                user_id: mockUser.id,
                public_key: mockPublicKey,
                private_key: mockPrivateKey,
                is_active: 1
            });
            expect(jwt.sign).toHaveBeenCalledTimes(2);
            expect(result).toEqual({
                user: { id: mockUser.id, email: mockUser.email },
                accessToken: mockAccessToken,
                refreshToken: mockRefreshToken
            });
        });

        it('should throw BadRequestError when user does not exist', async () => {
            // Arrange
            const loginData = { email: 'nonexistent@example.com', password: 'password123' };
            mockDb.getUserByEmail.mockResolvedValue(null);

            // Act & Assert
            await expect(AuthService.login(loginData)).rejects.toThrow(BadRequestError);
            await expect(AuthService.login(loginData)).rejects.toThrow('Invalid credentials');
            expect(mockDb.getUserByEmail).toHaveBeenCalledWith(loginData.email);
        });

        it('should throw BadRequestError when password is incorrect', async () => {
            // Arrange
            const loginData = { email: 'test@example.com', password: 'wrongpassword' };
            mockDb.getUserByEmail.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(false);

            // Act & Assert
            await expect(AuthService.login(loginData)).rejects.toThrow(BadRequestError);
            await expect(AuthService.login(loginData)).rejects.toThrow('Invalid credentials');
            expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.password_hash);
        });

        it('should handle database errors during login', async () => {
            // Arrange
            const loginData = { email: 'test@example.com', password: 'password123' };
            mockDb.getUserByEmail.mockRejectedValue(new Error('Database error'));

            // Act & Assert
            await expect(AuthService.login(loginData)).rejects.toThrow('Database error');
        });
    });

    describe('logout', () => {
        it('should successfully logout a user', async () => {
            // Arrange
            const logoutData = { userId: 1 };
            mockDb.deleteRefreshTokenByUserId.mockResolvedValue();
            mockDb.deleteKeyPairByUserId.mockResolvedValue();

            // Act
            const result = await AuthService.logout(logoutData);

            // Assert
            expect(mockDb.deleteRefreshTokenByUserId).toHaveBeenCalledWith(logoutData.userId);
            expect(mockDb.deleteKeyPairByUserId).toHaveBeenCalledWith(logoutData.userId);
            expect(result).toBe('OK');
        });

        it('should handle database errors during logout', async () => {
            // Arrange
            const logoutData = { userId: 1 };
            mockDb.deleteRefreshTokenByUserId.mockRejectedValue(new Error('Database error'));

            // Act & Assert
            await expect(AuthService.logout(logoutData)).rejects.toThrow('Database error');
        });
    });

    describe('refreshAccessToken', () => {
        it('should successfully refresh access token with valid refresh token', async () => {
            // Arrange
            const refreshData = { refreshToken: 'valid-refresh-token' };
            const mockNewAccessToken = 'new-access-token';
            const mockDecodedToken = { userId: 1, email: 'test@example.com' };

            mockDb.getRefreshTokenByToken.mockResolvedValue(mockRefreshToken);
            mockDb.getKeyPairByUserId.mockResolvedValue(mockKeyPair);
            jwt.verify.mockReturnValue(mockDecodedToken);
            jwt.sign.mockReturnValue(mockNewAccessToken);

            // Act
            const result = await AuthService.refreshAccessToken(refreshData);

            // Assert
            expect(mockDb.getRefreshTokenByToken).toHaveBeenCalledWith(refreshData.refreshToken);
            expect(jwt.verify).toHaveBeenCalledWith(refreshData.refreshToken, mockKeyPair.public_key, { algorithms: ['RS256'] });
            expect(jwt.sign).toHaveBeenCalledWith(
                { userId: mockDecodedToken.userId, email: mockDecodedToken.email },
                mockKeyPair.private_key,
                { algorithm: 'RS256', expiresIn: '3d' }
            );
            expect(result).toEqual({ accessToken: mockNewAccessToken });
        });

        it('should throw BadRequestError when refresh token is not provided', async () => {
            // Arrange
            const refreshData = { refreshToken: null };

            // Act & Assert
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow(BadRequestError);
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow('Refresh token is required');
        });

        it('should throw BadRequestError when refresh token does not exist in database', async () => {
            // Arrange
            const refreshData = { refreshToken: 'invalid-refresh-token' };
            mockDb.getRefreshTokenByToken.mockResolvedValue(null);

            // Act & Assert
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow(BadRequestError);
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow('Invalid refresh token');
        });

        it('should throw BadRequestError when refresh token has expired', async () => {
            // Arrange
            const refreshData = { refreshToken: 'expired-refresh-token' };
            const expiredToken = {
                ...mockRefreshToken,
                expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
            };
            mockDb.getRefreshTokenByToken.mockResolvedValue(expiredToken);

            // Act & Assert
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow(BadRequestError);
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow('Refresh token has expired');
            expect(mockDb.deleteRefreshTokenByToken).toHaveBeenCalledWith(refreshData.refreshToken);
        });

        it('should throw BadRequestError when key pair not found for user', async () => {
            // Arrange
            const refreshData = { refreshToken: 'valid-refresh-token' };
            mockDb.getRefreshTokenByToken.mockResolvedValue(mockRefreshToken);
            mockDb.getKeyPairByUserId.mockResolvedValue(null);

            // Act & Assert
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow(BadRequestError);
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow('Key pair not found for this user');
        });

        it('should throw error when JWT verification fails', async () => {
            // Arrange
            const refreshData = { refreshToken: 'invalid-jwt-token' };
            mockDb.getRefreshTokenByToken.mockResolvedValue(mockRefreshToken);
            mockDb.getKeyPairByUserId.mockResolvedValue(mockKeyPair);
            jwt.verify.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            // Act & Assert
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow('Invalid token');
        });

        it('should handle database errors during token refresh', async () => {
            // Arrange
            const refreshData = { refreshToken: 'valid-refresh-token' };
            mockDb.getRefreshTokenByToken.mockRejectedValue(new Error('Database error'));

            // Act & Assert
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow('Database error');
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle empty email in registration', async () => {
            // Arrange
            const userData = { email: '', password: 'password123' };
            mockDb.getUserByEmail.mockResolvedValue(null);

            // Act & Assert
            await expect(AuthService.register(userData)).rejects.toThrow();
        });

        it('should handle empty password in login', async () => {
            // Arrange
            const loginData = { email: 'test@example.com', password: '' };
            mockDb.getUserByEmail.mockResolvedValue(mockUser);

            // Act & Assert
            await expect(AuthService.login(loginData)).rejects.toThrow();
        });

        it('should handle malformed refresh token', async () => {
            // Arrange
            const refreshData = { refreshToken: 'malformed.token.here' };
            mockDb.getRefreshTokenByToken.mockResolvedValue(mockRefreshToken);
            mockDb.getKeyPairByUserId.mockResolvedValue(mockKeyPair);
            jwt.verify.mockImplementation(() => {
                throw new jwt.JsonWebTokenError('jwt malformed');
            });

            // Act & Assert
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow('jwt malformed');
        });

        it('should handle expired JWT token', async () => {
            // Arrange
            const refreshData = { refreshToken: 'expired.jwt.token' };
            mockDb.getRefreshTokenByToken.mockResolvedValue(mockRefreshToken);
            mockDb.getKeyPairByUserId.mockResolvedValue(mockKeyPair);
            jwt.verify.mockImplementation(() => {
                throw new jwt.TokenExpiredError('jwt expired');
            });

            // Act & Assert
            await expect(AuthService.refreshAccessToken(refreshData)).rejects.toThrow('jwt expired');
        });
    });
}); 