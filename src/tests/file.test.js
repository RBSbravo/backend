const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app, server } = require('../app');
const { User, Department, Ticket, Task, Comment, FileAttachment, sequelize, syncModels } = require('../models');
const testConfig = require('../config/test.config');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = testConfig.jwt.secret;

// Test file path
const testFilePath = path.join(__dirname, 'test-files');
const testFileName = 'test.txt';
const testFileContent = 'This is a test file';

let testDepartment;
let testUser;
let testTicket;
let testTask;
let testComment;

// Create test file and setup database
beforeAll(async () => {
  try {
    await syncModels();
    // Create test directory if it doesn't exist
    if (!fs.existsSync(testFilePath)) {
      fs.mkdirSync(testFilePath, { recursive: true });
    }

    // Create test file
    fs.writeFileSync(path.join(testFilePath, testFileName), testFileContent);

    // Create test data
    testDepartment = await Department.create({
      name: 'Test Department',
      description: 'Test Department Description'
    });

    testUser = await User.create({
      firstname: 'testuser',
      lastname: 'testuser',
      email: 'test@example.com',
      password: 'Test123!@#',
      role: 'employee',
      departmentId: testDepartment.id,
      status: 'approved'
    });

    testTicket = await Ticket.create({
      title: 'Test Ticket',
      description: 'Test Ticket Description',
      department_id: testDepartment.id,
      created_by: testUser.id,
      status: 'open',
      priority: 'medium'
    });

    testTask = await Task.create({
      title: 'Test Task',
      description: 'Test Task Description',
      ticketId: testTicket.id,
      status: 'pending',
      createdBy: testUser.id,
      departmentId: testDepartment.id
    });

    testComment = await Comment.create({
      content: 'Test Comment',
      taskId: testTask.id,
      authorId: testUser.id
    });
  } catch (error) {
    console.error('Setup failed:', error);
    throw error;
  }
});

// Clean up test files and database
afterAll(async () => {
  try {
    // Remove test file
    if (fs.existsSync(path.join(testFilePath, testFileName))) {
      fs.unlinkSync(path.join(testFilePath, testFileName));
    }

    // Remove test directory
    if (fs.existsSync(testFilePath)) {
      fs.rmdirSync(testFilePath);
    }

    // Close database connection
    await sequelize.close();
    server.close();
  } catch (error) {
    console.error('Teardown failed:', error);
    throw error;
  }
});

describe('File Attachment API', () => {
  let authToken;

  beforeAll(async () => {
    try {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        });

      authToken = loginResponse.body.token;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  });

  describe('POST /api/files/ticket/:ticketId', () => {
    it('should upload a file to a ticket', async () => {
      const response = await request(app)
        .post(`/api/files/ticket/${testTicket.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(testFilePath, testFileName));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.file_name).toBe(testFileName);
    });
  });

  describe('POST /api/files/task/:taskId', () => {
    it('should upload a file to a task', async () => {
      const response = await request(app)
        .post(`/api/files/task/${testTask.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(testFilePath, testFileName));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.file_name).toBe(testFileName);
    });
  });

  describe('POST /api/files/comment/:commentId', () => {
    it('should upload a file to a comment', async () => {
      const response = await request(app)
        .post(`/api/files/comment/${testComment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(testFilePath, testFileName));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.file_name).toBe(testFileName);
    });
  });

  describe('GET /api/files/:fileId', () => {
    it('should get file details', async () => {
      const file = await FileAttachment.findOne();
      const response = await request(app)
        .get(`/api/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(file.id);
      expect(response.body.file_name).toBe(testFileName);
    });
  });

  describe('GET /api/files/:fileId/download', () => {
    it('should download a file', async () => {
      const file = await FileAttachment.findOne();
      const response = await request(app)
        .get(`/api/files/${file.id}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain(testFileName);
    });
  });

  describe('GET /api/files/ticket/:ticketId', () => {
    it('should list files for a ticket', async () => {
      const response = await request(app)
        .get(`/api/files/ticket/${testTicket.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/files/task/:taskId', () => {
    it('should list files for a task', async () => {
      const response = await request(app)
        .get(`/api/files/task/${testTask.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/files/comment/:commentId', () => {
    it('should list files for a comment', async () => {
      const response = await request(app)
        .get(`/api/files/comment/${testComment.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/files/:fileId', () => {
    it('should delete a file', async () => {
      const file = await FileAttachment.findOne();
      const response = await request(app)
        .delete(`/api/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('File deleted successfully');

      // Verify file is deleted
      const deletedFile = await FileAttachment.findByPk(file.id);
      expect(deletedFile).toBeNull();
    });
  });
}); 