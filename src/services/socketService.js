const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const { User, UserSession } = require('../models');
let io;

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: [
        'http://localhost:5173', 
        'http://localhost:3000', 
        'http://localhost:8081', 
        'exp://192.168.1.100:8081',
        'https://mito-ticketing-system.vercel.app',
        'https://ticketing-and-task-management-syste.vercel.app',
        'https://task-management-app-three-orpin.vercel.app',
        'https://mito-pwa-mobile-app.vercel.app'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Get JWT secret (same logic as auth middleware)
      const getJwtSecret = () => {
        const testConfig = require('../config/test.config');
        return process.env.NODE_ENV === 'test' ? testConfig.jwt.secret : process.env.JWT_SECRET;
      };

      // Verify session is active
      const session = await UserSession.findOne({ where: { token, isActive: true } });
      if (!session) {
        return next(new Error('Authentication error: Invalid or expired session'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, getJwtSecret());
      
      // Get user from database
      const user = await User.findByPk(decoded.id);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (user.status !== 'approved') {
        return next(new Error('Authentication error: Account not approved'));
      }

      // Update session activity timestamp
      await session.update({ updatedAt: new Date() });

      // Attach user info to socket for later use
      socket.userId = user.id;
      socket.user = user;
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: ' + error.message));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected for user: ${socket.userId}`);
    
    // Automatically join user's room for private notifications
    socket.join(`user_${socket.userId}`);
    
    // Legacy join handler (for backward compatibility)
    socket.on('join', (userId) => {
      // Verify the userId matches the authenticated user
      if (userId === socket.userId) {
        socket.join(`user_${userId}`);
      }
    });

    // Handle mobile app specific events
    socket.on('task_update', (data) => {
      // Broadcast to all connected clients
      io.emit('task_update', data);
    });

    socket.on('new_comment', (data) => {
      io.emit('new_comment', data);
    });

    socket.on('notification', (data) => {
      io.emit('notification', data);
    });

    socket.on('disconnect', () => {
      // Client disconnected
    });
  });

  return io;
};

// Event emitters
const emitTaskUpdate = (task) => {
  if (io) {
    io.emit('task_update', task);
  }
};

const emitCommentUpdate = (comment) => {
  if (io) {
    io.emit('commentUpdate', comment);
  }
};

const emitCommentDeleted = (commentId, taskId) => {
  if (io) {
    io.emit('comment_deleted', {
      commentId,
      taskId
    });
  }
};

const emitPerformanceUpdate = (performance) => {
  if (io) {
    io.emit('performanceUpdate', performance);
  }
};

const emitNotification = (userId, notification) => {
  if (io) {
    io.to(`user_${userId}`).emit('notification', {
      type: 'NEW_NOTIFICATION',
      data: notification
    });
  }
};

const emitNotificationRemoved = (userId, notificationId) => {
  if (io) {
    io.to(`user_${userId}`).emit('notification_removed', {
      notificationId
    });
  }
};

const emitTaskStatusChange = (taskId, status) => {
  if (io) {
    io.emit(`task_${taskId}`, {
      type: 'STATUS_CHANGE',
      data: { status }
    });
  }
};

const emitTaskAssignment = (taskId, assignedToId) => {
  if (io) {
    io.emit(`task_${taskId}`, {
      type: 'ASSIGNMENT_CHANGE',
      data: { assignedToId }
    });
  }
};

const emitNewComment = (comment) => {
  if (io) {
    io.emit('new_comment', {
      id: comment.id,
      content: comment.content,
      taskId: comment.taskId,
      authorId: comment.authorId,
      createdAt: comment.createdAt
    });
  }
};

const emitTaskDeleted = (taskId) => {
  if (io) {
    io.emit('task_deleted', {
      taskId
    });
  }
};

module.exports = {
  initializeSocket,
  emitTaskUpdate,
  emitCommentUpdate,
  emitCommentDeleted,
  emitPerformanceUpdate,
  emitNotification,
  emitNotificationRemoved,
  emitTaskStatusChange,
  emitTaskAssignment,
  emitNewComment,
  emitTaskDeleted
}; 