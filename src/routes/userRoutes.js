const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { body } = require('express-validator');
const { validationResult } = require('express-validator');
const { User, Department } = require('../models');
const { Op } = require('sequelize');
const passwordValidator = require('../utils/passwordValidator');

// Validation middleware
const validateUser = [
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
        if (typeof value !== 'string' || !value.match(/^DEP-[0-9]{8}-[0-9]{5}$/)) {
          throw new Error('Department ID must be in the format DEP-YYYYMMDD-XXXXX');
        }
      }
      return true;
    })
];

// Update validation middleware (password optional, fields optional)
const validateUserUpdate = [
  body('firstname')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastname')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format'),
  body('password')
    .optional({ nullable: true })
    .trim()
    .custom((value) => {
      if (value && value !== '') {
        const validation = passwordValidator.validate(value);
        if (!validation.isValid) {
          throw new Error(validation.errors[0]);
        }
      }
      return true;
    }),
  body('role')
    .optional()
    .isIn(['admin', 'department_head', 'employee'])
    .withMessage('Invalid role'),
  body('departmentId')
    .optional()
    .custom((value, { req }) => {
      if (typeof value === 'undefined') return true;
      if (!value) {
        throw new Error('Department is required for this role');
      }
      if (typeof value !== 'string' || !value.match(/^DEP-[0-9]{8}-[0-9]{5}$/)) {
        throw new Error('Department ID must be in the format DEP-YYYYMMDD-XXXXX');
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

// Get all users (admin only)
router.get('/',
  authenticateToken,
  async (req, res) => {
    try {
      const { role } = req.query;
      const { status } = req.query;
      const whereClause = {};
      
      // Filter by status if provided
      if (status) {
        whereClause.status = status;
      }
      
      // Debug log for troubleshooting
      console.log('GET /users called by:', req.user.role, 'userId:', req.user.id, 'query:', req.query);
      
      // Only admin can get all users
      if (req.user.role === 'admin') {
        const users = await User.findAll({
          where: whereClause,
          attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
          include: [{
            model: Department,
            attributes: ['id', 'name']
          }]
        });
        return res.json(users);
      } else if (req.user.role === 'department_head') {
        if (role === 'admin') {
          // Allow department heads to fetch admin users
          const admins = await User.findAll({ where: { role: 'admin' } });
          return res.json(admins);
        }
        if (role === 'department_head') {
          // Allow department heads to fetch all department heads (except themselves)
          const deptHeads = await User.findAll({
            where: {
              role: 'department_head',
              id: { [Op.ne]: req.user.id }
            },
            attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
            include: [{
              model: Department,
              attributes: ['id', 'name']
            }]
          });
          return res.json(deptHeads);
        }
        // Default: only employees in their own department
        whereClause.role = 'employee';
        whereClause.departmentId = req.user.departmentId;
        const users = await User.findAll({
          where: whereClause,
          attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
          include: [{
            model: Department,
            attributes: ['id', 'name']
          }]
        });
        return res.json(users);
      } else {
        return res.status(403).json({ error: 'Not authorized to view users' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get user profile
router.get('/profile',
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
        include: [{
          model: Department,
          attributes: ['id', 'name']
        }]
      });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Create new user (admin or department_head for their own department)
router.post('/',
  authenticateToken,
  validateUser,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { firstname, lastname, email, password, role, departmentId } = req.body;
      // Admin can create any user
      if (req.user.role === 'admin') {
        const user = await User.create({
          firstname, lastname, email, password, role, departmentId, status: 'approved'
        });
        const createdUser = await User.findByPk(user.id, {
          attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
          include: [{ model: Department, attributes: ['id', 'name'] }]
        });
        return res.status(201).json(createdUser);
      }
      // Department head can only create employees in their own department
      if (
        req.user.role === 'department_head' &&
        role === 'employee' &&
        departmentId === req.user.departmentId
      ) {
        const user = await User.create({
          firstname, lastname, email, password, role, departmentId, status: 'approved'
        });
        const createdUser = await User.findByPk(user.id, {
          attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
          include: [{ model: Department, attributes: ['id', 'name'] }]
        });
        return res.status(201).json(createdUser);
      }
      return res.status(403).json({ error: 'Not authorized to create this user' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Update user (admin, self, or department_head for their own employees)
router.put('/:id',
  authenticateToken,
  validateUserUpdate,
  handleValidationErrors,
  async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      // Admin can update anyone
      if (req.user.role === 'admin') {
        const { firstname, lastname, email, password, role, departmentId } = req.body;
        const updateData = {};
        if (typeof firstname !== 'undefined') updateData.firstname = firstname;
        if (typeof lastname !== 'undefined') updateData.lastname = lastname;
        if (typeof email !== 'undefined') updateData.email = email;
        if (typeof password !== 'undefined' && password !== '') updateData.password = password;
        if (typeof role !== 'undefined') updateData.role = role;
        if (typeof departmentId !== 'undefined') updateData.departmentId = departmentId;
        await user.update(updateData);
        const updatedUser = await User.findByPk(req.params.id, {
          attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
          include: [{ model: Department, attributes: ['id', 'name'] }]
        });
        return res.json(updatedUser);
      }
      // Self-update
      if (req.user.id === user.id) {
        const { firstname, lastname, email, password } = req.body;
        const updateData = {};
        if (typeof firstname !== 'undefined') updateData.firstname = firstname;
        if (typeof lastname !== 'undefined') updateData.lastname = lastname;
        if (typeof email !== 'undefined') updateData.email = email;
        if (typeof password !== 'undefined' && password !== '') updateData.password = password;
        await user.update(updateData);
        const updatedUser = await User.findByPk(req.params.id, {
          attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
          include: [{ model: Department, attributes: ['id', 'name'] }]
        });
        return res.json(updatedUser);
      }
      // Department head can update employees in their own department
      if (
        req.user.role === 'department_head' &&
        user.role === 'employee' &&
        user.departmentId === req.user.departmentId
      ) {
        const { firstname, lastname, email, password } = req.body;
        const updateData = {};
        if (typeof firstname !== 'undefined') updateData.firstname = firstname;
        if (typeof lastname !== 'undefined') updateData.lastname = lastname;
        if (typeof email !== 'undefined') updateData.email = email;
        if (typeof password !== 'undefined' && password !== '') updateData.password = password;
        await user.update(updateData);
        const updatedUser = await User.findByPk(req.params.id, {
          attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
          include: [{ model: Department, attributes: ['id', 'name'] }]
        });
        return res.json(updatedUser);
      }
      return res.status(403).json({ error: 'Not authorized to update this user' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Delete user (admin or department_head for their own employees)
router.delete('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      // Admin can delete anyone
      if (req.user.role === 'admin') {
        await user.destroy();
        return res.json({ message: 'User deleted successfully' });
      }
      // Department head can delete employees in their own department
      if (
        req.user.role === 'department_head' &&
        user.role === 'employee' &&
        user.departmentId === req.user.departmentId
      ) {
        await user.destroy();
        return res.json({ message: 'User deleted successfully' });
      }
      return res.status(403).json({ error: 'Not authorized to delete this user' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Approve user (admin only)
router.patch('/:id/approve', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.update({ status: 'approved' });
    const updatedUser = await User.findByPk(req.params.id, {
      attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
      include: [{
        model: Department,
        attributes: ['id', 'name']
      }]
    });
    res.json({ message: 'User approved successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject user (admin only) - automatically deletes the user
router.patch('/:id/reject', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Store user info before deletion for response
    const userInfo = {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId
    };
    
    // Delete the user account
    await user.destroy();
    
    res.json({ 
      message: 'User rejected and account deleted successfully', 
      user: userInfo 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users in a department (for assignee dropdown)
router.get('/department/:departmentId',
  authenticateToken,
  async (req, res) => {
    try {
      const { departmentId } = req.params;
      // Only admin or department_head for their own department can access
      if (
        req.user.role !== 'admin' &&
        !(req.user.role === 'department_head' && req.user.departmentId === departmentId)
      ) {
        return res.status(403).json({ error: 'Not authorized to view this department' });
      }
      const users = await User.findAll({
        where: { departmentId },
        attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status']
      });
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get user by ID (admin can fetch any user, department_head can fetch users in their department or any admin/department_head)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'departmentId', 'status'],
      include: [{ model: Department, attributes: ['id', 'name'] }]
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Admin can fetch any user
    if (req.user.role === 'admin') {
      return res.json(user);
    }
    // Department head can fetch users in their department or any admin/department_head
    if (req.user.role === 'department_head') {
      if (
        user.role === 'admin' ||
        user.role === 'department_head' ||
        user.departmentId === req.user.departmentId
      ) {
        return res.json(user);
      }
      return res.status(403).json({ error: 'Not authorized to view this user' });
    }
    // Employees can only fetch their own profile (handled by /profile)
    return res.status(403).json({ error: 'Not authorized to view this user' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 