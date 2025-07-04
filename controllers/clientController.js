// File: controllers/clientController.js
const validationResult = require('express-validator').validationResult; // TODO: .validationResult is it necessary?
const Client = require('../models/Client');
const Project = require('../models/Project');
const { ApiError } = require('../middleware/handleError');

/**
 * @desc Create a new client
 * @route POST /api/client
 * @access Private
 */
exports.createClient = async (req, res, next) => {
   const errors = validationResult(req);
   if(!errors.isEmpty()) {
      throw new ApiError(400, 'Validation errors', 'validation', {errors: errors.array()});
   }

   const { name, email, company } = req.body;
   const userId = req.user.id; // From middleware auth

   const existingClient = await Client.findOne({ email, createdBy: userId });
   if (existingClient) {
      throw new ApiError(400, 'Client already exists', 'client', { errors: [{ msg: 'Client already exists' }] });
   }

   const client = new Client({
      name,
      email,
      company: company || null,
      createdBy: userId,
   });

   await client.save();

   res.status(201).json({
      message: 'Client created successfully',
      client,
   });
};

/**
 * @desc Get all active clients from user
 * @route GET /api/client
 * @access Private
 */
exports.getClients = async (req, res, next) => {
   const userId = req.user.id; // From middleware auth

   // Cambios .populate('company', 'name');
   const clients = await Client.find({ createdBy: userId, archived: false });

   res.status(200).json({
      message: 'Clients retrieved successfully',
      clients,
   });
};

/**
 * @desc Obtain a client by ID
 * @route GET /api/client/:id
 * @access Private
 */
exports.getClientById = async (req, res, next) => {
   const userId = req.user.id;
   const clientId = req.params.id;

   // Cambios .populate('company', 'name');
   const client = await Client.findOne({ _id: clientId, createdBy: userId, archived: false });

   if (!client) {
      throw new ApiError(404, 'Client not found', 'client', { errors: [{ msg: 'Client not found' }] });
   }

   res.status(200).json(client);
};

/**
 * @desc Update a client
 * @route PUT /api/client/:id (or PATCH)
 * @access Private
 */
exports.updateClient = async (req, res) => {
   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation errors', 'validation', { errors: errors.array() });
   }

   const userId = req.user.id;
   const clientId = req.params.id;
   const updateData = req.body; // { name, email, company }

   const client = await Client.findOne({ _id: clientId, createdBy: userId });

   if (!client) {
      throw new ApiError(404, 'Client not found', 'client', { errors: [{ msg: 'Client not found' }] });
   }

   // Check duplicate email
   if (updateData.email && updateData.email !== client.email) {
      const existingClient = await Client.findOne({
        createdBy: userId,
        email: updateData.email,
        _id: { $ne: clientId }, // Exclude the current client from the search
      });

      if (existingClient) {
        throw new ApiError(409, 'Another client with this email already exists for this user', 'conflict');
      }

      client.email = updateData.email;
   }

   // Update other fields
   if (updateData.name) client.name = updateData.name;
   if (updateData.hasOwnProperty('company')) client.company = updateData.company || null;

   const updatedClient = await client.save();

   res.status(200).json({
      message: 'Client updated successfully',
      client: updatedClient,
   });
};

/**
 * @desc Archive a client (soft delete)
 * @route DELETE /api/client/archive/:id
 * @access Private
 */
exports.archiveClient = async (req, res) => {
   const userId = req.user.id;
   const clientId = req.params.id;

   const client = await Client.findOne({ _id: clientId, createdBy: userId });

   if (!client) {
      throw new ApiError(404, 'Client not found', 'client', { errors: [{ msg: 'Client not found' }] });
   }

   if (client.archived) {
      throw new ApiError(400, 'Client already archived', 'client', { errors: [{ msg: 'Client already archived' }] });
   }

   client.archived = true;
   await client.save();

   res.status(200).json({
      message: 'Client archived successfully',
      client,
   });
};

/**
 * @desc Delete a client permanently (hard delete)
 * @route DELETE /api/client/:id
 * @access Private
 */
exports.deleteClient = async (req, res) => {
   const userId = req.user.id;
   const clientId = req.params.id;

   // 1. Verify if the client exists and belongs to the user
   const client = await Client.findOne({ _id: clientId, createdBy: userId });

   if (!client) {
      throw new ApiError(404, 'Client not found or you do not have permission', 'not_found');
   }

   // 2. Check if the client has associated projects
   const associatedProjects = await Project.findOne({ client: clientId });

   if (associatedProjects) {
      throw new ApiError(
          409, // Note: 409 Conflict is a good code to indicate that the request cannot be completed because of a conflict with the resource's actual state
          'Cannot delete client: Client has associated projects.',
          'conflict',
          { errors: [{ msg: 'Client has existing projects and cannot be deleted permanently. Please delete all associated projects first.' }] }
      );
   }

   // 3. If no projects are associated, delete the client
   const result = await Client.deleteOne({ _id: clientId, createdBy: userId });

   if (result.deleteCount === 0) {
      throw new ApiError(404, 'Client not found', 'client', { errors: [{ msg: 'Client not found' }] });
   }

   res.status(200).json({ message: 'Client deleted successfully' });
};

/**
 * @desc    Get all archived clients from user
 * @route   GET /api/client/archived
 * @access  Private
 */
exports.getArchivedClients = async (req, res) => {
   const userId = req.user.id;

   // Cambios .populate('company', 'name');
   const clients = await Client.find({ createdBy: userId, archived: true });

   res.status(200).json(clients);
 };

 /**
  * @desc    Recover an archived client
  * @route   PATCH /api/client/recover/:id
  * @access  Private
  */
 exports.recoverClient = async (req, res) => {
   const userId = req.user.id;
   const clientId = req.params.id;

   const client = await Client.findOne({ _id: clientId, createdBy: userId });

   if (!client) {
     throw new ApiError(404, 'Client not found or you do not have permission', 'not_found');
   }

   if (!client.archived) {
     throw new ApiError(400, 'Client is not archived', 'bad_request');
   }

   client.archived = false;
   const recoveredClient = await client.save();

   res.status(200).json({
     message: 'Client recovered successfully',
     client: recoveredClient
   });
 };

