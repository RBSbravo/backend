const { body } = require('express-validator');
const { validationResult } = require('express-validator');

// Validation middleware
const validateComment = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),
  // Allow either taskId or ticketId, at least one required
  body().custom((value, { req }) => {
    if (!req.body.taskId && !req.body.ticketId) {
      throw new Error('Either taskId or ticketId is required');
    }
    return true;
  }),
  body('taskId')
    .optional()
    .isString()
    .withMessage('Task ID must be a valid string')
    .matches(/^TSK-[0-9]{8}-[0-9]{5}$/)
    .withMessage('Task ID must be in the format TSK-YYYYMMDD-XXXXX'),
  body('ticketId')
    .optional()
    .isString()
    .withMessage('Ticket ID must be a valid string')
    .matches(/^TKT-[0-9]{8}-[0-9]{5}$/)
    .withMessage('Ticket ID must be in the format TKT-YYYYMMDD-XXXXX'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = {
  validateComment
}; 