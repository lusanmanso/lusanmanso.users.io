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

    // Personal fields
    firstName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    nif: {
        type: String,
        trim: true
    },

    // Company data
    company: {
        name: {
            type: String,
            trim: true
        },
        cif: {
            type: String,
            trim: true
        },
        address: {
            street: {
                type: String,
                trim: true
            },
            city: {
                type: String,
                trim: true
            },
            postalCode: {
                type: String,
                trim: true
            },
            country: {
                type: String,
                trim: true,
                default: 'Spain'
            }
        },
        isAutonomous: {
            type: Boolean,
            default: false
        }
    },

    // Company logo
    logo: {
        url: {
            type: String,
            default: null,
        },
        filename: {
            type: String,
            default: null
        }
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