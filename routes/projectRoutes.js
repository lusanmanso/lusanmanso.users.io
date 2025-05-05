// File: routes/projectRoutes.js
const express = require('express');
const projectController = require('../controllers/projectController');
const { auth } = require('../middleware/auth');
// --- Importaciones Corregidas ---
const { validateCreateProject, validateUpdateProject, validateProjectId } = require('../validators/projectValidators');
const { asyncHandler } = require('../middleware/handleError'); // Importar con desestructuración

const router = express.Router();

router.use(auth); // Aplicar auth a todas las rutas

/**
 * @route POST /api/project
 * @desc Create new project
 * @access Private
 */
router.post('/',
   validateCreateProject, // Usar el nombre correcto importado
   asyncHandler(projectController.createProject) // Envolver controlador
);

/**
 * @route GET /api/project
 * @desc Obtain a list of projects for user
 * @access Private
 */
router.get('/', asyncHandler(projectController.getProjects)); // Envolver controlador

/**
 * @route GET /api/project/archived
 * @desc Obtain list of archived projects
 * @access Private
 */
router.get('/archived', asyncHandler(projectController.getArchivedProjects)); // Envolver controlador

/**
 * @route GET /api/project/:id
 * @desc Obtener un proyecto por ID
 * @access Private
 */
router.get('/:id',
   validateProjectId, // Añadir validador de ID
   asyncHandler(projectController.getProjectById) // Envolver controlador
);

/**
 * @route PUT /api/project/:id
 * @desc Update a project
 * @access Private
 */
router.put('/:id',
   // validateProjectId, // validateUpdateProject ya incluye la validación del ID del param
   validateUpdateProject, // Añadir validador de update (usa el nombre correcto)
   asyncHandler(projectController.updateProject) // Envolver controlador
);

/**
 * @route PATCH /api/project/archive/:id
 * @desc Archive a project
 * @access Private
 */
router.patch('/archive/:id',
   validateProjectId, // Añadir validador de ID
   asyncHandler(projectController.archiveProject) // Envolver controlador
);

/**
 * @route   PATCH /api/project/recover/:id
 * @desc Recover archived project
 * @access  Private
 */
router.patch('/recover/:id',
   validateProjectId, // Añadir validador de ID
   asyncHandler(projectController.recoverProject) // Envolver controlador
);

/**
 * @route DELETE /api/project/:id
 * @desc Delete a project (hard delete)
 * @access Private
 */
router.delete('/:id',
   validateProjectId, // Añadir validador de ID
   asyncHandler(projectController.deleteProject) // Envolver controlador
);

module.exports = router;
