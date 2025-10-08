const express = require('express');
const { body } = require('express-validator');
const { 
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment
} = require('../controllers/departmentController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateDepartmentCreate = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Department name must be at least 2 characters long'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
];

const validateDepartmentUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Department name must be at least 2 characters long'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('headId')
    .optional()
    .isString()
];

// Routes
router.post('/', 
  authenticateToken, 
  authorizeRole(['admin']), 
  validateDepartmentCreate, 
  createDepartment
);

router.get('/', 
  getAllDepartments
);

router.get('/:id', 
  authenticateToken, 
  getDepartmentById
);

router.put('/:id', 
  authenticateToken, 
  authorizeRole(['admin']), 
  validateDepartmentUpdate, 
  updateDepartment
);

router.delete('/:id', 
  authenticateToken, 
  authorizeRole(['admin']), 
  deleteDepartment
);

module.exports = router; 