const { Notification } = require('../models');
const { emitNotification } = require('./socketService');

// Minimal notificationService stub for testing
module.exports = {
  async createNotification({ userId, type, title, message, ticketId, taskId, relatedUserId }) {
    // Compose notification message
    const notification = await Notification.create({
      userId,
      type,
      message: title ? `${title}: ${message}` : message,
      ticketId: ticketId || null,
      taskId: taskId || null,
      relatedUserId: relatedUserId || null,
      isRead: false
    });
    // Emit real-time notification
    emitNotification(userId, notification);
    return notification;
  }
}; 