// File: middleware/auth.js
const jwt = require('jsonwebtoken');
const { ApiError } = require('./handleError');
const config = require('../config/config');
const User = require('../models/User');

/**
 * Middleware to verify JWT token and attach user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 * @throws {ApiError} When token is invalid, missing or user not found
 */
exports.auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');

    // Check if no token
    if (!authHeader) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Check if follows Bearer format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Invalid token format, must use Bearer' });
    }

    // Extract the token (remove 'Bearer' prefix)
    const token = authHeader.split(' ')[1];

    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwtSecret);

      // Verify if the user exists and is not deleted
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Add user to request object
      req.user = decoded;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token has expired' });
      } else {
        return res.status(401).json({ message: 'Invalid token' });
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware generator to check if user has required roles
 * @param {Array<string>} roles - Array of allowed roles
 * @returns {Function} Express middleware function
 * @throws {ApiError} When user doesn't have required role
 */
exports.checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Access denied', 'auth'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'No permissions for this action', 'auth'));
    }

    next();
  };
};
