// File: routes/userRoutes.js
const express = require('express');
const { validateEmail, validatePassword, validateVerificationCode, validatePersonalData, validateCompanyData, validateInviteUser, validateForgotPassword, validateUpdateCompany, validateUpdateUser, validateUserLogin, validateEmailVerification, validateUserRegistration, validateResetPassword } = require('../validators/userValidators');
const userController = require('../controllers/userController');
const logoController = require('../controllers/logoController');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/fileUpload');
const { handleMulterErrors } = require('../middleware/handleError');

const router = express.Router();

/**
 * @route POST /api/user/register
 * @desc Register a new user
 * @access Public
 */
router.post(
   '/register',
   validateUserRegistration,
   userController.registerUser
);

/**
 * @route PUT/api/user/validation
 * @desc Verify user email with code
 * @access Private
 */
router.put(
   '/validation',
   [auth, validateEmailVerification],
   userController.verifyEmail
);

/**
 * @route POST /api/user/login
 * @desc Login user and get token
 * @access Public
 */
router.post(
   '/login',
   validateUserLogin,
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
   [auth, ...validateUpdateUser],
   userController.updatePersonalData
);

/**
 * @route PATCH /api/user/company
 * @desc Update company data
 * @access Private
 */
router.patch(
   '/company',
   [auth, ...validateUpdateCompany],
   userController.updateCompanyData
);

/**
 * @route PATCH/api/user/logo
 * @desc Upload company logo
 * @access Private
 */
router.patch(
   '/logo',
   [auth, upload.single('logo'), handleMulterErrors],
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

router.post(
   '/recover-password',
   validateForgotPassword,
   userController.requestPasswordReset
);

router.post(
   '/reset-password',
   validateResetPassword,
   userController.resetPassword
);

/**
 * @route POST /api/user/invite
 * @desc Invite a team member
 * @access Private
 */
router.post(
   '/invite',
   [auth, validateInviteUser],
   userController.inviteTeamMember
);

module.exports = router;
