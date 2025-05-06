// File: controllers/deliveryNoteController.js
const mongoose = require('mongoose');
const stream = require('stream');
const PDFDocument = require('pdfkit');
const FormData = require('form-data');

// Models
const DeliveryNote = require('../models/DeliveryNote');
const Project = require('../models/Project');
const Client = require('../models/Client');
const User = require('../models/User');

// Error Handling
const { ApiError } = require('../middleware/handleError');

// Environment variables for Pinata
const pinataApiKey = process.env.PINATA_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET;
const pinataGatewayUrl = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';

if (!pinataApiKey || !pinataSecretApiKey) {
   console.warn(
      "PINATA_KEY and/or PINATA_SECRET not configured in environment variables. " +
      "IPFS operations will be disabled."
   );
}

/**
 * Uploads a file buffer to Pinata IPFS using their HTTP API.
 * @async
 * @param {Buffer} fileBuffer - The buffer of the file to upload.
 * @param {string} fileName - The desired name for the file on Pinata.
 * @returns {Promise<string>} The IPFS CID (Content Identifier) of the uploaded file.
 * @throws {ApiError} If IPFS service is not configured or if the upload fails.
 */
const uploadToIPFS = async (fileBuffer, fileName) => {
   if (!pinataApiKey || !pinataSecretApiKey) {
      throw new ApiError(500, 'IPFS service (Pinata API Keys) is not configured.', 'IPFS_CONFIG_ERROR');
   }

   const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
   let data = new FormData();

   data.append('file', fileBuffer, fileName);

   const metadata = JSON.stringify({ name: fileName });
   data.append('pinataMetadata', metadata);

   const options = JSON.stringify({ cidVersion: 0 });
   data.append('pinataOptions', options);

   try {
      const response = await fetch(url, {
         method: 'POST',
         headers: {
            // 'Content-Type' is set automatically by fetch with FormData
            'pinata_api_key': pinataApiKey, // As per IPFS.pdf
            'pinata_secret_api_key': pinataSecretApiKey // As per IPFS.pdf
         },
         body: data
      });

      if (!response.ok) {
         const errorBody = await response.text();
         console.error('Pinata API Error Response:', `Status: ${response.status}, Body: ${errorBody}`);
         throw new Error(`Failed to upload to Pinata: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      if (!responseData.IpfsHash) {
         console.error('Pinata API successful response but missing IpfsHash:', responseData);
         throw new Error('IpfsHash not found in Pinata response.');
      }
      console.log(`Successfully pinned '${fileName}' to IPFS via API. CID: ${responseData.IpfsHash}`);
      return responseData.IpfsHash;

   } catch (error) {
      console.error(`Error uploading '${fileName}' to Pinata API:`, error.message, error.stack);
      throw new ApiError(500, `Failed to upload '${fileName}' to IPFS.`, 'IPFS_UPLOAD_ERROR', { detail: error.message });
   }
};

/**
 * Constructs the full public gateway URL for a given IPFS CID.
 * @param {string} cid - The IPFS Content Identifier.
 * @returns {string|null} The full gateway URL, or null if no CID is provided.
 */
const getIpfsUrl = (cid) => {
   if (!cid) return null;
   const gateway = pinataGatewayUrl.endsWith('/') ? pinataGatewayUrl : `${pinataGatewayUrl}/`;
   return `${gateway}ipfs/${cid}`;
};

/**
 * Generates a PDF buffer for a given delivery note.
 * The PDF includes details of the provider, client, project, items, and signature (if signed).
 * @async
 * @param {object} note - A populated Mongoose DeliveryNote document.
 * Must include createdBy, client, and project populated.
 * @returns {Promise<Buffer>} A promise that resolves with the PDF buffer.
 * @throws {ApiError} If PDF generation fails.
 */
const generatePdfBuffer = async (note) => {
   return new Promise((resolve, reject) => {
      try {
         const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
         const buffers = [];

         doc.on('data', buffers.push.bind(buffers));
         doc.on('end', () => resolve(Buffer.concat(buffers)));
         doc.on('error', (err) => {
            console.error("Error during PDF stream generation:", err);
            reject(new ApiError(500, 'PDF generation stream failed.', 'PDF_STREAM_ERROR', { detail: err.message }));
         });

         // --- PDF Content Structure ---
         doc.fontSize(18).text(`Delivery Note #${note.deliveryNoteNumber || 'N/A'}`, { align: 'center' });
         doc.fontSize(10).text(`Date: ${note.date ? new Date(note.date).toLocaleDateString('en-US') : 'N/A'}`, { align: 'right' });
         doc.moveDown(2);

         // Provider Info
         doc.fontSize(12).text('Provider:', { underline: true });
         if (note.createdBy) {
            const user = note.createdBy;
            doc.text(`${user.firstName || ''} ${user.lastName || ''} (${user.email || 'N/A'})`);
            if (user.company?.name) {
               doc.text(`Empresa: ${user.company.name} (CIF: ${user.company.cif || 'N/A'})`);
               if (user.company.address?.street) {
                  doc.text(
                     `Dirección: ${user.company.address.street}, ` +
                     `${user.company.address.city || ''} ` +
                     `${user.company.address.postalCode || ''}, ` +
                     `${user.company.address.country || ''}`
                  );
               }
            } else {
               doc.text(`NIF: ${user.nif || 'N/A'}`);
            }
         } else {
            doc.text('Provider data not available.');
         }
         doc.moveDown();

         // Client Info
         doc.fontSize(12).text('Client:', { underline: true });
         if (note.client) {
            const client = note.client;
            doc.text(`${client.name || 'N/A'} (${client.email || 'N/A'})`);
            // Assuming client model has 'cif' and 'address' directly as per schema discussion
            doc.text(`Tax ID: ${client.cif || 'N/A'}`);
            doc.text(`Address: ${client.address || 'N/A'}`);
         } else {
            doc.text('Datos del cliente no disponibles.');
         }
         doc.moveDown();

         // Project Info
         doc.fontSize(12).text('Project:', { underline: true });
         if (note.project) {
            doc.text(`${note.project.name || 'N/A'}`);
            if (note.project.description) doc.fontSize(10).text(`Description: ${note.project.description}`, { oblique: true });
         } else {
            doc.text('Datos del proyecto no disponibles.');
         }
         doc.moveDown();

         // Items Table
         doc.fontSize(12).text('Items:', { underline: true });
         doc.moveDown(0.5);
         const tableTop = doc.y;
         const itemX = 50;
         const personX = 180; // Adjusted for potentially longer descriptions
         const qtyX = 330;
         const priceX = 400;
         const totalItemX = 480;

         doc.fontSize(10);
         doc.text('Description', itemX, tableTop, { bold: true, width: 120, lineBreak: false });
         doc.text('Person', personX, tableTop, { bold: true, width: 140, lineBreak: false });
         doc.text('Quantity', qtyX, tableTop, { bold: true, width: 60, align: 'right', lineBreak: false });
         doc.text('Unit Price', priceX, tableTop, { bold: true, width: 70, align: 'right', lineBreak: false });
         doc.text('Total', totalItemX, tableTop, { bold: true, width: 70, align: 'right' });
         doc.moveDown(0.2);
         doc.moveTo(itemX, doc.y).lineTo(totalItemX + 70, doc.y).stroke();
         doc.moveDown(0.5);

         let grandTotal = 0;
         if (note.items && note.items.length > 0) {
            note.items.forEach(item => {
               const yPosition = doc.y;
               const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
               grandTotal += itemTotal;

               doc.text(item.description || '', itemX, yPosition, { width: 120, align: 'left' });
               let yAfterDesc = doc.y; // Current Y after description (might wrap)
               doc.text(item.person || '-', personX, yPosition, { width: 140, align: 'left' });
               let yAfterPerson = doc.y; // Current Y after person (might wrap)

               // Use the greater Y to ensure text doesn't overlap if one wraps more
               let lineY = Math.max(yAfterDesc, yAfterPerson);
               doc.y = yPosition; // Reset Y to draw numbers on the same initial line

               doc.text((item.quantity || 0).toString(), qtyX, yPosition, { width: 60, align: 'right' });
               doc.text(item.unitPrice != null ? `${item.unitPrice.toFixed(2)} €` : '-', priceX, yPosition, { width: 70, align: 'right' });
               doc.text(`${itemTotal.toFixed(2)} €`, totalItemX, yPosition, { width: 70, align: 'right' });

               doc.y = lineY; // Set Y to below the longest wrapped text for this item
               doc.moveDown(0.7);
            });
         }

         if (note.items && note.items.some(item => item.unitPrice != null)) {
            doc.moveTo(priceX - 10, doc.y).lineTo(totalItemX + 70, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(11).text('Grand Total:', priceX, doc.y, { bold: true, width: 70, align: 'right' });
            doc.text(`${grandTotal.toFixed(2)} €`, totalItemX, doc.y, { bold: true, width: 70, align: 'right' });
            doc.moveDown();
         }

         if (note.notes) {
            doc.moveDown();
            doc.fontSize(10).text('Additional Notes:', { underline: true });
            doc.text(note.notes, { align: 'left', width: 500 });
         }

         // Signature Area
         doc.moveDown(2);
         const signatureY = doc.y > 680 ? 50 : doc.y; // Try to avoid splitting signature across pages
         doc.y = signatureY; // Set Y position for signature block

         if (note.isSigned && note.signatureUrl) {
            doc.fontSize(11).text('Digitally Signed:', { underline: true });
            doc.fontSize(9).text(`Signing Date: ${note.signedAt ? new Date(note.signedAt).toLocaleString('en-US') : 'N/A'}`);
            const signatureDisplayUrl = getIpfsUrl(note.signatureUrl);
            if (signatureDisplayUrl) {
               doc.moveDown(0.5);
               doc.fillColor('blue')
                  .text('View Signature (IPFS Link)', { link: signatureDisplayUrl, underline: true })
                  .fillColor('black');
            } else {
               doc.fontSize(8).fillColor('red').text('(Signature link not available)');
            }
         } else {
            doc.fontSize(11).text('Pending Signature');
            // Placeholder for manual signature
            doc.moveDown(1);
            doc.lineCap('round')
               .moveTo(itemX, doc.y + 20)
               .lineTo(itemX + 200, doc.y + 20)
               .stroke();
            doc.fontSize(9).text('Client Signature', itemX, doc.y + 25);
         }
         // --- End PDF Content ---
         doc.end();

      } catch (error) {
         console.error("Error during PDF content generation:", error);
         reject(new ApiError(500, 'PDF content generation failed.', 'PDF_CONTENT_ERROR', { detail: error.message }));
      }
   });
};

/**
 * Creates a new delivery note.
 * It requires a deliveryNoteNumber, date, projectId, and an array of items.
 * The client associated with the project is automatically linked.
 * @async
 * @function createDeliveryNote
 * @param {import('express').Request} req - Express request object. Expected body: { deliveryNoteNumber, date, projectId, items, notes? }
 * @param {import('express').Response} res - Express response object.
 * @throws {ApiError} If creation fails due to validation, database error, or other issues.
 */
const createDeliveryNote = async (req, res) => {
   const session = await mongoose.startSession();
   session.startTransaction();
   try {
      const userId = req.user.id;
      const { deliveryNoteNumber, date, projectId, items, notes } = req.body;

      const newDeliveryNote = new DeliveryNote({
         deliveryNoteNumber,
         date,
         project: projectId,
         createdBy: userId,
         items,
         notes,
         isSigned: false,
      });

      await newDeliveryNote.save({ session }); // Pre-save hook in model links client
      await session.commitTransaction();

      const populatedNote = await DeliveryNote.findById(newDeliveryNote._id)
         .populate('createdBy', 'firstName lastName email')
         .populate('client', 'name email')
         .populate('project', 'name');

      res.status(201).json({
         message: 'Delivery note created successfully.',
         data: populatedNote,
      });

   } catch (error) {
      await session.abortTransaction();
      if (error.code === 11000) { // MongoDB duplicate key error
         throw new ApiError(409, 'Delivery note number already exists for this user.', 'DUPLICATE_DELIVERY_NOTE_NUMBER');
      }
      if (error.name === 'ValidationError' || error.message.includes('Project not found') || error.message.includes('Client does not exist')) {
         throw new ApiError(400, error.message, 'VALIDATION_ERROR');
      }
      console.error('Error creating delivery note:', error);
      throw new ApiError(500, 'Failed to create delivery note.', 'CREATE_NOTE_ERROR', { detail: error.message });
   } finally {
      session.endSession();
   }
};

/**
 * Retrieves all delivery notes for the logged-in user.
 * Notes are sorted by date in descending order.
 * Includes IPFS gateway URLs for signature and PDF if available.
 * @async
 * @function getAllDeliveryNotes
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 */
const getAllDeliveryNotes = async (req, res) => {
   const userId = req.user.id;
   const deliveryNotes = await DeliveryNote.find({ createdBy: userId })
      .populate('client', 'name')
      .populate('project', 'name')
      .sort({ date: -1 });

   const notesWithUrls = deliveryNotes.map(note => {
      const noteObj = note.toObject();
      return {
         ...noteObj,
         signatureGatewayUrl: getIpfsUrl(noteObj.signatureUrl),
         pdfGatewayUrl: getIpfsUrl(noteObj.pdfUrl),
      };
   });

   res.status(200).json({
      message: 'Delivery notes retrieved successfully.',
      count: notesWithUrls.length,
      data: notesWithUrls,
   });
};

/**
 * Retrieves a specific delivery note by its ID for the logged-in user.
 * Populates createdBy (user), client, and project details.
 * Includes IPFS gateway URLs for signature and PDF if available.
 * @async
 * @function getDeliveryNoteById
 * @param {import('express').Request} req - Express request object. Params: { id: string }
 * @param {import('express').Response} res - Express response object.
 * @throws {ApiError} If the note is not found or user lacks permission.
 */
const getDeliveryNoteById = async (req, res) => {
   const userId = req.user.id;
   const { id } = req.params;

   const deliveryNote = await DeliveryNote.findOne({ _id: id, createdBy: userId })
      .populate('createdBy', 'firstName lastName email company')
      .populate('client')
      .populate('project');

   if (!deliveryNote) {
      throw new ApiError(404, 'Delivery note not found or access denied.', 'NOTE_NOT_FOUND');
   }

   const noteObj = deliveryNote.toObject();
   const responseData = {
      ...noteObj,
      signatureGatewayUrl: getIpfsUrl(noteObj.signatureUrl),
      pdfGatewayUrl: getIpfsUrl(noteObj.pdfUrl),
   };

   res.status(200).json({
      message: 'Delivery note retrieved successfully.',
      data: responseData,
   });
};

/**
 * Updates an existing delivery note if it has not been signed.
 * Certain fields like signature status, URLs, and ownership cannot be changed directly.
 * @async
 * @function updateDeliveryNote
 * @param {import('express').Request} req - Express request object. Params: { id: string }. Body: fields to update.
 * @param {import('express').Response} res - Express response object.
 * @throws {ApiError} If note not found, update forbidden (signed), or DB error.
 */
const updateDeliveryNote = async (req, res) => {
   const userId = req.user.id;
   const { id } = req.params;
   const updateData = req.body;

   const deliveryNote = await DeliveryNote.findOne({ _id: id, createdBy: userId });

   if (!deliveryNote) {
      throw new ApiError(404, 'Delivery note not found or access denied.', 'NOTE_NOT_FOUND');
   }

   if (deliveryNote.isSigned) {
      throw new ApiError(403, 'Cannot update a signed delivery note.', 'UPDATE_SIGNED_FORBIDDEN');
   }

   // Sanitize updateData
   delete updateData.isSigned;
   delete updateData.signedAt;
   delete updateData.signatureUrl;
   delete updateData.pdfUrl;
   delete updateData.createdBy;
   delete updateData.client; // Client is derived via project

   Object.assign(deliveryNote, updateData);

   try {
      await deliveryNote.save(); // Triggers pre-save hook if project changed
   } catch (error) {
      if (error.code === 11000) {
         throw new ApiError(409, 'Delivery note number already exists for this user.', 'DUPLICATE_DELIVERY_NOTE_NUMBER');
      }
      if (error.name === 'ValidationError') {
         throw new ApiError(400, error.message, 'VALIDATION_ERROR');
      }
      console.error('Error updating delivery note:', error);
      throw new ApiError(500, 'Failed to update delivery note.', 'UPDATE_NOTE_ERROR', { detail: error.message });
   }


   const updatedPopulatedNote = await DeliveryNote.findById(id)
      .populate('createdBy', 'firstName lastName email')
      .populate('client', 'name email')
      .populate('project', 'name');

   res.status(200).json({
      message: 'Delivery note updated successfully.',
      data: updatedPopulatedNote,
   });
};

/**
 * Signs a delivery note.
 * This involves:
 * 1. Updating the note's status (isSigned, signatureUrl, signedAt).
 * 2. Generating a PDF version of the note.
 * 3. Uploading the generated PDF to IPFS (or cloud storage).
 * 4. Saving the PDF URL/CID to the delivery note.
 * @async
 * @function signDeliveryNote
 * @param {import('express').Request} req - Express request object. Params: { id: string }. Body: { signatureUrl: string, signedDate?: Date }
 * @param {import('express').Response} res - Express response object.
 * @throws {ApiError} If any step in the signing process fails.
 */
const signDeliveryNote = async (req, res) => {
   const session = await mongoose.startSession();
   session.startTransaction();
   try {
      const userId = req.user.id;
      const { id } = req.params;
      const { signatureUrl, signedDate } = req.body; // Expecting IPFS CID or cloud URL

      if (!signatureUrl) {
         throw new ApiError(400, 'Signature URL (e.g., IPFS CID) is required.', 'MISSING_SIGNATURE_URL');
      }

      const deliveryNote = await DeliveryNote.findOne({ _id: id, createdBy: userId })
         .populate('createdBy', 'firstName lastName email company')
         .populate('client')
         .populate('project')
         .session(session);

      if (!deliveryNote) {
         await session.abortTransaction(); session.endSession();
         throw new ApiError(404, 'Delivery note not found or access denied.', 'NOTE_NOT_FOUND');
      }

      if (deliveryNote.isSigned) {
         const noteObj = deliveryNote.toObject();
         const responseData = { ...noteObj, signatureGatewayUrl: getIpfsUrl(noteObj.signatureUrl), pdfGatewayUrl: getIpfsUrl(noteObj.pdfUrl) };
         await session.abortTransaction(); session.endSession();
         return res.status(200).json({ message: 'Delivery note is already signed.', data: responseData });
      }

      deliveryNote.isSigned = true;
      deliveryNote.signatureUrl = signatureUrl;
      deliveryNote.signedAt = signedDate ? new Date(signedDate) : new Date();

      const pdfBuffer = await generatePdfBuffer(deliveryNote);
      const pdfFileName = `Albaran_${deliveryNote.deliveryNoteNumber || 'DN'}_${Date.now()}.pdf`;
      const pdfCid = await uploadToIPFS(pdfBuffer, pdfFileName);
      deliveryNote.pdfUrl = pdfCid;

      const signedDeliveryNote = await deliveryNote.save({ session });
      await session.commitTransaction();

      const noteObj = signedDeliveryNote.toObject();
      const responseData = { ...noteObj, signatureGatewayUrl: getIpfsUrl(noteObj.signatureUrl), pdfGatewayUrl: getIpfsUrl(noteObj.pdfUrl) };

      res.status(200).json({
         message: 'Delivery note signed and PDF uploaded successfully.',
         data: responseData,
      });

   } catch (error) {
      await session.abortTransaction();
      console.error('Error signing delivery note:', error.message, error.stack);
      if (error instanceof ApiError) throw error; // Re-throw ApiErrors (like IPFS_CONFIG_ERROR)
      throw new ApiError(500, 'Failed to sign delivery note.', 'SIGN_NOTE_ERROR', { detail: error.message });
   } finally {
      session.endSession();
   }
};

/**
 * Downloads the PDF of a delivery note.
 * It first tries to redirect to a cloud/IPFS URL if available.
 * Permissions are checked: only the owner or a guest of the owner's company can download.
 * @async
 * @function downloadDeliveryNotePdf
 * @param {import('express').Request} req - Express request object. Params: { id: string }
 * @param {import('express').Response} res - Express response object.
 * @throws {ApiError} If note not found, PDF not available, or permission denied.
 */
const downloadDeliveryNotePdf = async (req, res) => {
   const requestorUserId = req.user.id;
   const { id } = req.params;

   const deliveryNote = await DeliveryNote.findById(id)
      .populate({ path: 'createdBy', select: 'companyId' }); // Only need companyId for creator

   if (!deliveryNote) {
      throw new ApiError(404, 'Delivery note not found.', 'NOTE_NOT_FOUND');
   }

   // Permission Check
   const isOwner = deliveryNote.createdBy._id.toString() === requestorUserId;
   let isGuestOfCompany = false;
   if (!isOwner && deliveryNote.createdBy.companyId) { // Check companyId only if not owner
      const requestorUser = await User.findById(requestorUserId).select('companyId');
      if (requestorUser && requestorUser.companyId) {
         isGuestOfCompany = requestorUser.companyId.toString() === deliveryNote.createdBy.companyId.toString();
      }
   }

   if (!isOwner && !isGuestOfCompany) {
      throw new ApiError(403, 'Access denied. You do not have permission to download this PDF.', 'PDF_DOWNLOAD_FORBIDDEN');
   }

   if (!deliveryNote.isSigned || !deliveryNote.pdfUrl) {
      throw new ApiError(404, 'PDF is not available. The delivery note may not be signed yet.', 'PDF_NOT_AVAILABLE');
   }

   const pdfGatewayUrl = getIpfsUrl(deliveryNote.pdfUrl);
   if (pdfGatewayUrl) {
      console.log(`Redirecting PDF download for note ${id} to IPFS: ${pdfGatewayUrl}`);
      res.setHeader('Content-Disposition', `attachment; filename="Albaran_${deliveryNote.deliveryNoteNumber || id}.pdf"`);
      return res.redirect(302, pdfGatewayUrl);
   } else {
      console.warn(`PDF URL (CID) for signed note ${id} is missing or invalid, attempting to generate on-the-fly.`);
      try {
         const populatedNoteForPdf = await DeliveryNote.findById(id)
            .populate('createdBy', 'firstName lastName email company')
            .populate('client')
            .populate('project');
         if (!populatedNoteForPdf) { // Should not happen if first findById worked
            throw new ApiError(404, 'Delivery note details for PDF generation not found.', 'NOTE_NOT_FOUND_FOR_PDF');
         }
         const pdfBuffer = await generatePdfBuffer(populatedNoteForPdf);
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', `attachment; filename="Albaran_${deliveryNote.deliveryNoteNumber || id}.pdf"`);
         return res.send(pdfBuffer);
      } catch (genError) {
         console.error("Error generating PDF on-the-fly for download:", genError);
         if (genError instanceof ApiError) throw genError;
         throw new ApiError(500, 'Failed to retrieve or generate PDF for download.', 'PDF_DOWNLOAD_GENERATION_ERROR');
      }
   }
};

/**
 * Deletes a delivery note, but only if it has not been signed.
 * @async
 * @function deleteDeliveryNote
 * @param {import('express').Request} req - Express request object. Params: { id: string }
 * @param {import('express').Response} res - Express response object.
 * @throws {ApiError} If note not found, delete forbidden (signed), or DB error.
 */
const deleteDeliveryNote = async (req, res) => {
   const userId = req.user.id;
   const { id } = req.params;

   const deliveryNote = await DeliveryNote.findOne({ _id: id, createdBy: userId });

   if (!deliveryNote) {
      throw new ApiError(404, 'Delivery note not found or access denied.', 'NOTE_NOT_FOUND');
   }

   if (deliveryNote.isSigned) {
      throw new ApiError(403, 'Cannot delete a signed delivery note.', 'DELETE_SIGNED_FORBIDDEN');
   }

   // Consider unpinning from IPFS if signatureUrl or pdfUrl exist for an unsigned note (though unlikely)
   // if (deliveryNote.signatureUrl && pinataApiKey && pinataSecretApiKey) { /* try await pinata.unpin(deliveryNote.signatureUrl) */ }
   // if (deliveryNote.pdfUrl && pinataApiKey && pinataSecretApiKey) { /* try await pinata.unpin(deliveryNote.pdfUrl) */ }

   await DeliveryNote.deleteOne({ _id: id, createdBy: userId });

   res.status(200).json({ message: 'Delivery note deleted successfully.' });
};

module.exports = {
   createDeliveryNote,
   getAllDeliveryNotes,
   getDeliveryNoteById,
   updateDeliveryNote,
   signDeliveryNote,
   downloadDeliveryNotePdf,
   deleteDeliveryNote,
};
