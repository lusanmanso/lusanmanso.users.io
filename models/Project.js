// File: models/Project.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProjectSchema = new Schema({
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

// Unique index to prevent duplicate project names for the same client
ProjectSchema.index({ createdBy: 1, client: 1, name: 1 }, { unique: true,  message: 'Project name must be unique for this client and user.' });

// Validate if referenced client exists before saving
ProjectSchema.pre('save', async function(next) {
   if (this.isModified('client') || this.isNew) {
      try {
         const Client = mongoose.model('Client');
         const clientExists = await Client.findById(this.client);
         if (!clientExists) {
            const error = new Error('Client does not exist');
            error.status = 400;
            error.type = 'validation';
            return next(error);
         }
      } catch (err) { return next(err); }
   }
   next();
});

module.exports = mongoose.model('Project', ProjectSchema);
