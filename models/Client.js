// File: models/Client.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schema definition for storing client information
 * @typedef {Object} ClientSchema
 * @property {string} name - The client's full name (required, trimmed)
 * @property {string} email - The client's email address (required, lowercase, trimmed)
 * @property {ObjectId|null} company - Reference to Company model (optional)
 * @property {ObjectId} createdBy - Reference to User who created this client (required)
 * @property {boolean} archived - Soft delete flag (default: false)
 * @property {Date} createdAt - Timestamp when document was created (auto-generated)
 * @property {Date} updatedAt - Timestamp when document was last updated (auto-generated)
 */
const ClientSchema = new Schema({
   // Basic fields for client
  name:{
      type: String,
      required: true,
      trim: true
   },
  email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
   },
  company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: false
   },

  createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', required: true
   },
   archived: {
      type: Boolean,
      default: false
   }
}, { timestamps: true });

// Unique index to prevent duplicate emails
ClientSchema.index({ createdBy: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Client', ClientSchema);
