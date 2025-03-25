// File: middleware/errorHandler.js
const multer = require('multer');

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
        // Unknown error occurred
        return res.status(500).json({ message: err.message });
    }
    next(); // No error occurred, continue
};

/**
 * Handle general API errors
 */
exports.handleApiErrors = (err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
};