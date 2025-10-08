const request = require('supertest');
const { app } = require('../app');
const { sequelize } = require('../models');
const { User, Department, Ticket, UserSession } = require('../models');
const jwt = require('jsonwebtoken');
const testConfig = require('../config/test.config.js');

let adminToken;
let departmentHeadToken;
let employeeToken;
let testDepartment;
let testUser;
let testTicket;

beforeAll(async () => {
  try {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Ensure database exists and is clean
    await sequelize.query('CREATE DATABASE IF NOT EXISTS ticketing_system_test;');
    await sequelize.query('USE ticketing_system_test;');
    
    // Disable foreign key checks temporarily
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    // Drop all tables in the correct order
    await sequelize.query('DROP TABLE IF EXISTS ActivityLogs;');
    await sequelize.query('DROP TABLE IF EXISTS Notifications;');
    await sequelize.query('DROP TABLE IF EXISTS Comments;');
    await sequelize.query('DROP TABLE IF EXISTS Tickets;');
    await sequelize.query('DROP TABLE IF EXISTS Tasks;');
    await sequelize.query('DROP TABLE IF EXISTS Users;');
    await sequelize.query('DROP TABLE IF EXISTS Departments;');
    
    // Sync all models
    await sequelize.sync({ force: true });
    
    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

    // Create test department
    testDepartment = await Department.create({
      name: 'Test Department'
    });

    // Create test users
    const admin = await User.create({
      firstname: 'admin',
      lastname: 'admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      departmentId: testDepartment.id,
      status: 'approved'
    });

    const departmentHead = await User.create({
      firstname: 'depthead',
      lastname: 'depthead',
      email: 'depthead@test.com',
      password: 'password123',
      role: 'department_head',
      departmentId: testDepartment.id,
      status: 'approved'
    });

    const employee = await User.create({
      firstname: 'employee',
      lastname: 'employee',
      email: 'employee@test.com',
      password: 'password123',
      role: 'employee',
      departmentId: testDepartment.id,
      status: 'approved'
    });

    testUser = employee;

    // Generate tokens using real login endpoints
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    adminToken = adminLogin.body.token;
    // Ensure session exists
    let adminSession = await UserSession.findOne({ where: { token: adminToken, isActive: true } });
    if (!adminSession) throw new Error('Admin session not created');

    const departmentHeadLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'depthead@test.com', password: 'password123' });
    departmentHeadToken = departmentHeadLogin.body.token;
    let deptHeadSession = await UserSession.findOne({ where: { token: departmentHeadToken, isActive: true } });
    if (!deptHeadSession) throw new Error('Department head session not created');

    const employeeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@test.com', password: 'password123' });
    employeeToken = employeeLogin.body.token;
    let employeeSession = await UserSession.findOne({ where: { token: employeeToken, isActive: true } });
    if (!employeeSession) throw new Error('Employee session not created');

    // Create a test ticket
    testTicket = await Ticket.create({
      title: 'Test Ticket',
      description: 'This is a test ticket',
      priority: 'medium',
      category: 'bug',
      status: 'open',
      department_id: testDepartment.id,
      created_by: employee.id
    });
  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    // Clean up in reverse order of dependencies
    await Ticket.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    await Department.destroy({ where: {}, force: true });
    await sequelize.close();
  } catch (error) {
    console.error('Test cleanup failed:', error);
    throw error;
  }
});

