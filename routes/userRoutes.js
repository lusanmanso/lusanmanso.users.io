// File: routes/userRoutes.js
const express = require('express');
const { validateEmail, validatePassword, validateVerificationCode } = require('../validators/userValidators');
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/user/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  [validateEmail, validatePassword, validateVerificationCode],
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

module.exports = router;