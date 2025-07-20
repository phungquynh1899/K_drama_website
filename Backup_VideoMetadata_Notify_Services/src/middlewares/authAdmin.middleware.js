`use strict`
const { ForbiddenError, UnauthenticatedError } = require("../response/error.response");
const BetterSqliteDatabase = require('../db/BetterSqliteDatabase');

const authAdmin = async (req, res, next) => {
    try {
        // Ensure user authentication is valid (should be called after authUser middleware)
        if (!req.user || !req.user.id) {
            throw new UnauthenticatedError('User not authenticated');
        }

        // Fetch the user from the database using BetterSqliteDatabase
        const db = BetterSqliteDatabase.getInstance();
        const user = await db.getUserById(req.user.id);
        
        if (!user) {
            throw new UnauthenticatedError('User not found in database');
        }

        // Check if the user is active
        if (!user.is_active) {
            throw new ForbiddenError('Account is deactivated');
        }

        // Check if the user has admin role
        if (user.role !== 'admin') {
            throw new ForbiddenError('Access denied: Admin privileges required');
        }

        // Add admin info to request object for use in subsequent middleware/controllers
        req.admin = {
            id: user.id,
            email: user.email,
            role: user.role,
            is_active: user.is_active
        };
    
        // Proceed to the next middleware
        next();
    } catch (error) {
        // Pass the error to the global error handler
        next(error);
    }
};

module.exports = authAdmin;