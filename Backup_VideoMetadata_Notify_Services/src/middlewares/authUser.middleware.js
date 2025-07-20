`use strict`
const jwt = require('jsonwebtoken');
const { UnauthenticatedError, UnauthorizeError, InternalServerError, BadRequestError } = require('../response/error.response');
const BetterSqliteDatabase = require('../db/BetterSqliteDatabase');

const authUser = async (req, res, next) => {
    try {
        // Check for access token in the Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthenticatedError('Authentication invalid');
        }

        const accessToken = authHeader.split(' ')[1];
        // Decode token to get userId
        const decoded = jwt.decode(accessToken);
        if (!decoded || !decoded.userId) {
            throw new BadRequestError('Invalid token format')
        }
        // Fetch public key from DB
        const db = BetterSqliteDatabase.getInstance();
        const keyPair = await db.getKeyPairByUserId(decoded.userId);
        if (!keyPair) {
            throw new BadRequestError('Public key not found')
        }
        // Verify token, if token is not valid, jwt would throw an error 
        const verified = jwt.verify(accessToken, keyPair.public_key, { algorithms: ['RS256'] });

        req.user = {
            id: verified.userId,
            email: verified.email,
            role: verified.role || 'user'
        };
        console.log("user id " + req.user.id)
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired, please refresh' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Invalid token signature' });
        }
        if (error instanceof jwt.NotBeforeError) {
            return res.status(401).json({ error: 'Token not active yet' });
        }
        throw new UnauthenticatedError(error.message)
    }
};

module.exports = authUser;
//access token hết hạn sử dụng thì hướng dẫn frontend gửi refresh token lại