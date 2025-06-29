// File: routes/projectRoutes.js
const express = require('express');
const projectController = require('../controllers/projectController');
const { auth } = require('../middleware/auth');
const { validateCreateProject, validateUpdateProject, validateProjectId } = require('../validators/projectValidators');
const { asyncHandler } = require('../middleware/handleError'); // Importar con desestructuración

const router = express.Router();

router.use(auth); // Aplicar auth a todas las rutas

/**
 * @openapi
 * tags:
 *   - name: Project
 *     description: Project management endpoints
 */

/**
 * @route POST /api/project
 * @desc Create new project
 * @access Private
 * @openapi
 * /project:
 *   post:
 *     tags:
 *       - Project
 *     summary: Create a new project
 *     description: Creates a new project for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProjectInput'
 *     responses:
 *       '201':
 *         description: Project created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectOutput'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/',
   validateCreateProject, // Usar el nombre correcto importado
   asyncHandler(projectController.createProject) // Envolver controlador
);

/**
 * @route GET /api/project
 * @desc Obtain a list of projects for user
 * @access Private
 * @openapi
 * /project:
 *   get:
 *     tags:
 *       - Project
 *     summary: List all projects
 *     description: Retrieves all projects for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Array of project objects.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProjectOutput'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', asyncHandler(projectController.getProjects)); // Envolver controlador

/**
 * @route GET /api/project/archived
 * @desc Obtain list of archived projects
 * @access Private
 * @openapi
 * /project/archived:
 *   get:
 *     tags:
 *       - Project
 *     summary: List archived projects
 *     description: Retrieves archived projects for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Array of archived project objects.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProjectOutput'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/archived', asyncHandler(projectController.getArchivedProjects)); // Envolver controlador

/**
 * @route GET /api/project/:id
 * @desc Obtener un proyecto por ID
 * @access Private
 * @openapi
 * /project/{id}:
 *   get:
 *     tags:
 *       - Project
 *     summary: Get a project by ID
 *     description: Retrieves a specific project by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ObjectId.
 *     responses:
 *       '200':
 *         description: Project data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectOutput'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:id',
   validateProjectId, // Añadir validador de ID
   asyncHandler(projectController.getProjectById) // Envolver controlador
);

/**
 * @route PUT /api/project/:id
 * @desc Update a project
 * @access Private
 * @openapi
 * /project/{id}:
 *   put:
 *     tags:
 *       - Project
 *     summary: Update a project
 *     description: Updates a project by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ObjectId.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProjectInput'
 *     responses:
 *       '200':
 *         description: Project updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectOutput'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:id',
   // validateProjectId - the next validator already includes the ID
   validateUpdateProject,
   asyncHandler(projectController.updateProject) // Wrap controller
);

/**
 * @route PATCH /api/project/archive/:id
 * @desc Archive a project
 * @access Private
 * @openapi
 * /project/archive/{id}:
 *   patch:
 *     tags:
 *       - Project
 *     summary: Archive a project
 *     description: Archives a project by its ID (soft delete).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ObjectId.
 *     responses:
 *       '200':
 *         description: Project archived successfully.
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/archive/:id',
   validateProjectId,
   asyncHandler(projectController.archiveProject) // Wrap controller
);

/**
 * @route   PATCH /api/project/recover/:id
 * @desc Recover archived project
 * @access  Private
 * @openapi
 * /project/recover/{id}:
 *   patch:
 *     tags:
 *       - Project
 *     summary: Recover an archived project
 *     description: Recovers an archived project by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ObjectId.
 *     responses:
 *       '200':
 *         description: Project recovered successfully.
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/recover/:id',
   validateProjectId,
   asyncHandler(projectController.recoverProject)
);

/**
 * @route DELETE /api/project/:id
 * @desc Delete a project (hard delete)
 * @access Private
 * @openapi
 * /project/{id}:
 *   delete:
 *     tags:
 *       - Project
 *     summary: Delete a project
 *     description: Deletes a project permanently by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ObjectId.
 *     responses:
 *       '200':
 *         description: Project deleted successfully.
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:id',
   validateProjectId,
   asyncHandler(projectController.deleteProject)
);

module.exports = router;
