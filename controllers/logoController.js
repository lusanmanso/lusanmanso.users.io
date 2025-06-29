// File: controllers/logoController.js
const { config } = require('dotenv');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

/**
 * Upload company logo
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.uploadLogo = async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Not file uploaded' });
        }

        const userId = req.user.id;
        const file = req.file;

        // Generate URL for the uploaded file
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const relativePath = `/uploads/logos/${file.filename}`;
        const logoUrl = `${baseUrl}${relativePath}`;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            fs.unlinkSync(file.path);
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user already has a logo and delete the old file
        if (user.logo && user.logo.filename) {
            const oldFilePath = path.join(__dirname, '../uploads/logos', user.logo.filename);
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
            }
        }

        // Update user with new logo information
        user.logo = {
            url: logoUrl,
            filename: file.filename
        };

        await user.save();

        res.status(200).json({
            message: 'Logo uploaded successfully',
            logo: {
                url: logoUrl,
                filename: file.filename
            }
        });
    } catch (err) {
        console.error('Error uploading logo: ', err.message);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
