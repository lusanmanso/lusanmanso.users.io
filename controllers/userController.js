// File: controllers/userController.js
const { validationResult } = require('express-validator');
const User = require('../models/User');
const authService = require('../services/authService');

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
        console.log(`Verification code for ${email}: ${verificationCode}`);

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

