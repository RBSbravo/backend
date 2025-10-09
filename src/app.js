const express = require('express');
const cors = require('cors');
const http = require('http');
const { initializeSocket } = require('./services/socketService');
const taskRoutes = require('./routes/taskRoutes');
const authRoutes = require('./routes/authRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const analyticsRoutes = require('./routes/analytics');
const ticketRoutes = require('./routes/ticketRoutes');
const userRoutes = require('./routes/userRoutes');
const fileRoutes = require('./routes/fileRoutes');
const { sequelize } = require('./models');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000', 
    'http://localhost:8081',
    'exp://192.168.1.100:8081',
    'https://mito-ticketing-system.vercel.app',
    'https://ticketing-and-task-management-syste.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());



// Health check endpoint (required by Railway)
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Database status endpoint
app.get('/api/status', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ 
      status: 'OK', 
      database: 'Connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'Disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/files', fileRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: err.errors[0].message });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({ error: 'Record already exists' });
  }
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = { app, server }; 
