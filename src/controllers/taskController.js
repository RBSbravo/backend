const { validationResult } = require('express-validator');
const { Task, User, Department, Comment, Notification, Ticket, FileAttachment } = require('../models');
const { Op } = require('sequelize');
const { emitTaskUpdate, emitTaskStatusChange, emitTaskAssignment, emitTaskDeleted, emitNotificationRemoved } = require('../services/socketService');
const { createNotification } = require('./notificationController');

// Create a new task
const createTask = async (req, res) => {
  try {
    const { title, description, priority, dueDate, assignedToId, departmentId, relatedTicketId } = req.body;
    const createdBy = req.user.id;

    const task = await Task.create({
      title,
      description,
      priority,
      dueDate,
      status: 'pending',
      assignedToId,
      departmentId,
      createdBy,
      relatedTicketId
    });

    // Notify assigned user if task is assigned to someone other than the creator
    if (assignedToId && assignedToId !== createdBy) {
      await createNotification(
        assignedToId,
        'task_assigned',
        `You have been assigned to task "${title}"`,
        task.id,
        createdBy
      );
      
      // Emit WebSocket event for task assignment
      emitTaskAssignment(task.id, assignedToId);
    }

    const taskWithAssociations = await Task.findByPk(task.id, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: Department,
          attributes: ['id', 'name']
        },
        {
          model: Ticket,
          as: 'relatedTicket',
          include: [
            {
              model: FileAttachment,
              as: 'attachments'
            }
          ]
        }
      ]
    });

    res.status(201).json(taskWithAssociations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all tasks with filters
const getAllTasks = async (req, res) => {
  try {
    const { status, priority, departmentId, assignedToId } = req.query;
    const where = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (departmentId) where.departmentId = departmentId;
    if (assignedToId) where.assignedToId = assignedToId;

    // If user is not admin or department head, only show tasks assigned to them
    if (req.user.role === 'employee') {
      where[Op.or] = [
        { assignedToId: req.user.id },
        { createdBy: req.user.id }
      ];
    }

    const tasks = await Task.findAll({
      where,
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: Department,
          attributes: ['id', 'name']
        },
        {
          model: Ticket,
          as: 'relatedTicket',
          include: [
            {
              model: FileAttachment,
              as: 'attachments'
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get task by ID
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: Department,
          attributes: ['id', 'name']
        },
        {
          model: Ticket,
          as: 'relatedTicket',
          include: [
            {
              model: FileAttachment,
              as: 'attachments'
            }
          ]
        }
      ]
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user has permission to view this task
    if (req.user.role === 'employee' && 
        task.assignedToId !== req.user.id && 
        task.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this task' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update task
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check permissions
    if (req.user.role === 'employee' && 
        task.createdBy !== req.user.id && 
        task.assignedToId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    // Accept relatedTicketId in update
    if (typeof req.body.relatedTicketId !== 'undefined') {
      task.relatedTicketId = req.body.relatedTicketId;
    }

    const updatedTask = await task.update(req.body);

    // Always update the related ticket's status if relatedTicketId is present and status is in the update
    if (task.relatedTicketId && typeof req.body.status !== 'undefined') {
      await Ticket.update({ status: req.body.status }, { where: { id: task.relatedTicketId } });
    }
    
    // Create and emit notifications based on what was updated
    if (req.body.status) {
      emitTaskStatusChange(id, req.body.status);
      // Notify task assignee about status change
      if (task.assignedToId && task.assignedToId !== req.user.id) {
        await createNotification(
          task.assignedToId,
          'task_updated',
          `Task "${task.title}" status has been updated to ${req.body.status}`,
          task.id,
          req.user.id
        );
      }
    }
    if (req.body.assignedToId) {
      emitTaskAssignment(id, req.body.assignedToId);
      // Notify new assignee
      if (req.body.assignedToId !== req.user.id) {
        await createNotification(
          req.body.assignedToId,
          'task_assigned',
          `You have been assigned to task "${task.title}"`,
          task.id,
          req.user.id
        );
      }
    }
    // Notify on general task update (if any field except assignment/status changed)
    const fieldsToCheck = ['title', 'description', 'priority', 'dueDate', 'status', 'file'];
    let generalUpdate = false;
    for (const field of fieldsToCheck) {
      if (typeof req.body[field] !== 'undefined' && req.body[field] !== task[field]) {
        generalUpdate = true;
        break;
      }
    }
    if (generalUpdate) {
      const notifyUsers = [];
      // Only notify users other than the one making the update
      if (updatedTask.assignedToId && updatedTask.assignedToId !== req.user.id) {
        notifyUsers.push(updatedTask.assignedToId);
      }
      if (updatedTask.createdBy && updatedTask.createdBy !== updatedTask.assignedToId && updatedTask.createdBy !== req.user.id) {
        notifyUsers.push(updatedTask.createdBy);
      }
      for (const userId of notifyUsers) {
        await createNotification(
          userId,
          'task_updated',
          `Task "${updatedTask.title}" has been updated.`,
          updatedTask.id,
          req.user.id
        );
      }
    }
    emitTaskUpdate({ taskId: id, status: updatedTask.status });

    const updatedTaskWithAssociations = await Task.findByPk(id, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: Department,
          attributes: ['id', 'name']
        },
        {
          model: Ticket,
          as: 'relatedTicket',
          include: [
            {
              model: FileAttachment,
              as: 'attachments'
            }
          ]
        }
      ]
    });

    res.json(updatedTaskWithAssociations);
  } catch (error) {
    res.status(500).json({ message: 'Error updating task' });
  }
};

// Delete task
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Allow only admin and task creator to delete tasks
    if (
      req.user.role !== 'admin' &&
      task.createdBy !== req.user.id
    ) {
      return res.status(403).json({ error: 'Not authorized to delete this task' });
    }

    // Store task info before deletion for notification removal
    const taskInfo = {
      id: task.id,
      assignedToId: task.assignedToId,
      createdBy: task.createdBy
    };

    // Remove all related notifications for this task
    const notificationsToRemove = await Notification.findAll({
      where: {
        taskId: taskInfo.id
      }
    });

    // Emit notification removal events for each affected user
    for (const notification of notificationsToRemove) {
      emitNotificationRemoved(notification.userId, notification.id);
      await notification.destroy();
    }

    // Delete all comments for this task
    await Comment.destroy({
      where: { task_id: taskInfo.id }
    });

    // Delete the task
    await task.destroy();

    // Emit task deleted event
    emitTaskDeleted(taskInfo.id);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update task status
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, in_progress, or completed' });
    }

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check permissions - task creator, assignee, or admin can update status
    if (req.user.role === 'employee' && 
        task.createdBy !== userId && 
        task.assignedToId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this task status' });
    }

    await task.update({ status });
    
    // Emit WebSocket event for status change
    emitTaskStatusChange(id, status);
    
    // Create notification for task assignee about status change
    if (task.assignedToId && task.assignedToId !== userId) {
      await createNotification(
        task.assignedToId,
        'task_updated',
        `Task "${task.title}" status has been updated to ${status}`,
        task.id,
        userId
      );
    }

    // Get updated task with associations
    const updatedTask = await Task.findByPk(id, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: Department,
          attributes: ['id', 'name']
        }
      ]
    });

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: 'Error updating task status' });
  }
};

