const request = require('supertest');
const { app } = require('../app');
const { User, Department, Task, Comment, Notification, sequelize, syncModels } = require('../models');
const { Sequelize } = require('sequelize');
const testConfig = require('../config/test.config');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = testConfig.jwt.secret;

let admin, departmentHead, employee;
let adminToken;
let departmentHeadToken;
let employeeToken;
let taskId;
let notificationId;
let departmentId;

beforeAll(async () => {
  try {
    await syncModels();
    // Create test department
    const department = await Department.create({
      name: 'Test Department',
      description: 'Test Department Description'
    });
    departmentId = department.id;

    // Create test users
    admin = await User.create({
      firstname: 'admin',
      lastname: 'admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      departmentId,
      status: 'approved'
    });

    departmentHead = await User.create({
      firstname: 'department_head',
      lastname: 'department_head',
      email: 'head@test.com',
      password: 'password123',
      role: 'department_head',
      departmentId,
      status: 'approved'
    });

    employee = await User.create({
      firstname: 'employee',
      lastname: 'employee',
      email: 'employee@test.com',
      password: 'password123',
      role: 'employee',
      departmentId,
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

    const departmentHeadLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'head@test.com',
        password: 'password123'
      });
    departmentHeadToken = departmentHeadLogin.body.token;

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
      departmentId,
      createdBy: admin.id
    });
    taskId = task.id;

    // Create a test notification
    const notification = await Notification.create({
      type: 'task_assigned',
      message: 'You have been assigned a new task',
      userId: employee.id,
      taskId,
      relatedUserId: admin.id
    });
    notificationId = notification.id;
  } catch (error) {
    console.error('Test setup error:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.close();
  } catch (error) {
    console.error('Database cleanup error:', error);
    throw error;
  }
});

describe('Notification API', () => {
  test('Get user notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].type).toBe('task_assigned');
  });

  test('Get unread notification count', async () => {
    const res = await request(app)
      .get('/api/notifications/unread/count')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
  });

  test('Mark notification as read', async () => {
    const res = await request(app)
      .put(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.isRead).toBe(true);
  });

  test('Mark all notifications as read', async () => {
    // Create another notification
    await Notification.create({
      type: 'task_updated',
      message: 'Task has been updated',
      userId: employee.id,
      taskId,
      relatedUserId: admin.id
    });

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('All notifications marked as read');

    // Verify all notifications are marked as read
    const notifications = await Notification.findAll({ where: { userId: employee.id } });
    expect(notifications.every(n => n.isRead)).toBe(true);
  });

  test('Get notifications with filters', async () => {
    const res = await request(app)
      .get('/api/notifications?isRead=true&type=task_assigned')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every(n => n.isRead && n.type === 'task_assigned')).toBe(true);
  });

  test('Cannot access another user\'s notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0); // Admin should have no notifications
  });

  test('Mark non-existent notification as read', async () => {
    const res = await request(app)
      .put('/api/notifications/NOT-20250618-99999/read')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.statusCode).toBe(404);
  });

  test('Get notifications related to a specific user', async () => {
    // Create multiple notifications with different types where the employee is the related user
    const notification1 = await Notification.create({
      type: 'task_updated',
      message: 'Task updated by employee',
      userId: admin.id,
      taskId,
      relatedUserId: employee.id
    });

    const notification2 = await Notification.create({
      type: 'comment_added',
      message: 'Employee commented on a task',
      userId: departmentHead.id,
      taskId,
      relatedUserId: employee.id
    });

    const notification3 = await Notification.create({
      type: 'task_completed',
      message: 'Employee completed a task',
      userId: admin.id,
      taskId,
      relatedUserId: employee.id
    });

    const notifications = [notification1, notification2, notification3];

    // Get notifications where the employee is the related user
    const res = await request(app)
      .get('/api/notifications/related')
      .set('Authorization', `Bearer ${employeeToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);

    // Verify each notification has the correct structure and data
    res.body.forEach(notification => {
      // Check basic fields
      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('type');
      expect(notification).toHaveProperty('message');
      expect(notification).toHaveProperty('isRead');
      expect(notification).toHaveProperty('userId');
      expect(notification).toHaveProperty('taskId');
      expect(notification).toHaveProperty('relatedUserId');
      expect(notification).toHaveProperty('createdAt');
      expect(notification).toHaveProperty('updatedAt');

      // Check specific values
      expect(notification.relatedUserId).toBe(employee.id);
      expect(['task_updated', 'comment_added', 'task_completed']).toContain(notification.type);
      expect(notification.taskId).toBe(taskId);
      expect(notification.isRead).toBe(false);

      // Check included associations
      expect(notification.task).toBeDefined();
      expect(notification.task).toHaveProperty('id', taskId);
      expect(notification.task).toHaveProperty('title');
      expect(notification.task).toHaveProperty('status');

      expect(notification.recipient).toBeDefined();
      expect(notification.recipient).toHaveProperty('id');
      expect(notification.recipient).toHaveProperty('firstname');
      expect(notification.recipient).toHaveProperty('lastname');
      expect(notification.recipient).toHaveProperty('email');
    });

    // Verify notifications are ordered by createdAt DESC
    const timestamps = res.body.map(n => new Date(n.createdAt));
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));

    // Verify we can filter by type
    const filteredRes = await request(app)
      .get('/api/notifications/related?type=task_updated')
      .set('Authorization', `Bearer ${employeeToken}`);
    
    expect(filteredRes.statusCode).toBe(200);
    expect(Array.isArray(filteredRes.body)).toBe(true);
    expect(filteredRes.body.length).toBe(1);
    expect(filteredRes.body[0].type).toBe('task_updated');
  });
}); 