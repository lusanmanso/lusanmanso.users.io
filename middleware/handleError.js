// File: middleware/handleError.js
const multer = require('multer');
const config = require('../config/config');
const { IncomingWebhook } = require('@slack/webhook'); // Import Slack Webhook

/**
 * Custom class for API errors
 * API Error class for operational errors
 * @class
 * @extends Error
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} type - Error type identifier
 * @param {Object} data - Additional error data
 */
class ApiError extends Error {
   constructor(statusCode, message, type = 'general', data = {}) {
      super(message);
      this.statusCode = statusCode;
      this.type = type;
      this.data = data;
      this.isOperational = true; // Distinguish ApiErrors from unexpected errors
      Error.captureStackTrace(this, this.constructor); // Capture stack trace
   }
}

// Initialize Slack Webhook client if URL is configured
let slackWebhook;
if (config.slack.webhookUrl) {
   slackWebhook = new IncomingWebhook(config.slack.webhookUrl);
} else {
   console.warn('Slack Webhook URL not configured. 5XX error notifications to Slack will be disabled.');
}

/**
 * Asynchronously sends a notification to Slack.
 * Does not throw errors to prevent interrupting the main error handling flow.
 * @async
 * @param {Error} err - The error object.
 * @param {import('express').Request} req - The Express request object.
 */
const sendSlackNotification = async (err, req) => {
   if (!slackWebhook) {
      // console.log('Slack Webhook not initialized, skipping notification.'); // Optional: log if needed
      return;
   }

   try {
      // Construct a more detailed message for Slack
      const errorMessage = `
:boom: *Internal Server Error (5XX)* :boom:
*Timestamp:* ${new Date().toISOString()}
*Environment:* ${config.environment}
*Error Message:* ${err.message}
*Request Path:* ${req.method} ${req.originalUrl}
*Request IP:* ${req.ip}
${req.user ? `*User:* ${req.user.id} (${req.user.email || 'N/A'})` : ''}
*Stack Trace:*
\`\`\`
${err.stack || 'No stack trace available.'}
\`\`\`
        `;

      await slackWebhook.send({
         text: `An internal server error (5XX) occurred in ${config.environment} environment.`,
         blocks: [
            {
               type: 'header',
               text: {
                  type: 'plain_text',
                  text: ':rotating_light: Internal Server Error (5XX)',
                  emoji: true,
               },
            },
            {
               type: 'section',
               fields: [
                  { type: 'mrkdwn', text: `*Timestamp:*\n${new Date().toISOString()}` },
                  { type: 'mrkdwn', text: `*Environment:*\n${config.environment}` },
                  { type: 'mrkdwn', text: `*Request Path:*\n${req.method} ${req.originalUrl}` },
                  { type: 'mrkdwn', text: `*Request IP:*\n${req.ip}` },
                  ...(req.user ? [{ type: 'mrkdwn', text: `*User ID:*\n${req.user.id}` }] : []),
                  ...(req.user?.email ? [{ type: 'mrkdwn', text: `*User Email:*\n${req.user.email}` }] : [])
               ],
            },
            {
               type: 'section',
               text: {
                  type: 'mrkdwn',
                  text: `*Error Message:*\n${err.message}`,
               },
            },
            {
               type: 'divider',
            },
            {
               type: 'section',
               text: {
                  type: 'mrkdwn',
                  text: '*Stack Trace:*\n```' + (err.stack || 'No stack trace available.') + '```',
               },
            },
         ],
      });
      console.log('5XX error notification sent to Slack.');
   } catch (slackError) {
      console.error('Error sending Slack notification:', slackError);
      // Do not let Slack notification failure interrupt the response to the client
   }
};


/**
 * Handle multer errors
 * @param {Error} err - Multer error object
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Next middleware function
 */
exports.handleMulterErrors = (err, req, res, next) => {
   if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
         // Using ApiError for consistent error structure
         return next(new ApiError(400, 'File too large. Max size is 2MB (as configured in fileUpload middleware).', 'file_size_limit'));
      }
      return next(new ApiError(400, `Upload error: ${err.message}`, 'file_upload_error'));
   } else if (err) { // If it's another error but occurred during multer processing
      return next(err);
   }
   next(); // No error occurred, continue
};

/**
 * Global API error handler
 * @param {Error} err - Error object
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Next middleware function (unused here but required by Express)
 */
exports.handleApiErrors = (err, req, res, next) => {
   let errorToRespond = err;

   // If it's not an instance of our ApiError, it's an unexpected error (likely 500)
   if (!(err instanceof ApiError)) {
      console.error('UNHANDLED ERROR:', err); // Log the full error for unexpected issues

      // Send Slack notification for this unhandled/non-operational error which will be a 5XX
      // Ensure this is done asynchronously and doesn't block the response
      sendSlackNotification(err, req).catch(console.error);

      errorToRespond = new ApiError(
         500,
         config.environment === 'production' ? 'An internal server error occurred.' : err.message,
         'internal_server_error',
         config.environment === 'development' ? { stack: err.stack } : {}
      );
   } else if (err.statusCode >= 500 && err.statusCode <= 599) {
      // If it IS an ApiError but it's a 5XX error, also send to Slack
      console.error('OPERATIONAL 5XX ERROR:', err);
      sendSlackNotification(err, req).catch(console.error);
   }


   // Construct the response object
   const response = {
      success: false,
      message: errorToRespond.message,
      type: errorToRespond.type,
      ...(errorToRespond.data && Object.keys(errorToRespond.data).length > 0 && { data: errorToRespond.data }),
   };

   // Add stack trace in development for all errors (ApiError or otherwise)
   if (config.environment === 'development' && errorToRespond.stack) {
      response.stack = errorToRespond.stack;
   }
   // Add stack trace to operational 5xx errors in development even if they were ApiErrors
   if (config.environment === 'development' && err.statusCode >= 500 && err.stack && !response.stack) {
      response.stack = err.stack;
   }


   return res.status(errorToRespond.statusCode || 500).json(response);
};

/**
 * Wrap async controllers to catch and forward errors to the global error handler.
 * @param {Function} fn - Async controller function
 * @returns {Function} Wrapped function that calls next(error) on promise rejection.
 */
exports.asyncHandler = (fn) => (req, res, next) => {
   Promise.resolve(fn(req, res, next)).catch(next); // Forwards errors to handleApiErrors
};

exports.ApiError = ApiError;
