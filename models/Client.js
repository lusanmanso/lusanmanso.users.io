// File: models/Client.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
