const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User, UserSession } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter, strictAuthLimiter, passwordResetLimiter } = require('../middleware/rateLimiting');
const { 
  register,
  login,
  getProfile, 
  forgotPassword, 
  resetPassword, 
  verifyResetToken,
  changePassword,
  testEmail
} = require('../controllers/authController');
const validateSession = require('../middleware/sessionValidation');
const passwordValidator = require('../utils/passwordValidator');

// Validation middleware
const validateRegistration = [
  body('firstname')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastname')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),
  
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .custom((value) => {
      const validation = passwordValidator.validate(value);
      if (!validation.isValid) {
        throw new Error(validation.errors[0]);
      }
      return true;
    }),
  
  body('role')
    .isIn(['admin', 'department_head', 'employee'])
    .withMessage('Invalid role'),
  
  body('departmentId')
    .custom((value, { req }) => {
      if (req.body.role === 'department_head' || req.body.role === 'employee') {
        if (!value) {
          throw new Error('Department is required for this role');
        }
        // Check if it's a valid string ID format
        if (typeof value !== 'string' || !value.match(/^DEP-[0-9]{8}-[0-9]{5}$/)) {
          throw new Error('Department ID must be a valid string in format DEP-YYYYMMDD-XXXXX');
        }
      } else if (req.body.role === 'admin' && value) {
        // If admin, departmentId should not be provided
        throw new Error('Admin should not have a department');
      }
      return true;
    })
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),
  
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
];

const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
];

const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .custom((value) => {
      const validation = passwordValidator.validate(value);
      if (!validation.isValid) {
        throw new Error(validation.errors[0]);
      }
      return true;
    })
];

const validateChangePassword = [
  body('currentPassword')
    .trim()
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .trim()
    .notEmpty()
    .withMessage('New password is required')
    .custom((value) => {
      const validation = passwordValidator.validate(value);
      if (!validation.isValid) {
        throw new Error(validation.errors[0]);
      }
      return true;
    })
];

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = errors.array()[0];
    return res.status(400).json({ error: error.msg });
  }
  next();
};

// Login route
router.post('/login', authLimiter, validateLogin, handleValidationErrors, login);

// Register route
router.post('/register', authLimiter, validateRegistration, handleValidationErrors, register);

// Get profile route
router.get('/me', authenticateToken, getProfile);
// Alias for frontend compatibility
router.get('/profile', authenticateToken, getProfile);

// Forgot password route
router.post('/forgot-password', passwordResetLimiter, validateForgotPassword, handleValidationErrors, forgotPassword);

// Reset password route
router.post('/reset-password', strictAuthLimiter, validateResetPassword, handleValidationErrors, resetPassword);

// Verify reset token route
router.get('/verify-reset-token/:token', verifyResetToken);

// Change password route
router.post('/change-password', authLimiter, authenticateToken, validateChangePassword, handleValidationErrors, changePassword);

// Test email route (development only)
router.post('/test-email', authLimiter, testEmail);

router.post('/logout', validateSession, async (req, res) => {
  try {
    req.session.isActive = false;
    await req.session.save();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 