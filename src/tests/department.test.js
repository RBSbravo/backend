process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

const request = require('supertest');
const { app } = require('../app');
const { User, Department, sequelize, syncModels } = require('../models');
const { Sequelize } = require('sequelize');
const testConfig = require('../config/test.config');

let adminToken;
let employeeToken;

beforeAll(async () => {
  try {
    await syncModels();
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

    // Create test users
    const admin = await User.create({
      firstname: 'admin',
      lastname: 'admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      status: 'approved'
    });

    const employee = await User.create({
      firstname: 'employee',
      lastname: 'employee',
      email: 'employee@test.com',
      password: 'password123',
      role: 'employee',
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

describe('Department Endpoints', () => {
  let testDepartment;

  describe('POST /api/departments', () => {
    it('should create a new department when admin', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'IT Department',
          description: 'Information Technology Department'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('name', 'IT Department');
      testDepartment = res.body;
    });

    it('should not create department when not admin', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          name: 'HR Department',
          description: 'Human Resources Department'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/departments', () => {
    it('should get all departments', async () => {
      const res = await request(app)
        .get('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/departments/:id', () => {
    it('should get department by id', async () => {
      const res = await request(app)
        .get(`/api/departments/${testDepartment.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('name', 'IT Department');
    });

    it('should return 404 for non-existent department', async () => {
      const res = await request(app)
        .get('/api/departments/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/departments/:id', () => {
    it('should update department when admin', async () => {
      const res = await request(app)
        .put(`/api/departments/${testDepartment.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated IT Department',
          description: 'Updated IT Department Description'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated IT Department');
    });

    it('should not update department when not admin', async () => {
      const res = await request(app)
        .put(`/api/departments/${testDepartment.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          name: 'HR Department',
          description: 'Human Resources Department'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/departments/:id', () => {
    it('should delete department when admin', async () => {
      const res = await request(app)
        .delete(`/api/departments/${testDepartment.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Department deleted successfully');
    });

    it('should not delete department when not admin', async () => {
      const res = await request(app)
        .delete(`/api/departments/${testDepartment.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
}); 