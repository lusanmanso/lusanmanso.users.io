// File: middleware/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { file } = require('googleapis/build/src/apis/file');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/logos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

moduleExports = upload;