// Update task priority
const updateTaskPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    const userId = req.user.id;

    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be low, medium, or high' });
    }

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check permissions - task creator, assignee, or admin can update priority
    if (req.user.role === 'employee' && 
        task.createdBy !== userId && 
        task.assignedToId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this task priority' });
    }

    await task.update({ priority });
    
    // Emit WebSocket event for task update
    emitTaskUpdate({ taskId: id, priority });
    
    // Create notification for task assignee about priority change
    if (task.assignedToId && task.assignedToId !== userId) {
      await createNotification(
        task.assignedToId,
        'task_updated',
        `Task "${task.title}" priority has been updated to ${priority}`,
        task.id,
        userId
      );
    }

    // Get updated task with associations
    const updatedTask = await Task.findByPk(id, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: Department,
          attributes: ['id', 'name']
        }
      ]
    });

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: 'Error updating task priority' });
  }
};

// Assign task to user
const assignTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: assignedUserId } = req.body;
    const currentUserId = req.user.id;

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if assigned user exists
    const assignedUser = await User.findByPk(assignedUserId);
    if (!assignedUser) {
      return res.status(404).json({ error: 'Assigned user not found' });
    }

    // Check permissions - only task creator, department head, or admin can assign tasks
    if (req.user.role === 'employee' && task.createdBy !== currentUserId) {
      return res.status(403).json({ error: 'Not authorized to assign this task' });
    }

    // Check if user is in the same department (for department heads)
    if (req.user.role === 'department_head' && 
        assignedUser.departmentId !== req.user.departmentId) {
      return res.status(403).json({ error: 'Can only assign tasks to users in the same department' });
    }

    await task.update({ assignedToId: assignedUserId });
    
    // Emit WebSocket event for task assignment
    emitTaskAssignment(id, assignedUserId);
    
    // Create notification for new assignee
    if (assignedUserId !== currentUserId) {
      await createNotification(
        assignedUserId,
        'task_assigned',
        `You have been assigned to task "${task.title}"`,
        task.id,
        currentUserId
      );
    }

    // Get updated task with associations
    const updatedTask = await Task.findByPk(id, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: Department,
          attributes: ['id', 'name']
        }
      ]
    });

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: 'Error assigning task' });
  }
};

module.exports = {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskPriority,
  assignTask
}; 
