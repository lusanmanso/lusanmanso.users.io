// File: middleware/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { ApiError } = require('./handleError');
const config = require('../config/config');

// Ensure upload directory exists
const ensureUploadDir = async () => {
   try {
     await fs.access(config.storage.localPath);
   } catch (error) {
     // Directory does not exist: create
     await fs.mkdir(config.storage.localPath, { recursive: true });
   }
 };

 // Initialize directory
 ensureUploadDir().catch(err => console.error('Error creating uploads directory: ', err));

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Require a unique filename with user ID and timestamp
    const userId = req.user.id;
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `logo_${userId}_${timestamp}${extension}`);
  }
});

// File filter that allows only image
const fileFilter = (req, file, cb) => {
   // Allowed MIME types of images
   const allowedMimesTypes = ['image(jpeg']
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload an image.', false));
    }
};

// Upload limits
const limits = {
    fileSize: 1024 * 1024 * 2 // 2MB
};

//Create multer instance with configuration
const upload = multer({
    storage,
    fileFilter,
    limits
});

module.exports = upload;
