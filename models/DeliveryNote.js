// File: models/DeliveryNote.js
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
      min: [0.01, 'Quantity must be positive'], // Allows for fractional hours/quantities if needed
   },
   unitPrice: { // Optional: Primarily for materials/services, could be hourly rate
      type: Number,
      min: [0, 'Unit price cannot be negative'],
      default: null,
   },
   person: { // Optional: Relevant for 'hours' type items
      type: String,
      trim: true,
      default: null,
   },
   // Consider adding 'type' ('hours'/'material') if needed, though the PDF implies it can contain both mixed or just one type.
   // The current structure allows flexibility.
}, { _id: true }); // Enable IDs for subdocuments if needed later

/**
 * Schema definition for Delivery Notes.
 * @typedef {Object} DeliveryNote
 * @property {string} deliveryNoteNumber - Unique identifier for the delivery note (likely unique per user/project).
 * @property {Schema.Types.ObjectId} project - Reference to the Project this note belongs to.
 * @property {Schema.Types.ObjectId} createdBy - Reference to the User who created the note.
 * @property {Schema.Types.ObjectId} client - Reference to the Client associated with the project/note. Added for easier PDF generation and querying.
 * @property {Date} date - Date the delivery note was issued.
 * @property {Array<DeliveryNoteItem>} items - Array containing details of hours or materials. Can be simple (one entry) or multiple[cite: 6].
 * @property {boolean} isSigned - Flag indicating if the note has been signed.
 * @property {Date} [signedAt] - Timestamp when the note was signed.
 * @property {string} [signatureUrl] - URL (potentially IPFS CID) of the signature image[cite: 8].
 * @property {string} [pdfUrl] - URL (potentially IPFS CID) of the generated PDF after signing[cite: 8].
 * @property {string} [notes] - Optional additional notes.
 */
const DeliveryNoteSchema = new Schema({
   deliveryNoteNumber: { // Consider if this should be auto-generated or user-provided
      type: String,
      required: true,
      trim: true,
   },
   project: {
      type: Schema.Types.ObjectId,
      ref: 'Project', // Reference to the Project model
      required: [true, 'Project is required for the delivery note']
   },
   createdBy: { // Store the creator for permission checks
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
   },
   client: { // Added for convenience, derived from project initially but stored
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true
   },
   date: {
      type: Date,
      required: [true, 'Delivery note date is required'],
      default: Date.now
   },
   items: { // Array for hours and/or materials [cite: 6]
      type: [DeliveryNoteItemSchema],
      required: true,
      validate: [
         { validator: (val) => val.length > 0, msg: 'Delivery note must have at least one item.' }
      ]
   },
   isSigned: {
      type: Boolean,
      default: false
   },
   signedAt: { // Timestamp of signing
      type: Date,
      default: null
   },
   signatureUrl: { // IPFS CID or other cloud URL for the signature image [cite: 8]
      type: String,
      trim: true,
      default: null
   },
   pdfUrl: { // IPFS CID or other cloud URL for the signed PDF [cite: 8]
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
   timestamps: true // Adds createdAt and updatedAt automatically
});

// Index to potentially speed up lookups by user and project
DeliveryNoteSchema.index({ createdBy: 1, project: 1, date: -1 });
// Unique index for delivery note number per user (adjust if uniqueness scope is different)
DeliveryNoteSchema.index({ createdBy: 1, deliveryNoteNumber: 1 }, { unique: true });

// Pre-save hook to ensure the client is associated with the project's creator
DeliveryNoteSchema.pre('validate', async function (next) {
   if (this.isNew || this.isModified('project')) {
      try {
         const Project = mongoose.model('Project');
         // Fetch the project to get the client and verify ownership
         const projectDoc = await Project.findOne({ _id: this.project, createdBy: this.createdBy, archived: false });
         if (!projectDoc) {
            return next(new Error('Project not found, archived, or does not belong to the user.'));
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
