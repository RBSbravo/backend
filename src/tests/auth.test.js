process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

const request = require('supertest');
const { app } = require('../app');
const { User, Department, sequelize } = require('../models');
const { Sequelize } = require('sequelize');
const testConfig = require('../config/test.config');

let testUser;
let testDepartment;

beforeAll(async () => {
  try {
    // Create test database if it doesn't exist
    const tempSequelize = new Sequelize('mysql', testConfig.database.username, testConfig.database.password, {
      host: testConfig.database.host,
      dialect: 'mysql'
    });
    
    await tempSequelize.query('CREATE DATABASE IF NOT EXISTS ticketing_system_test;');
    await tempSequelize.close();

    // Disable foreign key checks temporarily
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    // Drop all tables in the correct order
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
    testDepartment = department;

    // Create test users
    const admin = await User.create({
      firstname: 'admin',
      lastname: 'admin',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
      status: 'approved'
    });

    const employee = await User.create({
      firstname: 'testuser',
      lastname: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'employee',
      departmentId: department.id,
      status: 'approved'
    });
  } catch (error) {
    console.error('Database setup error:', error);
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

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new employee with department', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstname: 'newuser',
          lastname: 'newuser',
          email: 'new@example.com',
          password: 'password123',
          role: 'employee',
          departmentId: testDepartment.id
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('firstname', 'newuser');
      expect(res.body.user).toHaveProperty('lastname', 'newuser');
      expect(res.body.user).toHaveProperty('status', 'pending');
      expect(res.body.user).toHaveProperty('departmentId', testDepartment.id);
    });

    it('should register a new department head with department', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstname: 'depthead',
          lastname: 'depthead',
          email: 'head@example.com',
          password: 'password123',
          role: 'department_head',
          departmentId: testDepartment.id
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('firstname', 'depthead');
      expect(res.body.user).toHaveProperty('lastname', 'depthead');
      expect(res.body.user).toHaveProperty('status', 'pending');
      expect(res.body.user).toHaveProperty('departmentId', testDepartment.id);
    });

    it('should not register employee without department', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstname: 'testuser2',
          lastname: 'testuser2',
          email: 'test2@example.com',
          password: 'password123',
          role: 'employee'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Department is required for this role');
    });

    it('should not register department head without department', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstname: 'depthead2',
          lastname: 'depthead2',
          email: 'head2@example.com',
          password: 'password123',
          role: 'department_head'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Department is required for this role');
    });

    it('should not register a user with existing email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstname: 'testuser2',
          lastname: 'testuser2',
          email: 'test@example.com',
          password: 'password123',
          role: 'employee',
          departmentId: testDepartment.id
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials for approved user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('firstname', 'testuser');
      expect(res.body.user).toHaveProperty('lastname', 'testuser');
      expect(res.body.user).toHaveProperty('status', 'approved');
    });

    it('should not login with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should not login with pending status', async () => {
      // First register a pending user
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          firstname: 'pendinguser',
          lastname: 'pendinguser',
          email: 'pending@example.com',
          password: 'password123',
          role: 'employee',
          departmentId: testDepartment.id
        });

      expect(registerRes.statusCode).toBe(201);

      // Try to login with pending user
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'pending@example.com',
          password: 'password123'
        });

      expect(loginRes.statusCode).toBe(403);
      expect(loginRes.body).toHaveProperty('error', 'Account not approved by admin');
    });
  });

  describe('GET /api/auth/me', () => {
    let token;

    beforeEach(async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      token = loginRes.body.token;
    });

    it('should get user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('firstname', 'testuser');
      expect(res.body).toHaveProperty('lastname', 'testuser');
      expect(res.body).toHaveProperty('email', 'test@example.com');
      expect(res.body).toHaveProperty('status', 'approved');
    });

    it('should not get profile without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('User Approval Flow', () => {
    let pendingUserId;
    let adminToken;

    beforeAll(async () => {
      // Get admin token
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'password123' });
      adminToken = res.body.token;
    });

    it('should register a department_head with pending status and department', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstname: 'pendinghead',
          lastname: 'pendinghead',
          email: 'pendinghead@example.com',
          password: 'password123',
          role: 'department_head',
          departmentId: testDepartment.id
        });
      expect(res.statusCode).toBe(201);
      expect(res.body.user).toHaveProperty('firstname', 'pendinghead');
      expect(res.body.user).toHaveProperty('lastname', 'pendinghead');
      expect(res.body.user).toHaveProperty('status', 'pending');
      expect(res.body.user).toHaveProperty('departmentId', testDepartment.id);
      pendingUserId = res.body.user.id;
    });

    it('should block login for pending user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pendinghead@example.com', password: 'password123' });
      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error', 'Account not approved by admin');
    });

    it('should allow admin to approve user', async () => {
      const res = await request(app)
        .patch(`/api/users/${pendingUserId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.user).toHaveProperty('firstname', 'pendinghead');
      expect(res.body.user).toHaveProperty('lastname', 'pendinghead');
      expect(res.body.user).toHaveProperty('status', 'approved');
    });

    it('should allow login after approval', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pendinghead@example.com', password: 'password123' });
      expect(res.statusCode).toBe(200);
      expect(res.body.user).toHaveProperty('firstname', 'pendinghead');
      expect(res.body.user).toHaveProperty('lastname', 'pendinghead');
      expect(res.body.user).toHaveProperty('status', 'approved');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send reset token for valid email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'test@example.com'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password reset email sent');
      expect(res.body).toHaveProperty('resetToken');
    });

    it('should return 404 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken;

    beforeEach(async () => {
      // Get reset token by calling forgot password
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'test@example.com'
        });
      resetToken = res.body.resetToken;
    });

    it('should reset password with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'newpassword123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password has been reset successfully');

      // Verify new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'newpassword123'
        });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body).toHaveProperty('token');
    });

    it('should return 400 for invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalidtoken',
          password: 'newpassword123'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid or expired reset token');
    });
  });

  describe('GET /api/auth/verify-reset-token/:token', () => {
    let resetToken;

    beforeEach(async () => {
      // Get reset token by calling forgot password
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'test@example.com'
        });
      resetToken = res.body.resetToken;
    });

    it('should verify valid reset token', async () => {
      const res = await request(app)
        .get(`/api/auth/verify-reset-token/${resetToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Valid reset token');
    });

    it('should return 400 for invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-reset-token/invalidtoken');

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid or expired reset token');
    });
  });
}); 