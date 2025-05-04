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
      throw new ApiError(401, 'Acceso denegado: token no proporcionado', 'auth');
    }

    // Check if follows Bearer format
    if (!authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Formato de token inválido, debe usar Bearer', 'auth');
    }

    // Extract the token (remove 'Bearer' prefix)
    const token = authHeader.split(' ')[1];

    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwtSecret);

      // Verificar si el usuario existe y no está eliminado
      const user = await User.findById(decoded.user.id);
      if (!user) {
        throw new ApiError(401, 'Usuario no encontrado o eliminado', 'auth');
      }

      // Add user to request object
      req.user = decoded.user;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new ApiError(401, 'El token ha expirado', 'auth');
      } else {
        throw new ApiError(401, 'Token inválido', 'auth');
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
      return next(new ApiError(401, 'Acceso denegado', 'auth'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'No tiene permisos para esta acción', 'auth'));
    }

    next();
  };
};
