// File: controllers/deliveryNoteController.js
const DeliveryNote = require('../models/DeliveryNote');
const Project = require('../models/Project'); // Needed for populate
const Client = require('../models/Client'); // Needed for populate
const User = require('../models/User'); // Needed for populate
const { ApiError } = require('../middleware/handleError'); // Assuming ApiError exists
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit'); // Required for PDF generation
const stream = require('stream'); // Needed for buffer-to-stream conversion

// IPFS/Cloud Storage Setup
const PinataClient = require('pinata');

const pinataKey = process.env.PINATA_KEY;
const pinataSecretKey = process.env.PINATA_SECRET;
const pinataGatewayUrl = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';

let pinata;
if (pinataKey && pinataSecretKey) {
   try {
      // Initialize the Pinata client using the constructor
      // The constructor might take an options object or direct arguments.
      // Based on common patterns and some Pinata docs:
      pinata = new PinataClient({
         pinataApiKey: pinataKey,
         pinataSecretApiKey: pinataSecretKey,
      });
      // Or, if the constructor takes direct arguments (less common for newer SDKs but possible):
      // pinata = new PinataClient(pinataKey, pinataSecretKey);


      // Test connection during startup
      // The method is typically testAuthentication()
      if (pinata && typeof pinata.testAuthentication === 'function') {
         pinata.testAuthentication().then((result) => {
            // The result structure might vary, check SDK docs if `result.authenticated` is not correct
            console.log("Pinata ('pinata' SDK) authentication successful:", result);
         }).catch((err) => {
            console.error("Pinata ('pinata' SDK) authentication failed:", err.message);
            pinata = null; // Disable Pinata if auth fails
            console.warn("IPFS operations will be disabled due to Pinata authentication failure.");
         });
      } else {
         console.warn("Pinata client initialized, but testAuthentication method not found. Assuming auth based on key presence.");
      }

   } catch (error) {
      console.error("Failed to initialize PinataClient ('pinata' SDK):", error.message);
      pinata = null;
      console.warn("IPFS operations will be disabled due to Pinata initialization failure.");
   }
} else {
   console.warn("PINATA_KEY and/or PINATA_SECRET not configured in environment variables. IPFS operations will be disabled.");
}

/**
 * Helper to upload a buffer to IPFS via Pinata.
 * @param {Buffer} buffer - The data buffer.
 * @param {string} pinataName - Name for the pin on Pinata.
 * @returns {Promise<string>} IPFS CID.
 * @throws {Error} If upload fails or keys are missing.
 */
const uploadToIPFS = async (buffer, pinataName) => {
   if (!pinata) {
      throw new ApiError(500, 'IPFS service is not configured.', 'ipfs_config');
   }
   try {
      const readableStream = stream.Readable.from(buffer);
      const options = {
         pinataMetadata: { name: pinataName },
         pinataOptions: { cidVersion: 0 } // Or 1
      };
      const result = await pinata.pinFileToIPFS(readableStream, options);
      console.log(`Successfully pinned ${pinataName} to IPFS. CID: ${result.IpfsHash}`);
      return result.IpfsHash;
   } catch (error) {
      console.error(`Error uploading ${pinataName} to Pinata IPFS:`, error.message);
      throw new ApiError(500, `Failed to upload ${pinataName} to IPFS.`, 'ipfs_upload', { detail: error.message });
   }
};

/**
 * Helper to get the full gateway URL for a CID.
 * @param {string} cid - IPFS Content Identifier.
 * @returns {string|null} Full gateway URL or null if CID is missing.
 */
const getIpfsUrl = (cid) => {
   if (!cid) return null;
   const gateway = pinataGatewayUrl.endsWith('/') ? pinataGatewayUrl : `${pinataGatewayUrl}/`;
   return `${gateway}ipfs/${cid}`;
};

