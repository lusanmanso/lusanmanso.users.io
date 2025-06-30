// File: controllers/projectController.js
const { validationResult } = require('express-validator');
const Project = require('../models/Project');
const Client = require('../models/Client');
const DeliveryNote = require('../models/DeliveryNote');
const { ApiError } = require('../middleware/handleError');

/**
 * @desc Create a new project
 * @route POST /api/project
 * @access Private
 */
exports.createProject = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', 'validation', { errors: errors.array() });
  }

  const { name, description, client } = req.body;
  const userId = req.user.id;

  const clientDoc = await Client.findOne({ _id: client, createdBy: userId, archived: false });
  if (!clientDoc) {
    throw new ApiError(404, 'Client not found or you do not have permission to assign it.', 'not_found');
  }

  // Check duplicated (name + client + user)
  const existingProject = await Project.findOne({ name, client, createdBy: userId });
  if (existingProject) {
     throw new ApiError(409, 'A project with this name already exists for this client.', 'conflict');
  }

  const project = new Project({
    name,
    description,
    client,
    createdBy: userId
  });

  await project.save();

  const populatedProject = await Project.findById(project._id).populate('client', 'name email');

  res.status(201).json({
    message: 'Project created successfully',
    project: populatedProject
  });
};

/**
 * @desc Obtain all projects of the user
 * @route GET /api/project
 * @access Private
 */
exports.getProjects = async (req, res) => {
  const userId = req.user.id;

  const projects = await Project.find({ createdBy: userId, archived: false })
                                .populate('client', 'name email')
                                .sort({ createdAt: -1 }); // Order by most recent

  res.status(200).json(projects);
};

/**
 * @desc Obtain a project by ID
 * @route GET /api/project/:id
 * @access Private
 */
exports.getProjectById = async (req, res) => {
  const userId = req.user.id;
  const projectId = req.params.id;

  const project = await Project.findOne({ _id: projectId, createdBy: userId, archived: false })
                               .populate('client', 'name email')
                               .populate('createdBy', 'firstName lastName email');

  if (!project) {
    throw new ApiError(404, 'Project not found or you do not have permission to view it', 'not_found');
  }

  res.status(200).json(project);
};

/**
 * @desc Update a project
 * @route PUT /api/project/:id
 * @access Private
 */
exports.updateProject = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', 'validation', { errors: errors.array() });
  }

  const userId = req.user.id;
  const projectId = req.params.id;
  const { name, description, client: newClientId } = req.body;

  const project = await Project.findOne({ _id: projectId, createdBy: userId });
  if (!project) {
    throw new ApiError(404, 'Project not found or you do not have permission to update it', 'not_found');
  }

  // If client changes, check if the new client exists and belongs to the user
  if (newClientId && newClientId.toString() !== project.client.toString()) {
    const newClient = await Client.findOne({ _id: newClientId, createdBy: userId, archived: false });
    if (!newClient) {
      throw new ApiError(404, 'New client not found or you do not have permission to assign it.', 'not_found');
    }
    project.client = newClientId;
  }

  const currentClient = newClientId || project.client;
  if (name && name !== project.name) {
      const existingProject = await Project.findOne({
          name,
          client: currentClient,
          createdBy: userId,
          _id: { $ne: projectId } // Exclude the current project from the search
      });
      if (existingProject) {
          throw new ApiError(409, 'Another project with this name already exists for this client.', 'conflict');
      }
      project.name = name;
  }

  if (description !== undefined) project.description = description; // Permite actualizar a null o string vacío

  await project.save();
  const updatedProject = await Project.findById(projectId).populate('client', 'name email').populate('createdBy', 'firstName lastName email');

  res.status(200).json({
    message: 'Project updated successfully',
    project: updatedProject
  });
};

/**
 * @desc Archive a project (soft Delete)
 * @route PATCH /api/project/archive/:id
 * @access Private
 */
exports.archiveProject = async (req, res) => {
  const userId = req.user.id;
  const projectId = req.params.id;

  const project = await Project.findOne({ _id: projectId, createdBy: userId });
  if (!project) {
    throw new ApiError(404, 'Project not found or you do not have permission to archive it', 'not_found');
  }

  if (project.archived) {
    return res.status(200).json({ message: 'Project is already archived' });
  }

  project.archived = true;
  await project.save();

  res.status(200).json({ message: 'Project archived successfully' });
};

/**
 * @desc Delete a project (permanent delete)
 * @route DELETE /api/project/:id
 * @access Private
 */
exports.deleteProject = async (req, res) => {
  const userId = req.user.id;
  const projectId = req.params.id;

  const projectExists = await Project.findOne({ _id: projectId, createdBy: userId }, '_id');
  if (!projectExists) {
      throw new ApiError(404, 'Project not found or you do not have permission to delete it', 'not_found');
  }

  const DeliveryNote = require('../models/DeliveryNote');
  const associatedNotesCount = await DeliveryNote.countDocuments({ project: projectId });
  if (associatedNotesCount > 0) {

      throw new ApiError(409, `Cannot delete project: ${associatedNotesCount} associated delivery note(s) exist.`, 'dependency_conflict');
  }

  const result = await Project.deleteOne({ _id: projectId, createdBy: userId });

  if (result.deletedCount === 0) {
      throw new ApiError(404, 'Project not found or deletion failed unexpectedly', 'not_found');
  }

  res.status(200).json({ message: 'Project deleted permanently' });
};

/**
 * @desc Get all archived projects of the user
 * @route GET /api/project/archived
 * @access Private
 */
exports.getArchivedProjects = async (req, res) => {
  const userId = req.user.id;
  const projects = await Project.find({ createdBy: userId, archived: true })
                                .populate('client', 'name email')
                                .sort({ updatedAt: -1 }); // Sort by most recent update

  res.status(200).json(projects);
};

/**
 * @desc Recuperar un proyecto archivado
 * @route PATCH /api/project/recover/:id
 * @access Private
 */
exports.recoverProject = async (req, res) => {
  const userId = req.user.id;
  const projectId = req.params.id;

  const project = await Project.findOne({ _id: projectId, createdBy: userId });
  if (!project) {
      throw new ApiError(404, 'Project not found or you do not have permission', 'not_found');
  }

  if (!project.archived) {
      throw new ApiError(400, 'Project is not archived', 'bad_request');
  }

  project.archived = false;
  await project.save();
  const recoveredProject = await Project.findById(projectId).populate('client', 'name email');


  res.status(200).json({
      message: 'Project recovered successfully',
      project: recoveredProject
  });
};