describe('Ticket API', () => {
  describe('POST /api/tickets', () => {
    it('should allow employee to create ticket in their department', async () => {
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'New Test Ticket',
          description: 'This is a new test ticket',
          priority: 'medium',
          category: 'bug',
          departmentId: testDepartment.id
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('New Test Ticket');
    });

    it('should not allow employee to create ticket in different department', async () => {
      // Create another department with a unique name
      const otherDepartment = await Department.create({
        name: `Other Department ${Date.now()}`
      });

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'New Test Ticket',
          description: 'This is a new test ticket',
          priority: 'medium',
          category: 'bug',
          departmentId: otherDepartment.id
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Not authorized to create tickets in this department');
    });

    it('should allow department head to create ticket in their department', async () => {
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${departmentHeadToken}`)
        .send({
          title: 'Department Head Ticket',
          description: 'Created by department head',
          priority: 'high',
          category: 'feature',
          departmentId: testDepartment.id
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Department Head Ticket');
    });

    it('should allow admin to create ticket in any department', async () => {
      const otherDepartment = await Department.create({
        name: `Admin Department ${Date.now()}`
      });

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Ticket',
          description: 'Created by admin',
          priority: 'high',
          category: 'feature',
          departmentId: otherDepartment.id
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Admin Ticket');
    });
  });

  describe('GET /api/tickets', () => {
    it('should allow employee to view tickets from their department only', async () => {
      // Create a ticket in another department
      const otherDepartment = await Department.create({
        name: `View Department ${Date.now()}`
      });

      await Ticket.create({
        title: 'Other Department Ticket',
        description: 'This is a ticket from another department',
        priority: 'medium',
        category: 'bug',
        status: 'open',
        department_id: otherDepartment.id,
        created_by: testUser.id
      });

      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tickets');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body.tickets.every(ticket => (ticket.departmentId === testDepartment.id || ticket.department_id === testDepartment.id))).toBe(true);
    });

    it('should allow department head to view tickets from their department', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${departmentHeadToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tickets');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body.tickets.every(ticket => (ticket.departmentId === testDepartment.id || ticket.department_id === testDepartment.id))).toBe(true);
    });

    it('should allow admin to view tickets from all departments', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tickets');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.tickets)).toBe(true);
      expect(response.body.tickets.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/tickets/:id', () => {
    it('should get ticket by id', async () => {
      const response = await request(app)
        .get(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testTicket.id);
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await request(app)
        .get('/api/tickets/99999')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/tickets/:id', () => {
    it('should allow employee to update their own tickets', async () => {
      const response = await request(app)
        .put(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          status: 'in_progress',
          priority: 'high'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('in_progress');
      expect(response.body.priority).toBe('high');
    });

    it('should not allow employee to update tickets from other departments', async () => {
      const otherDepartment = await Department.create({
        name: `Other Department ${Date.now()}`
      });

      const otherTicket = await Ticket.create({
        title: 'Other Department Ticket',
        description: 'This is a ticket from another department',
        priority: 'medium',
        category: 'bug',
        status: 'open',
        department_id: otherDepartment.id,
        created_by: testUser.id
      });

      const response = await request(app)
        .put(`/api/tickets/${otherTicket.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          status: 'in_progress'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Not authorized to update this ticket');
    });

    it('should allow department head to update any ticket in their department', async () => {
      const response = await request(app)
        .put(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${departmentHeadToken}`)
        .send({
          status: 'resolved',
          priority: 'low'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('resolved');
      expect(response.body.priority).toBe('low');
    });

    it('should allow admin to update any ticket', async () => {
      const otherDepartment = await Department.create({
        name: `Other Department ${Date.now()}`
      });

      const otherTicket = await Ticket.create({
        title: 'Other Department Ticket',
        description: 'This is a ticket from another department',
        priority: 'medium',
        category: 'bug',
        status: 'open',
        department_id: otherDepartment.id,
        created_by: testUser.id
      });

      const response = await request(app)
        .put(`/api/tickets/${otherTicket.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'resolved',
          priority: 'high'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('resolved');
      expect(response.body.priority).toBe('high');
    });
  });

  describe('GET /api/tickets/stats', () => {
    it('should get ticket statistics', async () => {
      const res = await request(app)
        .get('/api/tickets/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('status');
      expect(res.body[0]).toHaveProperty('priority');
      expect(res.body[0]).toHaveProperty('count');
    });

    it('should get department-specific statistics', async () => {
      const res = await request(app)
        .get('/api/tickets/stats')
        .query({ department_id: testDepartment.id })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('status');
      expect(res.body[0]).toHaveProperty('priority');
      expect(res.body[0]).toHaveProperty('count');
    });

    it('should get date-range statistics', async () => {
      // Use a wide date range to ensure test tickets are included
      const res = await request(app)
        .get('/api/tickets/stats')
        .query({
          startDate: '2000-01-01',
          endDate: '2100-12-31'
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('status');
      expect(res.body[0]).toHaveProperty('priority');
      expect(res.body[0]).toHaveProperty('count');
    });
  });

  describe('DELETE /api/tickets/:id', () => {
    it('should not allow employee to delete tickets', async () => {
      const response = await request(app)
        .delete(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Not authorized to perform this action');
    });

    it('should allow admin to delete any ticket', async () => {
      const otherDepartment = await Department.create({
        name: `Other Department ${Date.now()}`
      });

      const otherTicket = await Ticket.create({
        title: 'Other Department Ticket',
        description: 'This is a ticket from another department',
        priority: 'medium',
        category: 'bug',
        status: 'open',
        department_id: otherDepartment.id,
        created_by: testUser.id
      });

      const response = await request(app)
        .delete(`/api/tickets/${otherTicket.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Ticket deleted successfully');
    });
  });
}); 