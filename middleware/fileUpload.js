// File: middleware/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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