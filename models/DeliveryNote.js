// File: models/DeliveryNote.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Subdocument for delivery note items (hours or materials)
const DeliveryNoteItemSchema = new Schema({
  type: {
    type: String,
    enum: ['hours', 'material'],
    required: [true, 'Item type is required (hours or material)']
  },
  description: {
    type: String,
    required: [true, 'Item description is required'],
    trim: true,
    maxlength: [200, 'Item description cannot be more than 200 characters']
  },
  quantity: {
    type: Number,
    required: [true, 'Item quantity is required'],
    min: [0.01, 'Quantity must be positive'] // Adjust as needed (e.g., allow zero?)
  },
  unitPrice: { // Unit price/hourly rate (optional)
    type: Number,
    min: [0, 'Unit price cannot be negative'],
    default: null
  },
  person: { // Name of the person (relevant if type is 'hours')
    type: String,
    trim: true,
    maxlength: [100, 'Person name cannot be more than 100 characters'],
    default: null
  }
  // We don't include 'total' here - it can be calculated on demand or when generating the PDF
}, { _id: true }); // Give IDs to subdocuments

const DeliveryNoteSchema = new Schema({
  deliveryNoteNumber: { // Delivery note number (could be auto-generated)
    type: String,
    // required: true, // Optional: could generate this in the controller/service
    trim: true,
    // unique: true // ? should this be unique globally or per client/project
  },
  project: { // Project this delivery note belongs to
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required for the delivery note']
  },
  // We could get createdBy and client through project.populate,
  // but having createdBy here makes some queries/permissions easier.
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: { // Date of the delivery note
    type: Date,
    required: [true, 'Delivery note date is required'],
    default: Date.now
  },
  items: { // Array of items (hours/materials)
    type: [DeliveryNoteItemSchema], // Uses the subdocument defined above
    required: true,
    validate: [ // Ensures the array isn't empty
      { validator: (val) => val.length > 0, msg: 'Delivery note must have at least one item.' }
    ]
  },
  status: { // Status of the delivery note
    type: String,
    enum: ['draft', 'pending_signature', 'signed', 'invoiced', 'cancelled'],
    default: 'draft'
  },
  isSigned: {
    type: Boolean,
    default: false
  },
  signedAt: {
    type: Date,
    default: null
  },
  signatureUrl: { // URL of the signature image (in IPFS or other cloud storage)
    type: String,
    trim: true,
    default: null
  },
  pdfUrl: { // URL of the signed PDF (in cloud storage)
    type: String,
    trim: true,
    default: null
  },
  notes: { // Additional notes for the delivery note
      type: String,
      trim: true,
      maxLength: [500, 'Notes cannot exceed 500 characters'],
      default: null
  }
}, {
  timestamps: true // createdAt, updatedAt
});

// Middleware to ensure 'createdBy' is set correctly
// and to validate that the referenced project exists and belongs to the user
DeliveryNoteSchema.pre('validate', async function(next) {
  if (this.isNew) {
    // If createdBy isn't provided, we could try to get it from the project (requires previous populate)
    // But it's safer to ensure it comes from the controller based on req.user.id
    if (!this.createdBy) {
       return next(new Error('createdBy field is missing.'));
    }

    // Verify that the project exists and belongs to the user
    try {
        const Project = mongoose.model('Project');
        // Find the project by ID and verify that createdBy matches
        // and that the project isn't archived
        const projectExists = await Project.findOne({
            _id: this.project,
            createdBy: this.createdBy,
            archived: false // Can't create delivery notes for archived projects
        });

        if (!projectExists) {
            const error = new Error('Project not found, archived, or does not belong to the user.');
            error.statusCode = 404; // Not Found or 400 Bad Request
            error.type = 'validation';
            return next(error);
        }
    } catch (err) {
        // Catch search errors
        const error = new Error('Error validating project reference.');
        error.statusCode = 400;
        error.type = 'validation';
        return next(error);
    }
  }
  next();
});

// Add indexes if needed
DeliveryNoteSchema.index({ project: 1, date: -1 });
DeliveryNoteSchema.index({ createdBy: 1, date: -1 });

module.exports = mongoose.model('DeliveryNote', DeliveryNoteSchema);
