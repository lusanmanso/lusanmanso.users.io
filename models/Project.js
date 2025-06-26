const mongoose = require('mongoose');
const basePlugin = require('./plugins/basePlugin');

const ProjectSchema = new mongoose.Schema({
   name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxLength: [150, 'Project name cannot exceed 150 characters']
   },
   description: {
      type: String,
      default: null,
      trim: true,
      maxLength: [500, 'Project description cannot exceed 500 characters']
   },
   client: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client is required']
   },
   createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required']
   },
   archived: {
      type: Boolean,
      default: false,
   }
}, { timestamps: true });

projectSchema.plugin(basePlugin, {
  addTimestamps: true,
  addArchived: true,
  addCreatedBy: true,
  addCompany: true,
  autoAssignCompany: true
});

// Unique index to prevent duplicate projects for the same client and user
projectSchema.index({ name: 1, client: 1, createdBy: 1 }, { unique: true });
projectSchema.index({ status: 1, archived: 1 });

module.exports = mongoose.model('Project', ProjectSchema);
