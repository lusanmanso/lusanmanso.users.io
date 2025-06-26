// models/Client.js
const mongoose = require('mongoose');
const basePlugin = require('./plugins/basePlugin');

const clientSchema = new mongoose.Schema({
  name: {
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
  cif: String,
  phone: String,
  address: {
    street: String,
    city: String,
    postalCode: String,
    province: String,
    country: String
  }
});

clientSchema.plugin(basePlugin);
clientSchema.index({ createdBy: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Client', clientSchema);