/**
 * Generates a PDF buffer for a delivery note.
 * @async
 * @param {DeliveryNote} note - Populated Mongoose DeliveryNote document.
 * @returns {Promise<Buffer>} PDF buffer.
 */
const generatePdfBuffer = async (note) => {
   return new Promise(async (resolve, reject) => {
      try {
         const doc = new PDFDocument({ margin: 50, size: 'A4' });
         const buffers = [];

         doc.on('data', buffers.push.bind(buffers));
         doc.on('end', () => resolve(Buffer.concat(buffers)));
         doc.on('error', reject);

         // --- PDF Content Structure --- [cite: 7]
         // Header
         doc.fontSize(18).text(`Albarán #${note.deliveryNoteNumber}`, { align: 'center' });
         doc.fontSize(10).text(`Fecha: ${new Date(note.date).toLocaleDateString('es-ES')}`, { align: 'right' });
         doc.moveDown(2);

         // User (Provider) Info
         doc.fontSize(12).text('Proveedor:', { underline: true });
         if (note.createdBy) {
            const user = note.createdBy;
            const company = user.company;
            doc.text(`${user.firstName || ''} ${user.lastName || ''} (${user.email})`);
            if (company?.name) {
               doc.text(`Empresa: ${company.name} (CIF: ${company.cif || 'N/A'})`);
               if (company.address?.street) {
                  doc.text(`Dirección: ${company.address.street}, ${company.address.city || ''} ${company.address.postalCode || ''}, ${company.address.country || ''}`);
               }
            } else {
               doc.text(`NIF: ${user.nif || 'N/A'}`);
            }
         } else {
            doc.text('Datos del proveedor no disponibles.');
         }
         doc.moveDown();

         // Client Info
         doc.fontSize(12).text('Cliente:', { underline: true });
         if (note.client) {
            const client = note.client;
            doc.text(`${client.name} (${client.email})`);
            if (client.companyDetails?.name) { // Assuming Client model might have company details
               doc.text(`Empresa: ${client.companyDetails.name} (CIF: ${client.companyDetails.cif || 'N/A'})`);
               // Add client address if available
            } else {
               doc.text(`CIF/NIF: ${client.cif || 'N/A'}`); // Assuming CIF field exists directly on client
               doc.text(`Dirección: ${client.address || 'N/A'}`);
            }
         } else {
            doc.text('Datos del cliente no disponibles.');
         }
         doc.moveDown();

         // Project Info
         doc.fontSize(12).text('Proyecto:', { underline: true });
         if (note.project) {
            doc.text(`${note.project.name}`);
            if (note.project.description) doc.fontSize(10).text(`Descripción: ${note.project.description}`, { oblique: true });
         } else {
            doc.text('Datos del proyecto no disponibles.');
         }
         doc.moveDown();

         // Items Table
         doc.fontSize(12).text('Conceptos:', { underline: true });
         doc.moveDown(0.5);
         const tableTop = doc.y;
         const itemX = 50;
         const personX = 200;
         const qtyX = 350;
         const priceX = 420;
         const totalX = 500; // Adjust spacing as needed

         // Headers
         doc.fontSize(10).text('Descripción', itemX, tableTop, { bold: true, width: 140, lineBreak: false });
         doc.text('Persona', personX, tableTop, { bold: true, width: 140, lineBreak: false });
         doc.text('Cantidad/Horas', qtyX, tableTop, { bold: true, width: 60, align: 'right', lineBreak: false });
         doc.text('Precio Unit.', priceX, tableTop, { bold: true, width: 70, align: 'right', lineBreak: false });
         doc.text('Total', totalX, tableTop, { bold: true, width: 70, align: 'right' });
         doc.moveDown(0.2); // Space before line
         doc.moveTo(itemX, doc.y).lineTo(totalX + 70, doc.y).stroke(); // Line under headers
         doc.moveDown(0.5);

         let grandTotal = 0;
         note.items.forEach(item => {
            const y = doc.y;
            const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
            grandTotal += itemTotal;

            doc.fontSize(10).text(item.description || '', itemX, y, { width: 140, lineBreak: true }); // Allow description to wrap
            const currentYAfterDesc = doc.y; // Get Y after potential wrapping
            doc.text(item.person || '', personX, y, { width: 140, lineBreak: true }); // Allow person to wrap
            const currentYAfterPerson = doc.y;
            const finalY = Math.max(currentYAfterDesc, currentYAfterPerson); // Use the lowest Y position after text rendering

            doc.text((item.quantity || 0).toString(), qtyX, y, { width: 60, align: 'right', lineBreak: false });
            doc.text(item.unitPrice !== null ? `${item.unitPrice.toFixed(2)} €` : '-', priceX, y, { width: 70, align: 'right', lineBreak: false });
            doc.text(`${itemTotal.toFixed(2)} €`, totalX, y, { width: 70, align: 'right' });

            doc.y = finalY; // Ensure next item starts below the longest wrapped text
            doc.moveDown(0.7); // Space between items
         });

         // Grand Total (if applicable)
         if (note.items.some(item => item.unitPrice !== null)) {
            doc.moveTo(priceX - 10, doc.y).lineTo(totalX + 70, doc.y).stroke(); // Line above total
            doc.moveDown(0.5);
            doc.fontSize(11).text('Total General:', priceX, doc.y, { bold: true, width: 70, align: 'right', lineBreak: false });
            doc.text(`${grandTotal.toFixed(2)} €`, totalX, doc.y, { bold: true, width: 70, align: 'right' });
            doc.moveDown();
         }


         // Optional Notes
         if (note.notes) {
            doc.moveDown();
            doc.fontSize(10).text('Notas Adicionales:', { underline: true });
            doc.text(note.notes);
         }

         // Signature Area [cite: 7]
         doc.moveDown(2);
         const signatureY = doc.y > 700 ? 50 : doc.y; // Move to next page if low
         if (note.isSigned && note.signatureUrl) {
            doc.fontSize(11).text('Firmado:', signatureY);
            doc.fontSize(9).text(`Fecha: ${new Date(note.signedAt).toLocaleString('es-ES')}`, signatureY + 15);

            const signatureDisplayUrl = getIpfsUrl(note.signatureUrl); // Get gateway URL
            if (signatureDisplayUrl) {
               // In a real scenario, you'd fetch the image and embed it.
               // For now, just linking to it as per PDF requirement focus.
               doc.moveDown(0.5);
               doc.fillColor('blue')
                  .text('Ver Firma (IPFS Link)', signatureY + 30, { link: signatureDisplayUrl, underline: true })
                  .fillColor('black');
               // --- Image Embedding Logic (Optional, requires fetching) ---
               // try {
               //    console.log(`Workspaceing signature image from: ${signatureDisplayUrl}`);
               //    const response = await axios.get(signatureDisplayUrl, { responseType: 'arraybuffer' });
               //    doc.image(response.data, { fit: [100, 50], align: 'center' }); // Adjust fit as needed
               // } catch (imgError) {
               //    console.error("Error fetching/embedding signature image:", imgError.message);
               //    doc.fontSize(8).fillColor('red').text('(Error al cargar imagen de firma)', {align: 'center'});
               // }
               // --- End Image Embedding ---
            } else {
               doc.fontSize(8).fillColor('red').text('(Firma no encontrada en IPFS)');
            }
         } else {
            doc.fontSize(11).text('Pendiente de Firma', signatureY);
         }
         // --- End PDF Content ---
         doc.end();
      } catch (error) {
         console.error("Error during PDF generation:", error);
         reject(new ApiError(500, 'PDF generation failed.', 'pdf_generation', { detail: error.message }));
      }
   });
};

