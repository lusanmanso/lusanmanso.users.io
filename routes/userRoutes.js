// File: routes/userRoutes.js
const express = require('express');
const { validateEmail, validatePassword, validateVerificationCode, validatePersonalData, validateCompanyData } = require('../validators/userValidators');
const userController = require('../controllers/userController');
const logoController = require('../controllers/logoController');
const auth = require('../middleware/auth');
const upload = require('../middleware/fileUpload');
const { handleMulterErrors } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @route   POST /api/user/register
 * @desc    Register a new user
 * @access  Public
 */
  router.post(
    '/register',
  [validateEmail, validatePassword],
  userController.registerUser
);

/**
 * @route PUT/api/user/validation
 * @desc Verify user email with code
 * @access Private
 */
router.put(
  '/validation',
  [auth, validateVerificationCode],
  userController.verifyEmail
);

/**
 * @route POST /api/user/login
 * @desc Login user and get token
 * @access Public
 */
router.post(
  '/login',
  [validateEmail, validatePassword],
  userController.loginUser
);

/**
 * @route GET /api/user
 * @desc GET current user
 * @access Private
 */
router.get(
  '/',
  auth,
  userController.getCurrentUser
);

/**
 * @route PUT /api/user
 * @desc Update user personal data (onboarding)
 * @access Private
 */
router.put(
  '/',
  [auth, ...validatePersonalData],
  userController.updatePersonalData
);

/**
 * @route PATCH /api/user/company
 * @desc Update company data
 * @access Private
 */
router.patch(
  '/company',
  [auth, ...validateCompanyData],
  userController.updateCompanyData
);

/**
 * @route PATCH/api/user/logo
 * @desc Upload company logo
 * @access Private
 */
router.patch(
  '/logo',
  [auth, upload.single('logo')],
  require('../middleware/errorHandler').handleMulterErrors,
  logoController.uploadLogo
);

/**
 * @route DELETE /api/user
 * @desc Delete current user
 * @access Private
 */
router.delete(
  '/',
  auth,
  userController.deleteUser
);

// TODO - Comentar algo lol
router.post(
  '/recover-password',
  validateEmail,
  userController.requestPasswordReset
);

router.post(
   '/reset-password',
    validatePassword,
    userController.resetPassword
);

/**
 * @route POST /api/user/invite
 * @desc Invite a team member
 * @access Private
 */
router.post(
  '/invite',
  [auth, validateEmail],
  userController.inviteTeamMember
);

module.exports = router;