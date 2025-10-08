const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { validateTaskCreation, validateTaskUpdate, validateTaskQuery } = require('../middleware/taskValidation');
const { createTask, getAllTasks, getTaskById, updateTask, deleteTask, updateTaskStatus, updateTaskPriority, assignTask } = require('../controllers/taskController');

// Create a new task (admin and department head only)
router.post('/',
  authenticateToken,
  authorizeRole(['admin', 'department_head']),
  validateTaskCreation,
  createTask
);

// Get all tasks (with filters)
router.get('/',
  authenticateToken,
  validateTaskQuery,
  getAllTasks
);

// Get task by ID
router.get('/:id',
  authenticateToken,
  getTaskById
);

// Update task
router.put('/:id',
  authenticateToken,
  validateTaskUpdate,
  updateTask
);

// Update task status
router.patch('/:id/status',
  authenticateToken,
  updateTaskStatus
);

// Update task priority
router.patch('/:id/priority',
  authenticateToken,
  updateTaskPriority
);

// Assign task to user
router.patch('/:id/assign',
  authenticateToken,
  assignTask
);

// Delete task (admin and creator allowed by controller logic)
router.delete('/:id',
  authenticateToken,
  deleteTask
);

module.exports = router; 