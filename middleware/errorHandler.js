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
    }
}