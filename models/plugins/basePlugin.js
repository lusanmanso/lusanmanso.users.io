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



   }
