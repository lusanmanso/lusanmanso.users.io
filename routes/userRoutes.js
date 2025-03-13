// File: routes/userRoutes.js
const express = require('express');
const { validateEmail, validatePassword } = require('../validators/userValidators');
const userController = require('../controllers/userController');

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

// Other routes would go here
// router.put('/validation', [auth, validateVerificationCode], userController.verifyEmail);
// router.post('/login', [validateEmail, validatePassword], userController.loginUser);
// etc.

module.exports = router;