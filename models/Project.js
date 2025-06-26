// models/Project.js
const mongoose = require('mongoose');
const basePlugin = require('./plugins/basePlugin');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  }
});


projectSchema.plugin(basePlugin, {
  addTimestamps: true,
  addArchived: true,
  addCreatedBy: true,
  addCompany: true,
  autoAssignCompany: true
});


projectSchema.index({ name: 1, client: 1, createdBy: 1 }, { unique: true });

module.exports = mongoose.model('Project', projectSchema);
