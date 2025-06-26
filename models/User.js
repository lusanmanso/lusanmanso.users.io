// models/User.js
const mongoose = require('mongoose');
const basePlugin = require('./plugins/basePlugin');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: String,
  lastName: String,
  nif: String,
  phone: String,
  status: {
    type: String,
    enum: ['pending', 'verified'],
    default: 'pending'
  },
  role: {
    type: String,
    enum: ['admin', 'guest'],
    default: 'admin'
  },
  verificationCode: String,
  verificationAttempts: {
    type: Number,
    default: 0
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  logoUrl: String
});

// No aplicamos basePlugin a User porque no necesita company/createdBy
userSchema.add({
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
