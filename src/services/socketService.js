const socketIO = require('socket.io');
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
        'https://task-management-app-three-orpin.vercel.app'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    // Add user authentication logic here
    next();
  });

  io.on('connection', (socket) => {
    console.log('🔌 Backend SocketService new connection:', socket.id);
    
    // Join user's room for private notifications
    socket.on('join', (userId) => {
      const roomName = `user_${userId}`;
      console.log('🔌 Backend SocketService user joining room:', { socketId: socket.id, userId, roomName });
      socket.join(roomName);
      console.log('🔌 Backend SocketService user joined room successfully');
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
  console.log('🔔 Backend SocketService emitNotification called:', { userId, notification });
  
  if (io) {
    const roomName = `user_${userId}`;
    console.log('🔔 Backend SocketService emitting to room:', roomName);
    console.log('🔔 Backend SocketService notification data:', {
      type: 'NEW_NOTIFICATION',
      data: notification
    });
    
    io.to(roomName).emit('notification', {
      type: 'NEW_NOTIFICATION',
      data: notification
    });
    
    console.log('🔔 Backend SocketService notification emitted successfully');
  } else {
    console.log('🔔 Backend SocketService io is not available');
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