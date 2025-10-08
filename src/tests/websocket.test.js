const request = require('supertest');
const { io: Client } = require('socket.io-client');
const { app, server } = require('../app');
const { User, Department, Task, Comment, Notification, sequelize, syncModels } = require('../models');
const { Sequelize } = require('sequelize');
const testConfig = require('../config/test.config');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = testConfig.jwt.secret;

// Increase timeout for all tests in this file
jest.setTimeout(10000); // 10 seconds

let admin, employee;
let adminToken, employeeToken;
let taskId;
let socketAdmin, socketEmployee;

// Helper function to wait for server to start
const waitForServer = () => {
  return new Promise((resolve) => {
    server.listen(testConfig.server.port, () => {
      console.log(`Test server running on port ${testConfig.server.port}`);
      resolve();
    });
  });
};

// Helper function to wait for socket connection
const waitForSocketConnection = (socket) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Socket connection timeout'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};

beforeAll(async () => {
  try {
    await syncModels();
    // Start the server first
    await waitForServer();

    // Create test database if it doesn't exist
    const tempSequelize = new Sequelize('mysql', testConfig.database.username, testConfig.database.password, {
      host: testConfig.database.host,
      dialect: 'mysql',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci'
    });
    
    await tempSequelize.query('CREATE DATABASE IF NOT EXISTS ticketing_system_test;');
    await tempSequelize.close();

    // Disable foreign key checks temporarily
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    // Drop all tables in the correct order
    await sequelize.query('DROP TABLE IF EXISTS Notifications;');
    await sequelize.query('DROP TABLE IF EXISTS Comments;');
    await sequelize.query('DROP TABLE IF EXISTS Tasks;');
    await sequelize.query('DROP TABLE IF EXISTS Users;');
    await sequelize.query('DROP TABLE IF EXISTS Departments;');
    
    // Sync all models
    await sequelize.sync({ force: true });
    
    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

    // Create test department
    const department = await Department.create({
      name: 'Test Department',
      description: 'Test Department Description'
    });

    // Create test users
    admin = await User.create({
      firstname: 'admin',
      lastname: 'admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      departmentId: department.id,
      status: 'approved'
    });

    employee = await User.create({
      firstname: 'employee',
      lastname: 'employee',
      email: 'employee@test.com',
      password: 'password123',
      role: 'employee',
      departmentId: department.id,
      status: 'approved'
    });

    // Get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });
    adminToken = adminLogin.body.token;

    const employeeLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'employee@test.com',
        password: 'password123'
      });
    employeeToken = employeeLogin.body.token;

    // Create a test task
    const task = await Task.create({
      title: 'Test Task',
      description: 'Task description',
      priority: 'high',
      dueDate: '2024-12-31',
      status: 'pending',
      assignedToId: employee.id,
      departmentId: department.id,
      createdBy: admin.id
    });
    taskId = task.id;

    // Initialize socket connections with the correct port
    socketAdmin = new Client(`http://localhost:${testConfig.server.port}`, {
      auth: { token: adminToken },
      transports: ['websocket'],
      reconnection: false
    });

    socketEmployee = new Client(`http://localhost:${testConfig.server.port}`, {
      auth: { token: employeeToken },
      transports: ['websocket'],
      reconnection: false
    });

    // Wait for both socket connections
    await Promise.all([
      waitForSocketConnection(socketAdmin),
      waitForSocketConnection(socketEmployee)
    ]);

  } catch (error) {
    console.error('Test setup error:', error);
    throw error;
  }
});

afterAll(async () => {
  // Close socket connections
  if (socketAdmin) socketAdmin.close();
  if (socketEmployee) socketEmployee.close();
  
  // Close server
  await new Promise((resolve) => {
    server.close(resolve);
  });
  
  // Close database connection
  await sequelize.close();
});

describe('WebSocket Functionality', () => {
  test('Socket connection and authentication', () => {
    expect(socketAdmin.connected).toBe(true);
    expect(socketEmployee.connected).toBe(true);
  });

  test('Join user room', (done) => {
    socketEmployee.emit('join', employee.id);
    
    // Wait a bit for the join to complete
    setTimeout(() => {
      expect(socketEmployee.connected).toBe(true);
      done();
    }, 100);
  });

  test('Receive task update notification', (done) => {
    let isDone = false;
    
    // Set up event listener first
    socketEmployee.on('task_update', (data) => {
      expect(data).toHaveProperty('taskId');
      expect(data).toHaveProperty('status');
      if (!isDone) {
        isDone = true;
        done();
      }
    });

    // Emit task update
    request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' })
      .end((err) => {
        if (err && !isDone) {
          isDone = true;
          done(err);
        }
      });
  }, 30000);

  test('Receive new comment notification', (done) => {
    let isDone = false;
    
    // Set up event listener first
    socketEmployee.on('new_comment', (data) => {
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('content');
      expect(data).toHaveProperty('taskId');
      if (!isDone) {
        isDone = true;
        done();
      }
    });

    // Emit new comment
    request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        content: 'Test comment',
        taskId
      })
      .end((err) => {
        if (err && !isDone) {
          isDone = true;
          done(err);
        }
      });
  }, 30000);

  test('Receive private notification', (done) => {
    let isDone = false;
    
    // First join the user's room
    socketEmployee.emit('join', employee.id);
    
    // Set up event listener
    socketEmployee.on('notification', (data) => {
      if (!isDone) {
        try {
          expect(data.type).toBe('NEW_NOTIFICATION');
          expect(data.data).toBeDefined();
          expect(data.data.type).toBe('task_updated');
          expect(data.data.message).toContain('status has been updated');
          isDone = true;
          done();
        } catch (error) {
          if (!isDone) {
            isDone = true;
            done(error);
          }
        }
      }
    });

    // Wait a bit to ensure listener is set up
    setTimeout(() => {
      // Update task to trigger notification
      request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'completed' })
        .end((err) => {
          if (err && !isDone) {
            isDone = true;
            done(err);
          }
        });
    }, 100);
  }, 30000);

  test('Receive task status change notification', (done) => {
    let isDone = false;
    
    // Set up event listener first
    socketEmployee.on(`task_${taskId}`, (data) => {
      if (data.type === 'STATUS_CHANGE' && !isDone) {
        try {
          expect(data.data.status).toBe('completed');
          isDone = true;
          done();
        } catch (error) {
          if (!isDone) {
            isDone = true;
            done(error);
          }
        }
      }
    });

    // Wait a bit to ensure listener is set up
    setTimeout(() => {
      // Update task status
      request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'completed' })
        .end((err) => {
          if (err && !isDone) {
            isDone = true;
            done(err);
          }
        });
    }, 100);
  });

  test('Receive task assignment notification', (done) => {
    let isDone = false;
    
    // Set up event listener first
    socketEmployee.on(`task_${taskId}`, (data) => {
      if (data.type === 'ASSIGNMENT_CHANGE' && !isDone) {
        try {
          expect(data.data.assignedToId).toBeDefined();
          isDone = true;
          done();
        } catch (error) {
          if (!isDone) {
            isDone = true;
            done(error);
          }
        }
      }
    });

    // Wait a bit to ensure listener is set up
    setTimeout(() => {
      // Update task assignment
      request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedToId: employee.id })
        .end((err) => {
          if (err && !isDone) {
            isDone = true;
            done(err);
          }
        });
    }, 100);
  });
}); 