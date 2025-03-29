// File: utils/handleEmail.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

/**
 * Create an OAuth2 authenticated transporter for sending emails
 * @returns {Promise<nodemailer.Transporter>} Configured nodemailer transporter
 */
const createTransporter = async () => {
    const oauth2Client = new OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.REDIRECT_URI,
    );
    oauth2Client.setCredentials({refresh_token: process.env.REFRESH_TOKEN});

    const accessToken = await new Promise((resolve, reject) => {
        oauth2Client.getAccessToken((err, token) => {
            if (err) {
                reject('Error retrieving access token');
            }
            resolve(token);
        });
    });

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.EMAIL,
            accessToken,
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            refreshToken: process.env.REFRESH_TOKEN,
        }
    });

    return transporter;
};

/**
 * Send verification email with code
 * @param {string} email - Recipient email address
 * @param {string} code - Verification code
 * @returns {Promise<any>} Result of email sending
 */
exports.sendVerificationEmail = async (email, code) => {
    try {
        const transporter = await createTransporter();

        const mailOptions = {
            from: `"API" <$process.env.EMAIL)>`,
            to: email,
            subject: "Email verification",
            html: `<h2> ${code} </h2>`
        };

        return await transporter.sendEmail(emailOptions);

    } catch (error) {
        console.log('Error sending verification email');
        throw error;
    }
};