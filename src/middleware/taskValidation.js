const { body, query } = require('express-validator');

// Validation for task creation
const validateTaskCreation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('priority')
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  
  body('assignedToId')
    .optional()
    .isString()
    .withMessage('Assigned user ID must be a valid string')
    .matches(/^USR-[0-9]{8}-[0-9]{5}$/)
    .withMessage('User ID must be in the format USR-YYYYMMDD-XXXXX'),
  
  body('departmentId')
    .isString()
    .withMessage('Department ID must be a valid string')
    .matches(/^DEP-[0-9]{8}-[0-9]{5}$/)
    .withMessage('Department ID must be in the format DEP-YYYYMMDD-XXXXX')
];

// Validation for task update
const validateTaskUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Status must be pending, in_progress, completed, or cancelled'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  
  body('assignedToId')
    .optional()
    .isString()
    .withMessage('Assigned user ID must be a valid string')
    .matches(/^USR-[0-9]{8}-[0-9]{5}$/)
    .withMessage('User ID must be in the format USR-YYYYMMDD-XXXXX')
];

// Validation for task query parameters
const validateTaskQuery = [
  query('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Status must be pending, in_progress, completed, or cancelled'),
  
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  
  query('departmentId')
    .optional()
    .isString()
    .withMessage('Department ID must be a valid string')
    .matches(/^DEP-[0-9]{8}-[0-9]{5}$/)
    .withMessage('Department ID must be in the format DEP-YYYYMMDD-XXXXX'),
  
  query('assignedToId')
    .optional()
    .isString()
    .withMessage('Assigned user ID must be a valid string')
    .matches(/^USR-[0-9]{8}-[0-9]{5}$/)
    .withMessage('User ID must be in the format USR-YYYYMMDD-XXXXX')
];

module.exports = {
  validateTaskCreation,
  validateTaskUpdate,
  validateTaskQuery
}; 