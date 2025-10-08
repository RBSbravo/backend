const { Notification, User, Task } = require('../models');
const { Op } = require('sequelize');
const { emitNotification } = require('../services/socketService');

// Get user's notifications
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isRead, type } = req.query;

    const where = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }
    if (type) {
      where.type = type;
    }

    const notifications = await Notification.findAll({
      where,
      include: [
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'title', 'status']
        },
        {
          model: User,
          as: 'relatedUser',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.update({ isRead: true });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.update(
      { isRead: true },
      {
        where: {
          userId,
          isRead: false
        }
      }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await Notification.count({
      where: {
        userId,
        isRead: false
      }
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createNotification = async (userId, type, message, taskId, relatedUserId) => {
  try {
    const notification = await Notification.create({
      type,
      message,
      userId,
      taskId,
      relatedUserId,
      isRead: false
    });

    // Emit WebSocket event for new notification
    emitNotification(userId, notification);

    return notification;
  } catch (error) {
    throw error;
  }
};

// Get notifications related to a user
const getRelatedNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    const where = {
      relatedUserId: userId
    };

    if (type) {
      where.type = type;
    }

    const notifications = await Notification.findAll({
      where,
      include: [
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'title', 'status']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const notification = await Notification.findOne({ where: { id, userId } });
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    await notification.destroy();
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all unread notifications
const getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.findAll({
      where: { userId, isRead: false },
      order: [['createdAt', 'DESC']]
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  createNotification,
  getRelatedNotifications,
  deleteNotification,
  getUnreadNotifications
}; 