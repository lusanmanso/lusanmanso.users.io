// File: controllers/userController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

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
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const maxAttempts = 3; // Maximum number of attempts to validate the code

        // Encrypt the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

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

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

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

        // Here we would normally send an email with the verification code
        // For this practice, the code can be found in the database

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// Other controller methods would go here
// exports.verifyEmail = async (req, res) => { ... }
// exports.loginUser = async (req, res) => { ... }
// etc.