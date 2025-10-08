const request = require('supertest');
const { app } = require('../app');
const { User, Department, Task, Comment, sequelize, syncModels } = require('../models');
const { Sequelize } = require('sequelize');
const testConfig = require('../config/test.config');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = testConfig.jwt.secret;

let adminToken;
let departmentHeadToken;
let employeeToken;
let taskId;
let commentId;
let adminCommentId;
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
    const admin = await User.create({
      firstname: 'admin',
      lastname: 'admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      departmentId,
      status: 'approved'
    });

    const departmentHead = await User.create({
      firstname: 'department_head',
      lastname: 'head',
      email: 'head@test.com',
      password: 'password123',
      role: 'department_head',
      departmentId,
      status: 'approved'
    });

    const employee = await User.create({
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
  } catch (error) {
    console.error('Test setup error:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    await sequelize.close();
  } catch (error) {
    console.error('Database cleanup error:', error);
    throw error;
  }
});

describe('Comment API', () => {
  test('Create a comment (employee)', async () => {
    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        content: 'Test comment',
        taskId
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.content).toBe('Test comment');
    expect(res.body.author).toBeDefined();
    commentId = res.body.id;
  });

  test('Create a comment (admin)', async () => {
    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        content: 'Admin comment',
        taskId
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.content).toBe('Admin comment');
    adminCommentId = res.body.id;
  });

  test('Get comments for a task', async () => {
    const res = await request(app)
      .get(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  test('Update own comment', async () => {
    const res = await request(app)
      .put(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        content: 'Updated comment',
        taskId
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.content).toBe('Updated comment');
  });

  test('Cannot update another user\'s comment', async () => {
    const res = await request(app)
      .put(`/api/comments/${adminCommentId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        content: 'Should not update',
        taskId
      });
    expect(res.statusCode).toBe(403);
  });

  test('Delete own comment', async () => {
    const res = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Comment deleted successfully');
  });

  test('Admin can delete any comment', async () => {
    const res = await request(app)
      .delete(`/api/comments/${adminCommentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Comment deleted successfully');
  });

  test('Get comments for non-existent task', async () => {
    const res = await request(app)
      .get('/api/comments/task/TSK-20250618-99999')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.statusCode).toBe(404);
  });

  test('Create comment with invalid data', async () => {
    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        content: '', // Empty content
        taskId
      });
    expect(res.statusCode).toBe(400);
  });
}); 