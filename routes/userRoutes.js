// File: routes/userRoutes.js
const express = require('express');
const { validateEmail, validatePassword, validateVerificationCode, validateCompanyData } = require('../validators/userValidators');
const logoController = require('../controllers/logoController');
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const upload = require('..middleware/upload');

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
 * desc Login user and get token
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
  logoController.uploadLogo
);

module.exports = router;