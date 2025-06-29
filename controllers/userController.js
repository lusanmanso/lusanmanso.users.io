const { validationResult } = require('express-validator');
const User = require('../models/User');
const authService = require('../services/authService');
const handleEmail = require('../utils/handleEmail');

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.registerUser = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                type: 'VALIDATION_ERROR',
                data: { errors: errors.array() }
            });
        }

        const { name, surname, email, password, passwordConfirm } = req.body;

        // Check if the user already exists and is verified
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.isEmailVerified) {
            return res.status(409).json({
                message: 'Email is already registered and verified'
            });
        }

        // If the user exists but is not verified, delete it to create a new one
        if (existingUser && !existingUser.isEmailVerified) {
            await User.deleteOne({ _id: existingUser._id });
        }

        // Generate 6-digit verification code
        const verificationCode = authService.generateVerificationCode();
        const maxAttempts = 3;

        // Encrypt the password
        const hashedPassword = await authService.hashPassword(password);

        // Create new user
        const newUser = new User({
            name,
            surname,
            email,
            password: hashedPassword,
            verificationCode,
            verificationAttempts: 0,
            maxVerificationAttempts: maxAttempts,
            isEmailVerified: false,
            role: 'user',
        });

        // Save user to database
        await newUser.save();

        // Generate JWT
        const payload = {
            id: newUser.id,
            email: newUser.email,
            role: newUser.role
        };

        const token = authService.generateToken(payload);

        // Send verification email
        try {
            await handleEmail.sendVerificationEmail(email, verificationCode);
            console.log(`Verification email sent to ${email}`);
        } catch (emailError) {
            console.error('Error sending verification mail: ', emailError);
        }

        // Successful response
        res.status(201).json({
            message: 'User registered successfully. Verification email sent.',
            user: {
                email: newUser.email,
                status: newUser.isEmailVerified ? 'verified' : 'pending'
            },
            token
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Verify user email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.verifyEmail = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                type: 'VALIDATION_ERROR',
                data: { errors: errors.array() }
            });
        }

        const { code } = req.body;
        const userId = req.user.id;

        // Find user by ID from token
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if email is already verified
        if (user.isEmailVerified) {
            return res.status(400).json({
                message: 'Email is already verified.'
            });
        }

        // Check if max attempts exceeded
        if (user.verificationAttempts >= user.maxVerificationAttempts) {
            return res.status(400).json({
                message: 'Maximum verification attempts reached. Please request a new code.'
            });
        }

        // Check verification code
        if (user.verificationCode !== code) {
            user.verificationAttempts += 1;
            await user.save();
            return res.status(400).json({
                message: 'Incorrect verification code'
            });
        }

        // Update user as verified
        user.isEmailVerified = true;
        user.verificationCode = null;
        user.verificationAttempts = 0;
        await user.save();

        // Return success response
        return res.status(200).json({
            message: 'Email verified successfully'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.loginUser = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                type: 'VALIDATION_ERROR',
                data: { errors: errors.array() }
            });
        }

        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });

        // If user does not exist
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            return res.status(400).json({
                message: 'Email not verified. Please verify your email to log in.'
            });
        }

        // Check password
        const isMatch = await authService.comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        const token = authService.generateToken(payload);

        // Return success response
        res.status(200).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                status: user.isEmailVerified ? 'verified' : 'pending'
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Get current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCurrentUser = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find user by ID from token
        const user = await User.findById(userId).select('-password -verificationCode');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Update personal data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updatePersonalData = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                type: 'VALIDATION_ERROR',
                data: { errors: errors.array() }
            });
        }

        const userId = req.user.id;
        const updateData = req.body;

        // Find and update user
        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password -verificationCode');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            message: 'Personal data updated successfully',
            user
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Update company data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateCompanyData = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                type: 'VALIDATION_ERROR',
                data: { errors: errors.array() }
            });
        }

        const userId = req.user.id;
        const { company } = req.body;

        // Find user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user is autonomous
        if (company.isAutonomous) {
            // If user is autonomous, use personal data for company
            if (!user.firstName || !user.lastName || !user.nif) {
                return res.status(400).json({
                    message: 'For autonomous users, you must first complete your personal data'
                });
            }

            // Set company data using personal data
            user.company = {
                name: `${user.firstName} ${user.lastName}`,
                cif: user.nif, // Using NIF as CIF for autonomous
                address: company.address,
                isAutonomous: true
            };
        } else {
            // For regular companies, use provided data
            user.company = company;
        }

        await user.save();

        res.status(200).json({
            message: 'Company data updated successfully',
            user: {
                id: user.id,
                email: user.email,
                company: user.company
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Delete user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteUser = async (req, res) => {
    try {
        const userId = req.user.id;
        const softDelete = req.query.soft !== 'false'; // Default is soft delete

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }

        if (softDelete) { // Using mongoose soft-delete
            await user.delete();
            return res.status(200).json({ message: 'User deleted temporarily' });
        } else { // Hard delete
            await User.findByIdAndDelete(userId);
            return res.status(200).json({ message: 'User deleted permanently' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Request password reset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.requestPasswordReset = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                type: 'VALIDATION_ERROR',
                data: { errors: errors.array() }
            });
        }

        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Email not found' });
        }

        const resetCode = authService.generateVerificationCode();
        const resetExpires = Date.now() + 3600000; // 1 hora

        user.passwordResetCode = resetCode;
        user.passwordResetExpires = resetExpires;
        await user.save();

        // Send email with code
        try {
            await handleEmail.sendPasswordResetEmail(email, resetCode);
            console.log(`Password reset email sent to ${email}`);
        } catch (emailError) {
            console.error(`Error sending password reset email: `, emailError);
        }

        res.status(200).json({ message: 'If the email exists you will receive a reset code' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Reset password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.resetPassword = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                type: 'VALIDATION_ERROR',
                data: { errors: errors.array() }
            });
        }

        const { email, code, newPassword } = req.body;

        // Verify user exists and code is valid
        const user = await User.findOne({
            email,
            passwordResetCode: code,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired code' });
        }

        // Update password
        const hashedPassword = await authService.hashPassword(newPassword);
        user.password = hashedPassword;
        user.passwordResetCode = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Invite a team member to the company
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.inviteTeamMember = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                type: 'VALIDATION_ERROR',
                data: { errors: errors.array() }
            });
        }

        const { email, role } = req.body;
        const ownerId = req.user.id;

        // Verificar el rol
        if (role && role !== 'guest') {
            return res.status(400).json({ message: 'Invited users can only have "guest" role' });
        }

        const owner = await User.findById(ownerId);
        if (!owner || !owner.company) {
            return res.status(400).json({ message: 'You must configure your company data before inviting members' });
        }

        let invitedUser = await User.findOne({ email });

        if (invitedUser) {
            invitedUser.role = 'guest';
            invitedUser.companyId = owner.company._id;
            await invitedUser.save();

            try {
                await handleEmail.sendInvitationEmail(
                    email,
                    "User already registered",
                    "N/A",
                    owner.company.name
                );
            } catch (emailError) {
                console.error('Error sending invitation notification:', emailError);
            }

            return res.status(200).json({
                message: 'Existing user invited to the company',
                user: {
                    email: invitedUser.email,
                    role: invitedUser.role
                }
            });
        }

        // Generate random password
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await authService.hashPassword(tempPassword);

        // Create new user with guest role
        const verificationCode = authService.generateVerificationCode();
        const newUser = new User({
            email,
            password: hashedPassword,
            role: 'guest',
            companyId: owner.company._id,
            verificationCode,
            isEmailVerified: false,
            maxVerificationAttempts: 3,
            verificationAttempts: 0
        });

        await newUser.save();

        try {
            await handleEmail.sendInvitationEmail(
                email,
                tempPassword,
                verificationCode,
                owner.company.name
            );
            console.log(`Invitation email sent to ${email}`);
        } catch (emailError) {
            console.error('Error sending invitation email:', emailError);
        }

        res.status(201).json({
            message: 'Invitation sent',
            user: {
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};
