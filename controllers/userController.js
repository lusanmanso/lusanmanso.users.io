// File: controllers/userController.js
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
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Check if the user already exists and is verified
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.isEmailVerified) {
            return res.status(409).json({
                message: 'Email is already registered and verified'
            });
        }

        // If the user exists but is not verified, delete it to create a new one
        if (existingUser) {
            await User.deleteOne({ _id: existingUser._id });
        }

        // Generate 6-digit verification code
        const verificationCode = authService.generateVerificationCode();
        const maxAttempts = 3; // Maximum number of attempts to validate the code

        // Encrypt the password
        const hashedPassword = await authService.hashPassword(password);

        // Create new user
        const newUser = new User({
            email,
            password: hashedPassword,
            verificationCode,
            verificationAttempts: 0,
            maxVerificationAttempts: maxAttempts,
            isEmailVerified: false,
            role: 'user', // Default role
        });

        // Save user to database
        await newUser.save();

        // Generate JWT
        const payload = {
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role
            }
        };

        const token = authService.generateToken(payload);

        // Send verification email
        try {
            await handleEmail.sendVerificationEmail(email, verificationCode);
            console.log(`Verification email sent to ${email}`);
        } catch (emailError) {
            console.error('Error sending verification mail: ', emailError);
        }

        // console.log(`Verification code for ${email}: ${verificationCode}`);

        // Successful response
        res.status(201).json({
            user: {
                email: newUser.email,
                status: newUser.isEmailVerified ? 'verified' : 'pending',
                role: newUser.role,
                id: newUser.id
            },
            token
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Verify user email with verification code
    * @param {Object} req - Express request object
    * @param {Object} res - Express response object
    */
exports.verifyEmail = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { code } = req.body;
        const userId = req.user.id;

        // Find user by ID
        const user = await User.findById(userId);

        // If user does not exist
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If user is already verified
        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        // Check if maximum attempts exceeded
        if (user.verificationAttempts >= user.maxVerificationAttempts) {
            return res.status(400).json({
                message: 'Maximum verification attempts exceeded. Please request a new code.'
            });
        }

        user.verificationAttempts += 1;

        if (user.verificationCode !== code) {
            await user.save();
            return res.status(400).json({
                message: 'Invalid verification code',
                attemptsLeft: user.maxVerificationAttempts - user.verificationAttempts
            });
        }

        // Update user as verified
        user.isEmailVerified = true;
        user.verificationCode = "VERIFIED";
        await user.save();

        // Return success response
        return res.status(200).json({
            message: 'Email verified successfully',
            user: {
                email: user.email,
                status: 'verified',
                role: user.role,
                id: user.id
            }
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
            return res.status(400).json({ errors: errors.array() });
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
                message: 'Email not verified. Please verify your email before logging in.',
                needsVerification: true
            });
        }

        // Check password
        const isMatch = await authService.comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT
        const payload = {
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        };

        const token = authService.generateToken(payload);

        // Return success responde
        res.status(200).json({
            user: {
                email: user.email,
                status: user.isEmailVerified ? 'verified' : 'pending',
                role: user.role,
                id: user.id
            },
            token
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({message: 'Server error' });
    }
};

/**
 * Get current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCurrentUser = async (req, res) => {
    try {
        // Get user from database (exclude password)
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.status(200).json({
            user: {
                email: user.email,
                status: user.isEmailVerified ? 'verified' : 'pending',
                role: user.role,
                id: user.id,
                // Include other user fields as needed
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** 
 * Update user personal data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updatePersonalData = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const userId = req.user.id;
        const { firstName, lastName, nif } = req.body;

        // Find user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }


        // Update personal data
        user.firstName = firstName;
        user.lastName = lastName;
        user.nif = nif;

        await user.save();
        
        res.status(200).json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                nif: user.nif
            }
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
            return res.status(400).json({ errors: errors.array() });
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
        const softDelete = req.query.soft != 'false'; // Default is soft delete

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }

        if (softDelete) { // Using mongoose-delete
            await user.delete();
            return res.status(200).json({ message: 'User deleted temporarilly' });
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
        const { email } = req.body;
        
        // Verificar que el email existe
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Email not found' });
        }

        // Generar código de recuperación
        const resetCode = authService.generateVerificationCode();
        const resetExpires = Date.now() + 3600000; // 1 hora
        
        // Guardar código en la base de datos
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
        
        res.status(200).json({ message: 'If the email exists you will recieve a reset code' });
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
        
              // Validate new password
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
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

exports.inviteTeamMember = async (req, res) => {
    try {
        const { email, role } = req.body;
        const ownerId = req.user.id;
        
        // Verificar el rol
        if (role && role !== 'guest') {
            return res.status(400).json({ message: 'Los usuarios invitados solo pueden tener rol "guest"' });
        }
        
        // Obtener datos de la compañía del propietario
        const owner = await User.findById(ownerId);
        if (!owner || !owner.company) {
            return res.status(400).json({ message: 'Debe configurar los datos de su compañía antes de invitar miembros' });
        }
        
        // Verificar si el email ya está registrado
        let invitedUser = await User.findOne({ email });
        
        if (invitedUser) {
            // Si ya existe, asociarlo a la compañía
            invitedUser.role = 'guest';
            invitedUser.companyId = owner.company._id;
            await invitedUser.save();
            
            return res.status(200).json({ 
                message: 'Usuario existente invitado a la compañía',
                user: {
                    email: invitedUser.email,
                    role: invitedUser.role
                }
            });
        }
        
        // Generar contraseña aleatoria
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await authService.hashPassword(tempPassword);
        
        // Crear nuevo usuario con rol guest
        const verificationCode = authService.generateVerificationCode();
        const newUser = new User({
            email,
            password: hashedPassword,
            role: 'guest',
            companyId: owner.company._id,
            verificationCode,
            isEmailVerified: false
        });
        
        await newUser.save();
        
        // Enviar email de invitación (implementar en handleEmail.js)
        // await handleEmail.sendInvitationEmail(email, tempPassword, verificationCode);
        
        res.status(201).json({
            message: 'Invitación enviada con éxito',
            user: {
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Error del servidor' });
    }
};