`use strict`
const axios = require('axios');
const { UnauthenticatedError} = require('../response/error.response');

const authUser = async (req, res, next) => {
    try {
        // Check for access token in the Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthenticatedError('Authentication invalid');
        }


        // Send validation request to Server A
        const validationResponse = await axios.post(
            process.env.AUTH_SERVER_HOST+'/validateUserForExtenalService',
            {}, // Empty body since we're forwarding the Authorization header
            {
                headers: {
                    'Authorization': authHeader, // Forward the complete Bearer token as-is
                    'x-api-key': process.env.UPLOAD_SHARE_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            }
        );

        // Check if Server A returned success
        if (validationResponse.status === 200) {
            next();
        } else {
            // Server A returned failure
            throw new UnauthenticatedError('User validation failed');
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        // Handle axios errors (network issues, timeouts, etc.)
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: 'Authentication service unavailable' });
        }
        if (error.code === 'ETIMEDOUT') {
            return res.status(408).json({ error: 'Authentication request timeout' });
        }
        
        // Handle Server A response errors
        if (error.response) {
            const status = error.response.status;
            const message = error.response.error || 'Authentication failed';
            
            if (status === 401) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
            if (status === 403) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (status === 404) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            return res.status(status).json({ error: message });
        }
        
        // Handle other errors
        if (error instanceof UnauthenticatedError) {
            return res.status(401).json({ error: error.message });
        }
        
        // Default error response
        return res.status(500).json({ error: 'Internal authentication error' });
    }
};

module.exports = authUser;