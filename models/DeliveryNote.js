// models/DeliveryNote.js
const mongoose = require('mongoose');
const basePlugin = require('./plugins/basePlugin');

const deliveryNoteSchema = new mongoose.Schema({
  deliveryNoteNumber: {
    type: String,
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['hours', 'materials'],
    required: true
  },
  items: [{
    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  notes: String,
  signed: {
    type: Boolean,
    default: false
  },
  signatureUrl: String,
  pdfUrl: String,
  signedAt: Date
});

deliveryNoteSchema.plugin(basePlugin);

// Índice único para evitar números duplicados por usuario
deliveryNoteSchema.index({
  deliveryNoteNumber: 1,
  createdBy: 1
}, { unique: true });

// Pre-save hook para asignar cliente del proyecto
deliveryNoteSchema.pre('save', async function(next) {
  if (this.isNew && this.project) {
    try {
      const Project = mongoose.model('Project');
      const project = await Project.findById(this.project).populate('client');
      if (project && project.client) {
        this.client = project.client._id;
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('DeliveryNote', deliveryNoteSchema);
