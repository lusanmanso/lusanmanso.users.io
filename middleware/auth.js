// File: middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify the JWT token
 */
module.exports = function(req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');

  // Check if no token
  if (!authHeader) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Check if follows Bearer format
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({message: 'Invalid token format, must use Bearer'});
  }
  // Extract the token (remove 'Bearer' prefix)
  const token = authHeader.split(' ')[1];

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user to request object
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};