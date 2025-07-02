// File: models/User.js
const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');

/**
 * User schema definition for managing user accounts and authentication
 * @typedef {Object} UserSchema
 * @property {string} email - User's email address (required, unique, lowercase, trimmed)
 * @property {string} password - User's encrypted password (required, min 8 chars)
 * @property {string} firstName - User's first name (optional, trimmed)
 * @property {string} lastName - User's last name (optional, trimmed)
 * @property {string} nif - User's National Identification Number (optional, trimmed)
 * @property {Object} company - Company information object
 * @property {Object} logo - Company logo information object
 * @property {boolean} isEmailVerified - Email verification status (default: false)
 * @property {string} verificationCode - Email verification code (optional)
 * @property {number} verificationAttempts - Count of verification attempts (default: 0)
 * @property {number} maxVerificationAttempts - Maximum allowed verification attempts (default: 3)
 * @property {string} passwordResetCode - Password reset verification code (optional)
 * @property {Date} passwordResetExpires - Password reset code expiration date (optional)
 * @property {string} role - User role in the system (enum: user/admin/guest, default: user)
 * @property {Date} createdAt - Timestamp when document was created (auto-generated)
 * @property {Date} updatedAt - Timestamp when document was last updated (auto-generated)
 * @property {Date} deletedAt - Timestamp when document was soft deleted (mongoose-delete plugin)
 */
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
        required: false
    },
    verificationAttempts: {
        type: Number,
        default: 0
    },
    maxVerificationAttempts: {
        type: Number,
        default: 3
    },

    // Password reset fields
    passwordResetCode: {
      type: String,
      required: false
    },
    passwordResetExpires: {
      type: Date,
      required: false
    },

    // User role
    role: {
        type: String,
        enum: ['user', 'admin', 'guest'],
        default: 'user'
    },
}, { timestamps: true });

// Soft delete plugin
UserSchema.plugin(mongooseDelete, {
    deleteAt: true,
    overrideMethods: true
});

module.exports = mongoose.model('User', UserSchema);
