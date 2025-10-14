const { Ticket, User, Department, Comment, Notification, sequelize } = require('../models');
const IDGenerator = require('../utils/idGenerator');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');
const notificationService = require('../services/notificationService');

const ticketController = {
// Create a new ticket
  async createTicket(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      priority,
      category,
      tags,
      desired_action
    } = req.body;
    const departmentId = req.body.departmentId || req.body.department_id;
    const assignedTo = req.body.assignedTo || req.body.assigned_to;
    const dueDate = req.body.dueDate || req.body.due_date;
    const createdBy = req.user.id;

    // Check department access
    if (req.user.role === 'employee' || req.user.role === 'department_head') {
      if (departmentId !== req.user.departmentId) {
        return res.status(403).json({ error: 'Not authorized to create tickets in this department' });
      }
    }

    // Require departmentId only for non-admins
    if (req.user.role !== 'admin') {
      if (!departmentId) {
        return res.status(400).json({ error: 'Department ID is required.' });
      }
      if (!/^DEP-[0-9]{8}-[0-9]{5}$/.test(departmentId)) {
        return res.status(400).json({ error: 'Department ID must be in the format DEP-YYYYMMDD-XXXXX' });
      }
    }

    const ticket = await Ticket.create({
      title,
      description,
      priority,
      category: category || 'other',
      department_id: departmentId,
      assigned_to: assignedTo,
      due_date: dueDate,
      tags,
      desired_action,
      created_by: createdBy,
      original_creator_id: createdBy,
      current_handler_id: assignedTo || createdBy
    });

    // Notify assigned user (only if different from creator)
    if (assignedTo && assignedTo !== createdBy) {
      await notificationService.createNotification({
        userId: assignedTo,
        type: 'ticket_assigned',
        title: 'New Ticket Assigned',
        message: `You have been assigned to ticket: ${title}`,
        ticketId: ticket.id
      });
    }

    // Notify department head (only if different from creator)
    const department = await Department.findByPk(departmentId, {
      include: [{ model: User, where: { role: 'department_head' } }]
    });

    if (department && department.Users.length > 0 && department.Users[0].id !== createdBy) {
      await notificationService.createNotification({
        userId: department.Users[0].id,
        type: 'new_ticket',
        title: 'New Ticket Created',
        message: `A new ticket has been created in your department: ${title}`,
        ticketId: ticket.id
      });
    }

    res.status(201).json(ticket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
  },

// Get all tickets with filtering
  async getAllTickets(req, res) {
  try {
    const {
      status,
      priority,
      department_id: departmentId,
      assigned_to: assignedTo,
      created_by: createdBy,
      category,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const where = {};
    
    // Add department filter based on user role
    if (req.user.role === 'employee' || req.user.role === 'department_head') {
      where.department_id = req.user.departmentId;
    }
    
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (departmentId) where.department_id = departmentId;
    if (assignedTo) where.assigned_to = assignedTo;
    if (createdBy) where.created_by = createdBy;
    if (category) where.category = category;
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const tickets = await Ticket.findAndCountAll({
      where,
      include: [
        { model: User, as: 'ticketCreator', attributes: ['id', 'firstname', 'lastname', 'email'] },
        { model: User, as: 'ticketAssignee', attributes: ['id', 'firstname', 'lastname', 'email'] },
        { model: Department, attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (page - 1) * limit
    });

    res.json({
      tickets: tickets.rows,
      total: tickets.count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(tickets.count / limit)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
  },

// Get ticket by ID
  async getTicketById(req, res) {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: User, as: 'ticketCreator', attributes: ['id', 'firstname', 'lastname', 'email', 'role'], include: [{ model: Department, attributes: ['id', 'name'] }] },
        { model: User, as: 'ticketAssignee', attributes: ['id', 'firstname', 'lastname', 'email', 'role'], include: [{ model: Department, attributes: ['id', 'name'] }] },
        { model: Department, attributes: ['id', 'name'] },
        { model: Comment, as: 'ticketComments', include: [{ model: User, as: 'commentUser', attributes: ['id', 'firstname', 'lastname'] }] }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
  },

// Update ticket
  async updateTicket(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check authorization
    const isCurrentHandler = ticket.current_handler_id === req.user.id;
    if (
      req.user.role === 'employee' &&
      ticket.department_id !== req.user.departmentId &&
      ticket.assigned_to !== req.user.id &&
      !isCurrentHandler
    ) {
      return res.status(403).json({ error: 'Not authorized to update this ticket' });
    }
    if (
      req.user.role === 'department_head' &&
      ticket.department_id !== req.user.departmentId &&
      ticket.assigned_to !== req.user.id &&
      !isCurrentHandler
    ) {
      return res.status(403).json({ error: 'Not authorized to update this ticket' });
    }

    const {
      title,
      description,
      status,
      priority,
      category,
      assigned_to: assignedTo,
      due_date: dueDate,
      resolution,
      tags,
      remarks,
      desired_action
    } = req.body;

    // Validate remarks for updates
    if (!remarks || remarks.trim() === '') {
      return res.status(400).json({ error: 'Remarks are required when updating a ticket' });
    }

    // Check if assignment changed
    const wasAssigned = ticket.assigned_to;
    const isNewAssignment = assignedTo && assignedTo !== wasAssigned;

    const updatedTicket = await ticket.update({
      title,
      description,
      status,
      priority,
      category,
      assigned_to: assignedTo,
      due_date: dueDate,
      resolution,
      tags,
      desired_action
    });

    // Create a comment with the remarks
    if (remarks && remarks.trim()) {
      await Comment.create({
        ticket_id: ticket.id,
        author_id: req.user.id,
        content: `Ticket Updated\n\n${remarks}`,
        comment_type: 'update'
      });
    }

    // Notify new assignee if assignment changed (only if different from updater)
    if (isNewAssignment && assignedTo !== req.user.id) {
      await notificationService.createNotification({
        userId: assignedTo,
        type: 'ticket_assigned',
        title: 'Ticket Assigned',
        message: `You have been assigned to ticket: ${title}`,
        ticketId: ticket.id
      });
    }

    // Notify status change (exclude the user who made the change)
    if (status && status !== ticket.status) {
      const notifyUsers = [];
      if (ticket.created_by !== req.user.id) notifyUsers.push(ticket.created_by);
      if (ticket.assigned_to && ticket.assigned_to !== req.user.id) notifyUsers.push(ticket.assigned_to);

      for (const userId of notifyUsers) {
        await notificationService.createNotification({
          userId,
          type: 'ticket_status_changed',
          title: 'Ticket Status Updated',
          message: `Ticket "${title}" status changed to ${status}`,
          ticketId: ticket.id
        });
      }
    }

    // Notify on general ticket update (if any field except status/assignment changed)
    const fieldsToCheck = ['title', 'description', 'priority', 'due_date', 'status', 'file'];
    let generalUpdate = false;
    for (const field of fieldsToCheck) {
      if (typeof req.body[field] !== 'undefined' && req.body[field] !== ticket[field]) {
        generalUpdate = true;
        break;
      }
    }
    if (generalUpdate) {
      const notifyUsers = [];
      if (updatedTicket.assigned_to && updatedTicket.assigned_to !== req.user.id) notifyUsers.push(updatedTicket.assigned_to);
      if (updatedTicket.created_by && updatedTicket.created_by !== updatedTicket.assigned_to && updatedTicket.created_by !== req.user.id) notifyUsers.push(updatedTicket.created_by);
      for (const userId of notifyUsers) {
        await notificationService.createNotification({
          userId,
          type: 'ticket_updated',
          title: 'Ticket Updated',
          message: `Ticket "${title}" has been updated.`,
          ticketId: ticket.id
        });
      }
    }

    // Notify all involved users on update
    const notifyUsers = new Set([
      updatedTicket.created_by,
      updatedTicket.current_handler_id,
      updatedTicket.forwarded_from_id,
      updatedTicket.assigned_to
    ].filter(Boolean));
    notifyUsers.delete(req.user.id); // Don't notify the updater
    for (const userId of notifyUsers) {
      await notificationService.createNotification({
        userId,
        type: 'ticket_updated',
        title: 'Ticket Updated',
        message: `Ticket "${title}" has been updated by another user`,
        ticketId: ticket.id
      });
    }

    res.json(updatedTicket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
  },

// Delete ticket
  async deleteTicket(req, res) {
  try {
    const ticket = await Ticket.findByPk(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check authorization for department head
    if (req.user.role === 'department_head' && ticket.department_id !== req.user.departmentId) {
      return res.status(403).json({ error: 'Not authorized to delete tickets from other departments' });
    }
    
    // Additional check: allow user to delete their own created ticket if needed
    // if (req.user.role === 'employee' && ticket.created_by !== req.user.id) {
    //   return res.status(403).json({ error: 'Not authorized to delete this ticket' });
    // }

    // Import required models
    const { Notification, Comment, FileAttachment } = require('../models');

    // Delete related records first (cascade delete)
    try {
      // Delete notifications related to this ticket
      await Notification.destroy({
        where: { ticket_id: ticket.id }
      });

      // Delete comments related to this ticket
      await Comment.destroy({
        where: { ticket_id: ticket.id }
      });

      // Delete file attachments related to this ticket
      await FileAttachment.destroy({
        where: { ticket_id: ticket.id }
      });

      console.log(`Deleted related records for ticket: ${ticket.id}`);
    } catch (relatedError) {
      console.error('Error deleting related records:', relatedError);
      // Continue with ticket deletion even if related records fail
    }

    // Now delete the ticket
    await ticket.destroy();

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
  },

// Get ticket statistics
  async getTicketStats(req, res) {
  try {
    const { department_id: departmentId, startDate, endDate } = req.query;
    const where = {};

    if (departmentId) where.department_id = departmentId;
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const stats = await Ticket.findAll({
      where,
      attributes: [
        'status',
        'priority',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status', 'priority']
    });

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
    }
  },

  // Forward ticket
  async forwardTicket(req, res) {
    try {
      const { id: ticketId } = req.params;
      const { toUserId, reason, notes } = req.body;
      const fromUserId = req.user.id;

      console.log('Forward ticket request:', { ticketId, toUserId, reason, fromUserId });

      // Validate ticket exists
      const ticket = await Ticket.findByPk(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      console.log('Ticket found:', ticket.id);

      // Check permissions
      if (!canForwardTicket(req.user, ticket)) {
        return res.status(403).json({ error: 'Insufficient permissions to forward this ticket' });
      }

      console.log('Permissions check passed');

      // Generate forward chain ID if first forward
      const IDSequences = sequelize.models.IDSequences;
      const idGenerator = new IDGenerator(sequelize, IDSequences);
      const forwardChainId = ticket.forward_chain_id || await idGenerator.generateID('FWD');

      console.log('Forward chain ID:', forwardChainId);

      // Update ticket with forwarding fields
      const updateData = {
        forwarded_from_id: fromUserId,
        forwarded_to_id: toUserId,
        forward_reason: reason,
        forward_chain_id: forwardChainId,
        is_forwarded: true,
        current_handler_id: toUserId,
        status: 'pending' // Reset status for new handler
      };

      console.log('Updating ticket with:', updateData);

      await ticket.update(updateData);

      console.log('Ticket updated successfully');

      // Get recipient user details for the comment
      const recipientUser = await User.findByPk(toUserId);
      const recipientName = recipientUser ? `${recipientUser.firstname} ${recipientUser.lastname}` : toUserId;

      // Create forward comment
      const commentData = {
        id: await idGenerator.generateID('CMT'),
        content: `Ticket Forwarded\n\nTo: ${recipientName}\nReason: ${reason}`,
        ticket_id: ticketId,
        author_id: fromUserId,
        comment_type: 'forward',
        forward_status: 'pending'
      };

      console.log('Creating comment with:', commentData);

      await Comment.create(commentData);

      console.log('Comment created successfully');

      // Create notification for recipient (new handler)
      await notificationService.createNotification({
        userId: toUserId,
        type: 'ticket_forwarded',
        title: 'Ticket Forwarded',
        message: `You have received a forwarded ticket: ${ticket.title}`,
        ticketId: ticket.id
      });
      // Notify previous handler (sender), if different
      if (fromUserId !== toUserId) {
        await notificationService.createNotification({
          userId: fromUserId,
          type: 'ticket_forwarded_sent',
          title: 'Ticket Forwarded',
          message: `You forwarded ticket: ${ticket.title} to another user`,
          ticketId: ticket.id
        });
      }
      // Notify original creator if not sender or receiver
      if (ticket.created_by && ticket.created_by !== fromUserId && ticket.created_by !== toUserId) {
        await notificationService.createNotification({
          userId: ticket.created_by,
          type: 'ticket_forwarded_info',
          title: 'Ticket Forwarded',
          message: `Your ticket: ${ticket.title} was forwarded to another user`,
          ticketId: ticket.id
        });
      }
      // Notify assignee if not sender or receiver
      if (ticket.assigned_to && ticket.assigned_to !== fromUserId && ticket.assigned_to !== toUserId) {
        await notificationService.createNotification({
          userId: ticket.assigned_to,
          type: 'ticket_forwarded_info',
          title: 'Ticket Forwarded',
          message: `A ticket assigned to you: ${ticket.title} was forwarded to another user`,
          ticketId: ticket.id
        });
      }

      console.log('Notification created successfully');

      res.json({
        message: 'Ticket forwarded successfully',
        ticket: ticket
      });
    } catch (error) {
      console.error('Error forwarding ticket:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      res.status(500).json({ 
        error: 'Failed to forward ticket',
        details: error.message 
      });
    }
  },

  // Respond to forwarded ticket
  async respondToForward(req, res) {
    try {
      const { id: ticketId } = req.params;
      const { action, notes } = req.body; // action: 'approve', 'reject', 'return'

      const ticket = await Ticket.findByPk(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      // Check if current user is the recipient
      if (ticket.forwarded_to_id !== req.user.id) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Update ticket status
      let newStatus = 'pending';
      if (action === 'approve') {
        newStatus = 'in_progress';
      } else if (action === 'reject') {
        newStatus = 'declined';
      } else if (action === 'return') {
        newStatus = 'pending';
        // Return to previous handler
        await ticket.update({
          current_handler_id: ticket.forwarded_from_id,
          forwarded_to_id: ticket.forwarded_from_id,
          forwarded_from_id: req.user.id
        });
      }

      await ticket.update({ status: newStatus });

      // Create response comment
      const IDSequences = sequelize.models.IDSequences;
      const idGenerator = new IDGenerator(sequelize, IDSequences);
      await Comment.create({
        id: await idGenerator.generateID('CMT'),
        content: `Forward Response\n\nAction: ${action}\n${notes ? `Notes: ${notes}` : ''}`,
        ticket_id: ticketId,
        author_id: req.user.id,
        comment_type: 'response',
        forward_status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'returned'
      });

      // Notify all involved users on forward response
      const notifyUsers = new Set([
        ticket.forwarded_from_id,
        ticket.forwarded_to_id,
        ticket.created_by
      ].filter(Boolean));
      notifyUsers.delete(req.user.id); // Don't notify the responder
      for (const userId of notifyUsers) {
        await notificationService.createNotification({
          userId,
          type: 'forward_response',
          title: 'Forwarded Ticket Response',
          message: `A forwarded ticket you are involved with has a new response: ${action}`,
          ticketId: ticket.id
        });
      }

      res.json({ message: `Ticket ${action}ed successfully` });
    } catch (error) {
      console.error('Error responding to forward:', error);
      res.status(500).json({ error: 'Failed to respond to forward' });
    }
  },



  // Get tickets that have been forwarded to the current user
  async getTicketsForwardedToMe(req, res) {
    try {
      const tickets = await Ticket.findAll({
        where: { 
          forwarded_to_id: req.user.id,
          is_forwarded: true
        },
        include: [
          { model: User, as: 'ticketCreator', attributes: ['id', 'firstname', 'lastname', 'email'] },
          { model: User, as: 'ticketAssignee', attributes: ['id', 'firstname', 'lastname', 'email'] },
          { model: User, as: 'forwardedFrom', attributes: ['id', 'firstname', 'lastname', 'email'] },
          { model: Department, attributes: ['id', 'name'] }
        ],
        order: [['created_at', 'DESC']]
      });

      res.json({ tickets });
    } catch (error) {
      console.error('Error getting forwarded tickets:', error);
      res.status(500).json({ error: 'Failed to get forwarded tickets' });
    }
  },

  // Get tickets assigned to current user
  async getAssignedTickets(req, res) {
    try {
      const tickets = await Ticket.findAll({
        where: { 
          [Op.or]: [
            { assigned_to: req.user.id, is_active: true },
            { forwarded_to_id: req.user.id, is_forwarded: true }
          ]
        },
        include: [
          { model: User, as: 'ticketCreator', attributes: ['id', 'firstname', 'lastname', 'email'] },
          { model: User, as: 'ticketAssignee', attributes: ['id', 'firstname', 'lastname', 'email'] },
          { model: Department, attributes: ['id', 'name'] }
        ],
        order: [['created_at', 'DESC']]
      });

      res.json(tickets);
    } catch (error) {
      console.error('Error getting assigned tickets:', error);
      res.status(500).json({ error: 'Failed to get assigned tickets' });
    }
  },

  // Test method to check database fields
  async testForwardFields(req, res) {
    try {
      const ticket = await Ticket.findByPk(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const fields = {
        has_forwarded_from_id: 'forwarded_from_id' in ticket.dataValues,
        has_forwarded_to_id: 'forwarded_to_id' in ticket.dataValues,
        has_forward_reason: 'forward_reason' in ticket.dataValues,
        has_forward_chain_id: 'forward_chain_id' in ticket.dataValues,
        has_is_forwarded: 'is_forwarded' in ticket.dataValues,
        has_original_creator_id: 'original_creator_id' in ticket.dataValues,
        has_current_handler_id: 'current_handler_id' in ticket.dataValues,
        all_fields: Object.keys(ticket.dataValues)
      };

      res.json(fields);
    } catch (error) {
      console.error('Error testing fields:', error);
      res.status(500).json({ error: 'Failed to test fields', details: error.message });
    }
  }
};

// Helper function to check if user can forward ticket
const canForwardTicket = (user, ticket) => {
  // Admin can forward any ticket
  if (user.role === 'admin') return true;
  
  // Department head can forward tickets in their department
  if (user.role === 'department_head' && ticket.department_id === user.departmentId) return true;
  
  // Creator can forward their own tickets
  if (ticket.created_by === user.id) return true;
  
  // Current handler can forward tickets assigned to them
  if (ticket.current_handler_id === user.id) return true;
  
  // Assigned user can forward tickets assigned to them
  if (ticket.assigned_to === user.id) return true;
  
  return false;
};

// Helper function to create forward notification
const createForwardNotification = async (ticket, toUserId) => {
  try {
    const IDSequences = sequelize.models.IDSequences;
    const idGenerator = new IDGenerator(sequelize, IDSequences);
    await Notification.create({
      id: await idGenerator.generateID('NOT'),
      type: 'ticket_forwarded',
      message: `Ticket #${ticket.id} has been forwarded to you`,
      user_id: toUserId,
      ticket_id: ticket.id,
      is_read: false
    });
  } catch (error) {
    console.error('Error creating forward notification:', error);
  }
};

module.exports = { ticketController }; 