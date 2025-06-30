// File: models/DeliveryNote.js - CORRECTED VERSION
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schema for individual items within a delivery note (hours or materials).
 * @typedef {Object} DeliveryNoteItem
 * @property {string} description - Description of the item/work.
 * @property {number} quantity - Quantity or hours.
 * @property {number} [unitPrice] - Unit price (for materials/services). Optional.
 * @property {string} [person] - Person who performed the hours (for hours type). Optional.
 */
const DeliveryNoteItemSchema = new Schema({
   description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
   },
   quantity: {
      type: Number,
      required: [true, 'Item quantity/hours is required'],
      min: [0.01, 'Quantity must be positive'],
   },
   unitPrice: {
      type: Number,
      min: [0, 'Unit price cannot be negative'],
      default: 0,
   },
   person: {
      type: String,
      trim: true,
      default: null,
   },
}, { _id: true });

/**
 * Schema definition for Delivery Notes.
 * @typedef {Object} DeliveryNote
 * @property {string} deliveryNoteNumber - Unique identifier for the delivery note.
 * @property {Schema.Types.ObjectId} project - Reference to the Project this note belongs to.
 * @property {Schema.Types.ObjectId} createdBy - Reference to the User who created the note.
 * @property {Schema.Types.ObjectId} client - Reference to the Client associated with the project/note.
 * @property {Date} date - Date the delivery note was issued.
 * @property {Array<DeliveryNoteItem>} items - Array containing details of hours or materials.
 * @property {number} totalAmount - Total amount calculated from items.
 * @property {string} status - Status of the delivery note.
 * @property {boolean} isSigned - Flag indicating if the note has been signed.
 * @property {Date} [signedDate]
 * @property {string} [signerName] - Name of the person who signed.
 * @property {string} [signerTitle] - Title of the person who signed.
 * @property {string} [signatureUrl] - URL (potentially IPFS CID) of the signature image.
 * @property {string} [pdfUrl] - URL (potentially IPFS CID) of the generated PDF after signing.
 * @property {string} [notes] - Optional additional notes.
 */
const DeliveryNoteSchema = new Schema({
   deliveryNoteNumber: {
      type: String,
      required: true,
      trim: true,
   },
   project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required for the delivery note']
   },
   createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
   },
   client: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true
   },
   date: {
      type: Date,
      required: [true, 'Delivery note date is required'],
      default: Date.now
   },
   items: {
      type: [DeliveryNoteItemSchema],
      required: true,
      validate: [
         { validator: (val) => val.length > 0, msg: 'Delivery note must have at least one item.' }
      ]
   },
   totalAmount: {
      type: Number,
      default: 0,
      min: [0, 'Total amount cannot be negative']
   },
   status: {
      type: String,
      enum: ['draft', 'sent', 'signed'],
      default: 'draft'
   },
   isSigned: {
      type: Boolean,
      default: false
   },
   signedDate: {
      type: Date,
      default: null
   },
   signerName: {
      type: String,
      trim: true,
      default: null
   },
   signerTitle: {
      type: String,
      trim: true,
      default: null
   },
   signatureUrl: {
      type: String,
      trim: true,
      default: null
   },
   pdfUrl: {
      type: String,
      trim: true,
      default: null
   },
   notes: {
      type: String,
      trim: true,
      default: null
   }
}, {
   timestamps: true
});

// Index to potentially speed up lookups by user and project
DeliveryNoteSchema.index({ createdBy: 1, project: 1, date: -1 });
// Unique index for delivery note number per user
DeliveryNoteSchema.index({ createdBy: 1, deliveryNoteNumber: 1 }, { unique: true });

// Pre-save hook to automatically calculate totalAmount
DeliveryNoteSchema.pre('save', function(next) {
   if (this.items && this.items.length > 0) {
      this.totalAmount = this.items.reduce((total, item) => {
         return total + (item.quantity * (item.unitPrice || 0));
      }, 0);
   }
   next();
});

DeliveryNoteSchema.pre('validate', async function (next) {
   // Only validate project if it's new or project has been modified
   if (this.isNew || this.isModified('project')) {
      try {
         const Project = mongoose.model('Project');
         const projectDoc = await Project.findOne({
            _id: this.project,
            createdBy: this.createdBy,
            archived: false
         });

         if (!projectDoc) {
            const error = new Error('Project not found, archived, or does not belong to the user.');
            error.code = 'PROJECT_NOT_FOUND';
            return next(error);
         }

         // Automatically set the client based on the project
         this.client = projectDoc.client;
      } catch (err) {
         return next(err);
      }
   }
   next();
});

module.exports = mongoose.model('DeliveryNote', DeliveryNoteSchema);
