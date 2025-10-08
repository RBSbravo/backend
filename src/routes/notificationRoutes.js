const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  getRelatedNotifications,
  deleteNotification,
  getUnreadNotifications
} = require('../controllers/notificationController');

// Get user's notifications
router.get('/',
  authenticateToken,
  getUserNotifications
);

// Get notifications related to the user
router.get('/related',
  authenticateToken,
  getRelatedNotifications
);

// Get unread notification count
router.get('/unread/count',
  authenticateToken,
  getUnreadCount
);

// Get unread notifications
router.get('/unread',
  authenticateToken,
  getUnreadNotifications
);

// Mark notification as read
router.put('/:id/read',
  authenticateToken,
  markNotificationAsRead
);

// Mark all notifications as read
router.put('/read-all',
  authenticateToken,
  markAllNotificationsAsRead
);

// Delete a notification
router.delete('/:id',
  authenticateToken,
  deleteNotification
);

module.exports = router; 