/**
 * @desc    Create a new delivery note [cite: 6]
 * @route   POST /api/deliverynote
 * @access  Private
 */
exports.createDeliveryNote = async (req, res) => {
   const session = await mongoose.startSession();
   session.startTransaction();
   try {
      const userId = req.user.id;
      const { deliveryNoteNumber, date, projectId, items, notes } = req.body;

      // Validator already checks project existence and ownership implicitly via pre-save hook
      const newDeliveryNote = new DeliveryNote({
         deliveryNoteNumber,
         date,
         project: projectId, // The pre-save hook will fetch client and verify owner
         createdBy: userId,
         items,
         notes,
         isSigned: false,
      });

      await newDeliveryNote.save({ session }); // Pre-save hook runs here
      await session.commitTransaction();

      // Populate response
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
      // Handle specific errors like duplicate key
      if (error.code === 11000) {
         throw new ApiError(409, 'Delivery note number already exists for this user.', 'duplicate_key');
      }
      // Handle validation errors from pre-save hook
      if (error.message.includes('Project not found') || error.message.includes('Client does not exist')) {
         throw new ApiError(400, error.message, 'validation');
      }
      console.error('Error creating delivery note:', error);
      throw new ApiError(500, 'Failed to create delivery note.', 'db_error', { detail: error.message });
   } finally {
      session.endSession();
   }
};

