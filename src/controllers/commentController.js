const { Comment, User, Task, Ticket, Notification } = require('../models');
const { emitNewComment, emitCommentDeleted, emitNotificationRemoved } = require('../services/socketService');
const notificationService = require('../services/notificationService');

// Create a new comment
const createComment = async (req, res) => {
  try {
    const { content, taskId, ticketId } = req.body;
    const authorId = req.user.id;

    if (!taskId && !ticketId) {
      return res.status(400).json({ error: 'Either taskId or ticketId is required' });
    }

    let parent;
    let comment;
    let notificationMessage;

    if (taskId) {
      parent = await Task.findByPk(taskId);
      if (!parent) {
        return res.status(404).json({ error: 'Task not found' });
      }
      comment = await Comment.create({ content, task_id: taskId, author_id: authorId });
      notificationMessage = `${req.user.firstname} ${req.user.lastname} commented on task: ${parent.title}`;
      // Notify task assignee and creator (existing logic)
      if (parent.assignedToId !== authorId) {
        await notificationService.createNotification({
          type: 'comment_added',
          message: notificationMessage,
          userId: parent.assignedToId,
          taskId,
          relatedUserId: authorId
        });
      }
      if (parent.createdBy !== authorId && parent.createdBy !== parent.assignedToId) {
        await notificationService.createNotification({
          type: 'comment_added',
          message: notificationMessage,
          userId: parent.createdBy,
          taskId,
          relatedUserId: authorId
        });
      }
    } else if (ticketId) {
      parent = await Ticket.findByPk(ticketId);
      if (!parent) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      comment = await Comment.create({ content, ticket_id: ticketId, author_id: authorId });
      notificationMessage = `${req.user.firstname} ${req.user.lastname} commented on ticket: ${parent.title}`;
      // Notify ticket assignee and creator
      if (parent.assigned_to !== authorId) {
        await notificationService.createNotification({
          type: 'comment_added',
          message: notificationMessage,
          userId: parent.assigned_to,
          ticketId,
          relatedUserId: authorId
        });
      }
      if (parent.created_by !== authorId && parent.created_by !== parent.assigned_to) {
        await notificationService.createNotification({
          type: 'comment_added',
          message: notificationMessage,
          userId: parent.created_by,
          ticketId,
          relatedUserId: authorId
        });
      }
    }

    const commentWithAuthor = await Comment.findByPk(comment.id, {
      include: [
        {
          model: User,
          as: 'commentUser',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ]
    });

    // Emit WebSocket event for new comment
    emitNewComment(commentWithAuthor);

    res.status(201).json(commentWithAuthor);
  } catch (error) {
    res.status(500).json({ message: 'Error creating comment' });
  }
};

// Get comments for a task
const getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;

    // Check if task exists
    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const comments = await Comment.findAll({
      where: { task_id: taskId },
      include: [{
        model: User,
        as: 'commentUser',
        attributes: ['id', 'firstname', 'lastname', 'email']
      }],
      order: [['created_at', 'DESC']]
    });

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get comments for a ticket
const getTicketComments = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const comments = await Comment.findAll({
      where: { ticket_id: ticketId },
      include: [{
        model: User,
        as: 'commentUser',
        attributes: ['id', 'firstname', 'lastname', 'email']
      }],
      order: [['created_at', 'DESC']]
    });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a comment
const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const comment = await Comment.findByPk(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only allow comment author to update
    if (comment.author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this comment' });
    }

    await comment.update({ content });

    const updatedComment = await Comment.findByPk(id, {
      include: [{
        model: User,
        as: 'commentUser',
        attributes: ['id', 'firstname', 'lastname', 'email']
      }]
    });

    res.json(updatedComment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findByPk(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only allow comment author to delete their own comment
    if (comment.author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Store comment info before deletion for notification removal
    const commentInfo = {
      id: comment.id,
      taskId: comment.task_id,
      ticketId: comment.ticket_id,
      authorId: comment.author_id
    };

    // Delete the comment
    await comment.destroy();

    // Remove related notifications for this comment
    const notificationsToRemove = await Notification.findAll({
      where: {
        type: 'comment_added',
        taskId: commentInfo.taskId,
        relatedUserId: commentInfo.authorId
      }
    });

    // Emit notification removal events for each affected user
    for (const notification of notificationsToRemove) {
      emitNotificationRemoved(notification.userId, notification.id);
      await notification.destroy();
    }

    // Emit comment deleted event
    emitCommentDeleted(commentInfo.id, commentInfo.taskId);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createComment,
  getTaskComments,
  getTicketComments,
  updateComment,
  deleteComment
}; 