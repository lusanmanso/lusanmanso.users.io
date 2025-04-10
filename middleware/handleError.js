// File: middleware/errorHandler.js
const multer = require('multer');
const config = require('../config/config');

/**
 * Custom class for API errors
 */
class ApiError extends Error {
   constructor(statusCode, message, type = 'general', data = {}) {
      super(message);
      this.statusCode = statusCode;
      this.type = type;
      this.data = data;
      this.isOperational = true;
   }
}

/**
 * Handle multer errors
 */
exports.handleMulterErrors = (err, req, res, next) => {
   if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
         return res.status(400).json({ message: 'File too large. Max size is 2MB' });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
   } else if (err) {
      next(err); // Send to global error handler instead
   }
   next(); // No error occurred, continue
};

/**
 * Handle global API errors
 */
exports.handleApiErrors = (err, req, res, next) => {
   // If is a known operational error
   if (err.isOperational) {
      return res.status(err.statusCode).json({
         success: false,
         message: err.message,
         type: err.type,
         ...(err.data && Object.keys(err.data).length && { data: err.data }),
         ...(config.environment === 'development' && { stack: err.stack })
      });
   }

    // Non operational errors
   console.error('ERROR NOT CONTROLLED', err);

   // Do not expose details in production
   const message = config.environment === 'production'
      ? 'An internal server error occurred'
      : err.message;

   res.status(500).json({
      success: false,
      message,
      type: 'internal_server',
      ...(config.environment === 'developmen' && { stack: err.stack })
   });
};

// Middleware to catch async errors
exports.asyncHandler = (fn) => (req, res, next) => {
   Promise.resolve(fn(req, res, next)).catch(next);
};

exports.ApiError = ApiError;
