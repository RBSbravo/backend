const express = require('express');
const router = express.Router();
const { ticketController } = require('../controllers/ticketController');
const { authenticateToken } = require('../middleware/auth');

// Get all tickets
router.get('/', authenticateToken, ticketController.getAllTickets);

// Get assigned tickets
router.get('/assigned', authenticateToken, ticketController.getAssignedTickets);

// Get forwarded tickets
router.get('/forwarded-to-me', authenticateToken, ticketController.getTicketsForwardedToMe);

// Get ticket statistics
router.get('/stats/analytics', authenticateToken, ticketController.getTicketStats);

// Test forwarding fields
router.get('/:id/test-fields', authenticateToken, ticketController.testForwardFields);

// Get ticket by ID
router.get('/:id', authenticateToken, ticketController.getTicketById);

// Create new ticket
router.post('/', authenticateToken, ticketController.createTicket);

// Update ticket
router.put('/:id', authenticateToken, ticketController.updateTicket);

// Delete ticket
router.delete('/:id', authenticateToken, ticketController.deleteTicket);

// Forwarding routes
router.post('/:id/forward', authenticateToken, ticketController.forwardTicket);
router.patch('/:id/forward/respond', authenticateToken, ticketController.respondToForward);

module.exports = router; 