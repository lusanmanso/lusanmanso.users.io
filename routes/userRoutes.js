// File: routes/userRoutes.js
const express = require('express');
const {
  validateUserRegistration,
  validateUserLogin,
  validateEmailVerification,
  validateUpdateUser,
  validateUpdateCompany,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateInviteUser,
  validateUserId
} = require('../validators/userValidators');
const userController = require('../controllers/userController');
const logoController = require('../controllers/logoController');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/fileUpload');
const { handleMulterErrors, asyncHandler } = require('../middleware/handleError');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: User
 *     description: User management and authentication and related endpoints
 */

/**
 * @openapi
 * /user/register:
 *   post:
 *     tags:
 *       - User
 *     summary: Register a new user
 *     description: Creates a new user account and sends a verification email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInputRegister'
 *     responses:
 *       '201':
 *         description: Registration successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
   '/register',
   validateUserRegistration,
   asyncHandler(userController.registerUser)
);

/**
 * @openapi
 * /user/validation:
 *   put:
 *     tags:
 *       - User
 *     summary: Validate user email
 *     description: Validates the user's email address using a verification code.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserEmailValidation'
 *     responses:
 *       '200':
 *         description: Email validated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/user'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
   '/validation',
   auth,
   validateEmailVerification,
   asyncHandler(userController.verifyEmail)
);

/**
 * @openapi
 * /user/login:
 *   post:
 *     tags:
 *       - User
 *     summary: Login user
 *     description: Authenticates a user with email and password, returning user data and a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserLogin'
 *     responses:
 *       '200':
 *         description: Login successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
   '/login',
   validateUserLogin,
   asyncHandler(userController.loginUser)
);

/**
 * @openapi
 * /user:
 *   get:
 *     tags:
 *       - User
 *     summary: Get current user data
 *     description: Retrieves the profile information of the currently authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: User data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
   '/',
   auth,
   asyncHandler(userController.getCurrentUser)
);

/**
 * @openapi
 * /user:
 *   put:
 *     tags:
 *       - User
 *     summary: Update user personal data
 *     description: Updates the authenticated user's personal information.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserPersonalData'
 *     responses:
 *       '200':
 *         description: Personal data updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
   '/',
   auth,
   validateUpdateUser,
   asyncHandler(userController.updatePersonalData)
);

/**
 * @openapi
 * /user/company:
 *   patch:
 *     tags:
 *       - User
 *     summary: Update user company data
 *     description: Updates the authenticated user's company information.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCompanyData'
 *     responses:
 *       '200':
 *         description: Company data updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
   '/company',
   auth,
   validateUpdateCompany,
   asyncHandler(userController.updateCompanyData)
);

/**
 * @openapi
 * /user/logo:
 *   patch:
 *     tags:
 *       - User
 *     summary: Upload or update company logo
 *     description: Uploads a logo image for the user's company.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: Logo uploaded successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 logo:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     filename:
 *                       type: string
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
   '/logo',
   auth,
   upload.single('logo'),
   handleMulterErrors,
   asyncHandler(logoController.uploadLogo)
);
/**
 * @openapi
 * /user:
 *   delete:
 *     tags:
 *       - User
 *     summary: Delete current user account
 *     description: Performs a soft or hard delete of the authenticated user's account.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: soft
 *         schema:
 *           type: boolean
 *         description: Set to false for hard delete. Defaults to true.
 *     responses:
 *       '200':
 *         description: User deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
   '/',
   auth,
   asyncHandler(userController.deleteUser)
);

/**
 * @openapi
 * /user/recover-password:
 *   post:
 *     tags:
 *       - User
 *     summary: Request password recovery code
 *     description: Sends a password recovery code to the user's email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserPasswordRecover'
 *     responses:
 *       '200':
 *         description: If the email exists, a reset code will be sent.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
   '/recover-password',
   validateForgotPassword,
   asyncHandler(userController.requestPasswordReset)
);

/**
 * @openapi
 * /user/reset-password:
 *   post:
 *     tags:
 *       - User
 *     summary: Reset password using recovery code
 *     description: Sets a new password if the code is valid.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserPasswordReset'
 *     responses:
 *       '200':
 *         description: Password updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
   '/reset-password',
   validateResetPassword,
   asyncHandler(userController.resetPassword)
);

/**
 * @openapi
 * /user/invite:
 *   post:
 *     tags:
 *       - User
 *     summary: Invite a team member
 *     description: Invites a user to the company or creates a new guest account.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInvite'
 *     responses:
 *       '200':
 *         description: Existing user invited successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       '201':
 *         description: New user created and invitation sent.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
   '/invite',
   auth,
   validateInviteUser,
   asyncHandler(userController.inviteTeamMember)
);

module.exports = router;
