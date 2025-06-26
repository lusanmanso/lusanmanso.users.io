const mongoose = require('mongoose');

/**
 * Base plugin for Mongoose models.
 * Provides common functionality for every model
 */

function basePlugin(schema, options) {
   const defaults = {
      addTimestamps: true,
      addArchived: true,
      addCreatedBy: true,
      addCompany: true,
      autoAssingCompany: true
   };

   const config = { ...defaults, ...options };

   // Common fields
   if (config.addTimestamps) {
      schema.add({
         createdAt: {
            type: Date,
            default: Date.now,
            inmutable: true
         },
         updatedAt: {
            type: Date,
            default: Date.now
         }
      });
   }

   if (config.addArchived) {
      schema.add({
         archived: {
            type: Boolean,
            default: false,
            index: true // Faster queries on archived
         },
         archivedAt: {
            type: Date,
            default: null
         }
      });
   }

   if (config.addCreatedBy) { // Reference to the user who created the document
      schema.add({
         createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Reference to the User model
            required: true,
            index: true
         }
      });
   }

   if (config.addCompany) {
      schema.add({
         company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company', // Reference to the Company model
            required: true,
            index: true
         }
      });
   }

   // Instance methods
   /**
    * Archives the document (soft-delete)
    * @param {Object} userId - Id of the user that archieves the document
    * @return {Promise<Document>}
    */
   schema.methods.softDelete = function (userId) {
      this.archived = true;
      this.archivedAt = new Date();
      if (userId) {
         this.archivedBy = userId;
      }
      return this.save();
   };

   /**
    * Restore an archived document
    * @param {Object} userId - Id of the user that restores the document
    * returns {Promise<Document>}
    */
   schema.methods.restore = function (userId) {
      this.archived = false;
      this.archivedAt = null;
      if (this.archivedBy) {
         this.archivedBy = undefined;
      }
      if (userId) {
         this.restoredBy = userId;
         this.restoredAt = new Date();
      }
      return this.save();
   };

   /**
    * Verify if the document belongs to the user
    * @param {Object|String} userId - Id of the user to verify
    * @returns {Boolean}
    */
   schema.methods.belongsToUser = function (userId) {
      return this.createdBy.toString === userId.toString();
   };

   /**
    * Verify if the document belongs to the company
    * @param {Object|String} companyId - Id of the company to verify
    * @return {Boolean}
    */
   schema.methods.belongsToCompany = function (companyId) {
      return this.company.toString() === companyId.toString();
   }

   /**
    * Verify if the document is active (not archived)
    * @return {Boolean}
    */
   schema.methods.isActive = function () {
      return !this.archived;
   };

   /**
    * Verify if the document is archived
    */
   schema.methods.isArchived = function () {
      return this.archived;
   };

   // Query helpers
   /**
    * Query helper to filter active documents (not archived)
    */
   schema.query.active = function () {
      return this.where({ archived: false });
   };

   /**
   * Query helper to filter archived documents
   */
   schema.query.archived = function () {
      return this.where({ archived: true });
   };


   /**
   * Query helper to filter by user
   * @param {ObjectId|String} userId - Id of the user
   */
   schema.query.byUser = function (userId) {
      return this.where({ createdBy: userId });
   };

   /**
   * Query helper to filter by company
   * @param {ObjectId|String} companyId - ID of the company
   */
   schema.query.byCompany = function (companyId) {
      return this.where({ company: companyId });
   };

   /**
   * Query helper to get recently created documents
   * @param {Number} days - Number of days to filter by (default: 7)
   */
   schema.query.recent = function (days = 7) {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return this.where({ createdAt: { $gte: date } });
   };

   // Middleware hooks
   // Pre-save hook to update updatedAt field
   if (config.addTimestamps) {
      schema.pre('save', function (next) {
         if (this.isModified() && !this.isNew) {
            this.updatedAt = new Date();
         }
         next();
      });
   }

   // Hook for auto-assigning company based in createdBy
   if (config.autoAssignCompany && config.addCreatedBy && config.addCompany) {
      schema.pre('save', async function (next) {
         try {
            // Only run on new docs
            if (this.isNew && this.createdBy && !this.company) {
               const User = mongoose.model('User');
               const user = await User.findById(this.createdBy).select('company');

               if (user && user.company) {
                  this.company = user.company;
               }
            }
            next();
         } catch (error) {
            next(error);
         }
      });
   }

   // Hook for additional validation
   schema.pre('save', function (next) {
      // Validate that archived y archivedAt are consistent
      if (this.archived && !this.archivedAt) {
         this.archivedAt = new Date();
      } else if (!this.archived && this.archivedAt) {
         this.archivedAt = null;
      }
      next();
   });

   // Hook for update operations
   schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function (next) {
      if (config.addTimestamps) {
         this.set({ updatedAt: new Date() });
      }
      next();
   });

   // Static methods
   /**
    * Find active documents with pagination
    * @param {Object} filter - Additional filters
    * @param {Object} options - Pagination options
    */
   schema.statics.findActive = function (filter = {}, options = {}) {
      const {
         page = 1,
         limit = 10,
         sort = { createdAt: -1 },
         populate = null
      } = options;

      const skip = (page - 1) * limit;

      let query = this.find({ ...filter, archived: { $ne: true } })
         .sort(sort)
         .skip(skip)
         .limit(limit);

      if (populate) {
         query = query.populate(populate);
      }

      return query;
   };

   /**
    * Count active documents
    * @param {Object} filter - Additional filters
    */
   schema.statics.countActive = function (filter = {}) {
      return this.countDocuments({ ...filter, archived: { $ne: true } });
   };

   /**
    * Archive multiple documents
    * @param {Object} filter - Filter to select documents to archive
    * @param {ObjectId} userId - ID of the user that archives
    */
   schema.statics.archiveMany = function (filter, userId) {
      const updateData = {
         archived: true,
         archivedAt: new Date()
      };

      if (userId) {
         updateData.archivedBy = userId;
      }

      return this.updateMany(filter, updateData);
   };

   // Compound index
   if (config.addCompany && config.addArchived) {
      schema.index({ company: 1, archived: 1, createdAt: -1 });
   }

   if (config.addCreatedBy && config.addArchived) {
      schema.index({ createdBy: 1, archived: 1, createdAt: -1 });
   }
}

module.exports = basePlugin;
