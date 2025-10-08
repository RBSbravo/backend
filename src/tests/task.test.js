const request = require('supertest');
const { app } = require('../app');
const { User, Department, Task, sequelize, syncModels } = require('../models');
const { Sequelize } = require('sequelize');
const testConfig = require('../config/test.config');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = testConfig.jwt.secret;

let adminToken;
let departmentHeadToken;
let employeeToken;
let taskId;
let departmentId;
let employeeId;

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
      lastname: 'department_head',
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
    if (adminLogin.status !== 200) {
      console.error('Admin login failed:', adminLogin.body);
      throw new Error('Admin login failed');
    }
    adminToken = adminLogin.body.token;

    const departmentHeadLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'head@test.com',
        password: 'password123'
      });
    if (departmentHeadLogin.status !== 200) {
      console.error('Department head login failed:', departmentHeadLogin.body);
      throw new Error('Department head login failed');
    }
    departmentHeadToken = departmentHeadLogin.body.token;

    const employeeLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'employee@test.com',
        password: 'password123'
      });
    if (employeeLogin.status !== 200) {
      console.error('Employee login failed:', employeeLogin.body);
      throw new Error('Employee login failed');
    }
    employeeToken = employeeLogin.body.token;
    employeeId = employee.id;
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

describe('Task API', () => {
  test('Admin can create a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Task',
        description: 'Task description',
        priority: 'high',
        dueDate: '2024-12-31',
        assignedTo: 2, // department head instead of employee
        departmentId
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Test Task');
    taskId = res.body.id;
  });

  test('Department head can create a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${departmentHeadToken}`)
      .send({
        title: 'Department Head Task',
        description: 'Department head task description',
        priority: 'medium',
        dueDate: '2024-11-30',
        assignedTo: 3, // employee
        departmentId
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Department Head Task');
  });

  test('Employee cannot create a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Employee Task',
        description: 'Should not be allowed',
        priority: 'low',
        dueDate: '2024-10-31',
        assignedTo: 2, // department head
        departmentId
      });
    expect(res.statusCode).toBe(403);
  });

  test('Get all tasks', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('Get task by ID', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(taskId);
  });

  test('Update task (admin)', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Updated Task',
        status: 'in_progress'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Updated Task');
    expect(res.body.status).toBe('in_progress');
  });

  test('Employee cannot update task not assigned/created by them', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'Should not update' });
    expect(res.statusCode).toBe(403);
  });

  test('Delete task (admin)', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Task deleted successfully');
  });

  test('Get deleted task returns not found', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(404);
  });

  // Test task status update
  test('Update task status', async () => {
    const response = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('in_progress');
  });

  test('Update task status with invalid status', async () => {
    const response = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalid_status' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid status');
  });

  test('Update task priority', async () => {
    const response = await request(app)
      .patch(`/api/tasks/${taskId}/priority`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ priority: 'high' });

    expect(response.status).toBe(200);
    expect(response.body.priority).toBe('high');
  });

  test('Update task priority with invalid priority', async () => {
    const response = await request(app)
      .patch(`/api/tasks/${taskId}/priority`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ priority: 'invalid_priority' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid priority');
  });

  test('Assign task to user', async () => {
    const response = await request(app)
      .patch(`/api/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: employeeId });

    expect(response.status).toBe(200);
    expect(response.body.assignedToId).toBe(employeeId);
  });

  test('Assign task to non-existent user', async () => {
    const response = await request(app)
      .patch(`/api/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: 'non-existent-id' });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('Assigned user not found');
  });
}); 