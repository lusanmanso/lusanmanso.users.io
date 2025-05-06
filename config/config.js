// File: config/config.js
require('dotenv').config();

// Validation of required environment values
const requiredEnvVars = [
   'PORT',
   'MONGODB_URI',
   'JWT_SECRET',
   'EMAIL',
   'CLIENT_ID',
   'CLIENT_SECRET',
   'REFRESH_TOKEN'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
   throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

module.exports = {
   port: process.env.PORT || 3000,
   mongoURI: process.env.MONGODB_URI,
   jwtSecret: process.env.JWT_SECRET,
   environment: process.env.NODE_ENV || 'development',
   email: {
      address: process.env.EMAIL,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: process.env.REFRESH_TOKEN,
      redirectUri: process.env.REDIRECT_URI || 'https://developers.google.com/oauthplayground'
   },
   slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
   },
   rateLimits: {
      auth: {
         windowMs: 15 * 60 * 1000, // 15 minutos
         max: 5 // 5 intentos
      },
      general: {
         windowMs: 15 * 60 * 1000,
         max: 100
      }
   },
   storage: {
      type: process.env.STORAGE_TYPE || 'local', // 'local' o 's3'
      localPath: 'uploads/logos/',
      s3: {
         bucketName: process.env.S3_BUCKET_NAME,
         region: process.env.S3_REGION
      }
   }
};
