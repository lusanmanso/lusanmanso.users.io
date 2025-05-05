// File: routes/projectRoutes.js
const express = require('express');
const projectController = require('../controllers/projectController');
const { auth } = require('../middleware/auth');
const { createProjectValidator, updateProjectValidator, validateMongoIdInParam } = require('../validators/projectValidators');
const asyncHandler = require('../middleware/handleError');

const router = express.Router();

router.use(auth); // Apply auth middleware to all routes

/**
 * @route POST /api/project
 * @desc Create new project
 * @access Private
 */
router.post('/', createProjectValidators, asyncHandler(projectController.createProject));

/**
 * @route GET /api/project
 * @desc Obtain a list of projects for user
 * @access Private
 */
router.get('/', asyncHandler(projectController.getProjects));

/**
 * @route GET /api/project/archived
 * @desc Obtain list of archived projects
 * @access Private
 */
router.get('/archived', asyncHandler(projectController.getArchivedProjects));

/**
 * @route GET /api/project/:id
 * @desc Obtener un proyecto por ID
 * @access Private
 */
router.get('/:id', validateMongoIdInParam, asyncHandler(projectController.getProjectById));

/**
 * @route PUT /api/project/:id
 * @desc Update a proyect
 * @access Private
 */
router.put('/:id', validateMongoIdInParam, updateProjectValidators, asyncHandler(projectController.updateProject));

/**
 * @route PATCH /api/project/archive/:id
 * @desc Archive a project
 * @access Private
 */
router.patch('/archive/:id', validateMongoIdInParam, asyncHandler(projectController.archiveProject));

/**
 * @route   PATCH /api/project/recover/:id
 * @desc Recover archived project
 * @access  Private
 */
router.patch('/recover/:id', validateMongoIdInParam, asyncHandler(projectController.recoverProject));

/**
 * @route DELETE /api/project/:id
 * @desc Delete a project (hard delete)
 * @access Private
 */
router.delete('/:id', validateMongoIdInParam, asyncHandler(projectController.deleteProject));

module.exports = router;
