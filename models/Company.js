// models/Company.js
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  cif: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    postalCode: String,
    province: String,
    country: String
  },
  phone: String,
  email: String,
  logoUrl: String
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
