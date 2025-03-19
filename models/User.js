// File: models/User.js
const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');

const UserSchema = new mongoose.Schema({
    // Basic fields for registration
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 8
    },

    // Email verification fields
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    verificationCode: {
        type: String,
        required: true
    },
    verificationAttempts: {
        type: Number,
        default: 0
    },
    maxVerificationAttempts: {
        type: Number,
        default: 3
    },

    // User role
    role: {
        type: String,
        enum: ['user', 'admin', 'guest'],
        default: 'user'
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to update the modification date before saving
UserSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Soft delete plugin
UserSchema.plugin(mongooseDelete, {
    deleteAt: true,
    overrideMethods: true
});

module.exports = mongoose.model('User', UserSchema);