/**
 * @desc    List all delivery notes for the user [cite: 6]
 * @route   GET /api/deliverynote
 * @access  Private
 */
exports.getAllDeliveryNotes = async (req, res) => {
   const userId = req.user.id;
   // TODO: Add filtering (projectId, clientId, status, date range) and pagination
   const deliveryNotes = await DeliveryNote.find({ createdBy: userId })
      .populate('client', 'name')
      .populate('project', 'name')
      .sort({ date: -1 });

   // Add gateway URLs to response
   const notesWithUrls = deliveryNotes.map(note => ({
      ...note.toObject(),
      signatureGatewayUrl: getIpfsUrl(note.signatureUrl),
      pdfGatewayUrl: getIpfsUrl(note.pdfUrl),
   }));

   res.status(200).json({
      message: 'Delivery notes retrieved successfully.',
      count: notesWithUrls.length,
      data: notesWithUrls,
   });
};

/**
 * @desc    Get a specific delivery note [cite: 6]
 * @route   GET /api/deliverynote/:id
 * @access  Private
 */
exports.getDeliveryNoteById = async (req, res) => {
   const userId = req.user.id;
   const { id } = req.params;

   // Populate deeply as required by PDF [cite: 6]
   const deliveryNote = await DeliveryNote.findOne({ _id: id, createdBy: userId })
      .populate('createdBy', 'firstName lastName email company') // User details
      .populate('client') // Full client details
      .populate('project'); // Full project details

   if (!deliveryNote) {
      throw new ApiError(404, 'Delivery note not found or you do not have permission.', 'not_found');
   }

   // Add gateway URLs
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
 * @desc    Update a delivery note
 * @route   PUT /api/deliverynote/:id
 * @access  Private
 */
exports.updateDeliveryNote = async (req, res) => {
   const userId = req.user.id;
   const { id } = req.params;
   const updateData = req.body;

   const deliveryNote = await DeliveryNote.findOne({ _id: id, createdBy: userId });

   if (!deliveryNote) {
      throw new ApiError(404, 'Delivery note not found or you do not have permission.', 'not_found');
   }

   // Prevent updates if already signed [cite: 8] (Requirement interpretation: cannot modify content after sign)
   if (deliveryNote.isSigned) {
      throw new ApiError(403, 'Cannot update a signed delivery note.', 'forbidden_update');
   }

   // Prevent direct manipulation of signature/PDF fields
   delete updateData.isSigned;
   delete updateData.signedAt;
   delete updateData.signatureUrl;
   delete updateData.pdfUrl;
   delete updateData.createdBy; // Cannot change owner
   delete updateData.client; // Client is derived from project

   // If project is updated, the pre-save hook should re-validate and update the client ref
   Object.assign(deliveryNote, updateData);

   await deliveryNote.save(); // Trigger pre-save hook if project changed

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
 * @desc    Sign a delivery note [cite: 8]
 * @route   PATCH /api/deliverynote/sign/:id
 * @access  Private
 */
exports.signDeliveryNote = async (req, res) => {
   const session = await mongoose.startSession();
   session.startTransaction();
   try {
      const userId = req.user.id;
      const { id } = req.params;
      const { signatureUrl, signedDate } = req.body; // Expecting IPFS CID or cloud URL [cite: 8]

      if (!signatureUrl) {
         throw new ApiError(400, 'Signature URL (IPFS CID or cloud link) is required.', 'validation');
      }

      const deliveryNote = await DeliveryNote.findOne({ _id: id, createdBy: userId })
         .populate('createdBy', 'firstName lastName email company') // Populate for PDF
         .populate('client')
         .populate('project')
         .session(session);

      if (!deliveryNote) {
         throw new ApiError(404, 'Delivery note not found or you do not have permission.', 'not_found');
      }

      if (deliveryNote.isSigned) {
         // Return current data if already signed
         const noteObj = deliveryNote.toObject();
         const responseData = {
            ...noteObj,
            signatureGatewayUrl: getIpfsUrl(noteObj.signatureUrl),
            pdfGatewayUrl: getIpfsUrl(noteObj.pdfUrl),
         };
         await session.abortTransaction(); // No changes needed
         session.endSession();
         return res.status(200).json({
            message: 'Delivery note is already signed.',
            data: responseData,
         });
      }

      // 1. Update Note Status
      deliveryNote.isSigned = true;
      deliveryNote.signatureUrl = signatureUrl; // Store the provided URL/CID
      deliveryNote.signedAt = signedDate ? new Date(signedDate) : new Date();

      // 2. Generate PDF Buffer [cite: 6]
      const pdfBuffer = await generatePdfBuffer(deliveryNote);

      // 3. Upload PDF to IPFS/Cloud [cite: 8]
      const pdfFileName = `Albaran_${deliveryNote.deliveryNoteNumber}_${Date.now()}.pdf`;
      const pdfCid = await uploadToIPFS(pdfBuffer, pdfFileName);
      deliveryNote.pdfUrl = pdfCid; // Store the PDF's CID/URL

      // 4. Save changes
      const signedDeliveryNote = await deliveryNote.save({ session });
      await session.commitTransaction();

      // 5. Prepare and send response
      const noteObj = signedDeliveryNote.toObject();
      const responseData = {
         ...noteObj,
         signatureGatewayUrl: getIpfsUrl(noteObj.signatureUrl),
         pdfGatewayUrl: getIpfsUrl(noteObj.pdfUrl),
      };

      res.status(200).json({
         message: 'Delivery note signed and PDF uploaded successfully.',
         data: responseData,
      });

   } catch (error) {
      await session.abortTransaction();
      console.error('Error signing delivery note:', error);
      // Don't throw the original error directly if it's an ApiError we created
      if (!error.isOperational) {
         throw new ApiError(500, 'Failed to sign delivery note.', 'signing_error', { detail: error.message });
      } else {
         throw error; // Re-throw ApiErrors (like IPFS config error)
      }
   } finally {
      session.endSession();
   }
};

/**
 * @desc    Download Delivery Note PDF [cite: 6]
 * @route   GET /api/deliverynote/pdf/:id
 * @access  Private (User or guest of user's company) [cite: 7]
 */
exports.downloadDeliveryNotePdf = async (req, res) => {
   const requestorUserId = req.user.id; // User making the request
   const { id } = req.params;

   const deliveryNote = await DeliveryNote.findById(id)
      .populate('createdBy', 'companyId'); // Need creator's company info for guest check

   if (!deliveryNote) {
      throw new ApiError(404, 'Delivery note not found.', 'not_found');
   }

   // --- Permission Check --- [cite: 7]
   const isOwner = deliveryNote.createdBy._id.toString() === requestorUserId;
   // Simple guest check: does the requestor belong to the same company as the creator?
   // Assumes User model has a companyId field populated from invite/company association.
   // A more robust check might involve specific guest permissions.
   const requestorUser = await User.findById(requestorUserId, 'companyId'); // Fetch requestor's company ID
   const isGuestOfCompany = requestorUser?.companyId &&
      deliveryNote.createdBy?.companyId &&
      requestorUser.companyId.toString() === deliveryNote.createdBy.companyId.toString();

   if (!isOwner && !isGuestOfCompany) {
      throw new ApiError(403, 'You do not have permission to download this PDF.', 'forbidden_download');
   }
   // --- End Permission Check ---

   if (!deliveryNote.isSigned || !deliveryNote.pdfUrl) {
      throw new ApiError(404, 'PDF is not available for this delivery note (it might not be signed yet).', 'pdf_not_available');
   }

   // Preferentially download from cloud/IPFS [cite: 8]
   const pdfGatewayUrl = getIpfsUrl(deliveryNote.pdfUrl);
   if (pdfGatewayUrl) {
      console.log(`Redirecting PDF download to IPFS: ${pdfGatewayUrl}`);
      // Redirect the client to the IPFS gateway
      // Add Content-Disposition header to suggest a filename
      // Note: Gateway behavior might vary. Direct streaming might be an alternative.
      res.setHeader('Content-Disposition', `attachment; filename="Albaran_${deliveryNote.deliveryNoteNumber}.pdf"`);
      return res.redirect(302, pdfGatewayUrl);
   } else {
      // Fallback: Generate PDF on the fly if no cloud URL exists (shouldn't happen if sign logic is correct)
      console.warn(`PDF URL missing for signed note ${id}, generating on the fly.`);
      try {
         // Repopulate fully if needed for PDF generation fallback
         const populatedNote = await DeliveryNote.findById(id)
            .populate('createdBy', 'firstName lastName email company')
            .populate('client')
            .populate('project');
         if (!populatedNote) throw new Error("Note vanished"); // Should not happen

         const pdfBuffer = await generatePdfBuffer(populatedNote);
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', `attachment; filename="Albaran_${deliveryNote.deliveryNoteNumber}.pdf"`);
         return res.send(pdfBuffer);
      } catch (genError) {
         console.error("Error generating PDF on the fly:", genError);
         throw new ApiError(500, 'Failed to retrieve or generate PDF.', 'pdf_fallback_error');
      }
   }
};

/**
 * @desc    Delete a delivery note [cite: 8]
 * @route   DELETE /api/deliverynote/:id
 * @access  Private
 */
exports.deleteDeliveryNote = async (req, res) => {
   const userId = req.user.id;
   const { id } = req.params;

   const deliveryNote = await DeliveryNote.findOne({ _id: id, createdBy: userId });

   if (!deliveryNote) {
      throw new ApiError(404, 'Delivery note not found or you do not have permission.', 'not_found');
   }

   // Prevent deletion if signed [cite: 8]
   if (deliveryNote.isSigned) {
      throw new ApiError(403, 'Cannot delete a signed delivery note.', 'forbidden_delete');
   }

   // Optional: Add logic here to unpin signature/PDF from IPFS if they exist even on unsigned notes
   // if (pinata && deliveryNote.signatureUrl) { try { await pinata.unpin(deliveryNote.signatureUrl); } catch(e){ console.error("Failed unpinning signature:", e.message);}}
   // if (pinata && deliveryNote.pdfUrl) { try { await pinata.unpin(deliveryNote.pdfUrl); } catch(e){ console.error("Failed unpinning PDF:", e.message);}}

   await DeliveryNote.deleteOne({ _id: id, createdBy: userId });

   res.status(200).json({ message: 'Delivery note deleted successfully.' }); // Or 204 No Content
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
