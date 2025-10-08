const request = require('supertest');
const { User, Department, Task, sequelize, syncModels } = require('../models');
const app = require('../app');
const analyticsService = require('../services/analyticsService');
const { Sequelize } = require('sequelize');
const testConfig = require('../config/test.config');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = testConfig.jwt.secret;

let adminToken;
let departmentHeadToken;
let employeeToken;
let departmentId;
let userId;
let taskId;
let admin; // Store admin user object

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
    userId = employee.id;

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

    // Create test tasks
    const task = await Task.create({
      title: 'Test Task',
      description: 'Task description',
      priority: 'high',
      dueDate: '2024-12-31',
      status: 'pending',
      assignedTo: employee.id,
      departmentId,
      createdBy: admin.id
    });
    taskId = task.id;
  } catch (error) {
    console.error('Test setup error:', error);
    throw error;
  }
});

describe('Analytics API', () => {
  describe('Department Metrics', () => {
    test('Admin can get department metrics', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Department head can get department metrics', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/metrics`)
        .set('Authorization', `Bearer ${departmentHeadToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Employee cannot get department metrics', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/metrics`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('User Performance', () => {
    test('Admin can get user performance', async () => {
      const res = await request(app)
        .get(`/api/analytics/user/${userId}/performance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Department head can get user performance', async () => {
      const res = await request(app)
        .get(`/api/analytics/user/${userId}/performance`)
        .set('Authorization', `Bearer ${departmentHeadToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Employee cannot get user performance', async () => {
      const res = await request(app)
        .get(`/api/analytics/user/${userId}/performance`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Department Analytics', () => {
    test('Admin can get department analytics', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Department head can get department analytics', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/analytics`)
        .set('Authorization', `Bearer ${departmentHeadToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Employee cannot get department analytics', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/analytics`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Update Metrics', () => {
    test('Admin can update metrics', async () => {
      const res = await request(app)
        .post('/api/analytics/update-metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Metrics updated successfully');
    });

    test('Department head cannot update metrics', async () => {
      const res = await request(app)
        .post('/api/analytics/update-metrics')
        .set('Authorization', `Bearer ${departmentHeadToken}`);

      expect(res.statusCode).toBe(403);
    });

    test('Employee cannot update metrics', async () => {
      const res = await request(app)
        .post('/api/analytics/update-metrics')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Task Trends', () => {
    test('Admin can get task trends', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/trends`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          period: 'monthly',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('completionRate');
      expect(res.body).toHaveProperty('averageResolutionTime');
      expect(res.body).toHaveProperty('priorityDistribution');
      expect(res.body).toHaveProperty('statusDistribution');
    });

    test('Department head can get task trends', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/trends`)
        .set('Authorization', `Bearer ${departmentHeadToken}`)
        .query({
          period: 'monthly',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('completionRate');
    });

    test('Employee cannot get task trends', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/trends`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .query({
          period: 'monthly',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('User Activity Logs', () => {
    test('Admin can get user activity logs', async () => {
      const res = await request(app)
        .get(`/api/analytics/user/${userId}/activity`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Department head can get user activity logs', async () => {
      const res = await request(app)
        .get(`/api/analytics/user/${userId}/activity`)
        .set('Authorization', `Bearer ${departmentHeadToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Employee cannot get user activity logs', async () => {
      const res = await request(app)
        .get(`/api/analytics/user/${userId}/activity`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Custom Reports', () => {
    let reportId;

    test('Admin can create custom report', async () => {
      const res = await request(app)
        .post('/api/analytics/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Report',
          description: 'Test report description',
          type: 'task',
          parameters: {
            departmentId,
            startDate: '2024-01-01',
            endDate: '2024-12-31'
          }
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      reportId = res.body.id;
    });

    test('Admin can update custom report schedule', async () => {
      const res = await request(app)
        .put(`/api/analytics/reports/${reportId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cron: '0 8 * * 1',
          recipientEmail: 'admin@test.com'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Report schedule updated successfully');
      expect(res.body.report.schedule).toEqual({ cron: '0 8 * * 1', recipientEmail: 'admin@test.com' });
    });

    test('Department head cannot update custom report schedule', async () => {
      const res = await request(app)
        .put(`/api/analytics/reports/${reportId}/schedule`)
        .set('Authorization', `Bearer ${departmentHeadToken}`)
        .send({
          cron: '0 8 * * 1',
          recipientEmail: 'head@test.com'
        });

      expect(res.statusCode).toBe(403);
    });

    test('Employee cannot update custom report schedule', async () => {
      const res = await request(app)
        .put(`/api/analytics/reports/${reportId}/schedule`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          cron: '0 8 * * 1',
          recipientEmail: 'employee@test.com'
        });

      expect(res.statusCode).toBe(403);
    });

    test('Admin can get custom report', async () => {
      const res = await request(app)
        .get(`/api/analytics/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('report');
      expect(res.body).toHaveProperty('data');
    });

    test('Admin can list custom reports', async () => {
      const res = await request(app)
        .get('/api/analytics/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Admin can update custom report', async () => {
      const res = await request(app)
        .put(`/api/analytics/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Test Report',
          description: 'Updated test report description'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Updated Test Report');
    });

    test('Admin can delete custom report', async () => {
      const res = await request(app)
        .delete(`/api/analytics/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Report deleted successfully');
    });

    test('Department head cannot create custom report', async () => {
      const res = await request(app)
        .post('/api/analytics/reports')
        .set('Authorization', `Bearer ${departmentHeadToken}`)
        .send({
          name: 'Test Report',
          type: 'task',
          parameters: {}
        });

      expect(res.statusCode).toBe(403);
    });

    test('Employee cannot access custom reports', async () => {
      const res = await request(app)
        .get('/api/analytics/reports')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Validation', () => {
    test('Invalid date range returns 400', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2024-12-31',
          endDate: '2024-01-01'
        });

      expect(res.statusCode).toBe(400);
    });

    test('Invalid department ID returns 400', async () => {
      const res = await request(app)
        .get('/api/analytics/department/invalid/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(400);
    });

    test('Invalid user ID returns 400', async () => {
      const res = await request(app)
        .get('/api/analytics/user/invalid/performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(400);
    });

    test('Invalid period returns 400', async () => {
      const res = await request(app)
        .get(`/api/analytics/department/${departmentId}/trends`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          period: 'invalid',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(400);
    });

    test('Invalid report type returns 400', async () => {
      const res = await request(app)
        .post('/api/analytics/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Report',
          type: 'invalid',
          parameters: {}
        });

      expect(res.statusCode).toBe(400);
    });

    test('Missing required fields returns 400', async () => {
      const res = await request(app)
        .post('/api/analytics/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Report'
        });

      expect(res.statusCode).toBe(400);
    });
  });
});

describe('Analytics Export Endpoints', () => {
  let reportId;

  beforeAll(async () => {
    // Create a custom report for export tests
    const res = await request(app)
      .post('/api/analytics/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Export Test Report',
        description: 'For export testing',
        type: 'task',
        parameters: {
          departmentId,
          startDate: '2024-06-01',
          endDate: '2024-06-01'
        }
      });
    reportId = res.body.id;
  });

  test('Admin can export department metrics as CSV', async () => {
    const res = await request(app)
      .get(`/api/analytics/department/${departmentId}/metrics/export`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        format: 'csv',
        startDate: '2024-06-01',
        endDate: '2024-06-01'
      });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('totalTasks');
  });

  test('Admin can export department metrics as Excel', async () => {
    const res = await request(app)
      .get(`/api/analytics/department/${departmentId}/metrics/export`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        format: 'excel',
        startDate: '2024-06-01',
        endDate: '2024-06-01'
      })
      .buffer();
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    if (Buffer.isBuffer(res.body)) {
      expect(res.body.length).toBeGreaterThan(0);
    }
  });

  test('Department head can export user performance as CSV', async () => {
    const res = await request(app)
      .get(`/api/analytics/user/${userId}/performance/export`)
      .set('Authorization', `Bearer ${departmentHeadToken}`)
      .query({
        format: 'csv',
        startDate: '2024-06-01',
        endDate: '2024-06-01'
      });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('tasksCompleted');
  });

  test('Department head can export user performance as Excel', async () => {
    const res = await request(app)
      .get(`/api/analytics/user/${userId}/performance/export`)
      .set('Authorization', `Bearer ${departmentHeadToken}`)
      .query({
        format: 'excel',
        startDate: '2024-06-01',
        endDate: '2024-06-01'
      })
      .buffer();
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    if (Buffer.isBuffer(res.body)) {
      expect(res.body.length).toBeGreaterThan(0);
    }
  });

  test('Admin can export custom report as CSV', async () => {
    const res = await request(app)
      .get(`/api/analytics/reports/${reportId}/export`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ format: 'csv' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    // Accept empty CSV as valid
  });

  test('Admin can export custom report as Excel', async () => {
    const res = await request(app)
      .get(`/api/analytics/reports/${reportId}/export`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ format: 'excel' })
      .buffer();
    // Accept 200 or 204 (no content) as valid
    expect([200, 204]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.headers['content-type']).toContain('spreadsheetml');
      if (Buffer.isBuffer(res.body)) {
        expect(res.body.length).toBeGreaterThan(0);
      }
    }
  });

  test('Employee cannot export department metrics', async () => {
    const res = await request(app)
      .get(`/api/analytics/department/${departmentId}/metrics/export`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .query({
        format: 'csv',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });
    expect(res.statusCode).toBe(403);
  });

  test('Employee cannot export custom report', async () => {
    const res = await request(app)
      .get(`/api/analytics/reports/${reportId}/export`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .query({ format: 'csv' });
    expect(res.statusCode).toBe(403);
  });
});

describe('Dashboard Visualization Endpoints', () => {
  test('Admin can get task distribution', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/task-distribution')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('byStatus');
    expect(res.body).toHaveProperty('byPriority');
  });

  test('Department head can get task distribution for their department', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/task-distribution')
      .set('Authorization', `Bearer ${departmentHeadToken}`)
      .query({
        departmentId,
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('byStatus');
    expect(res.body).toHaveProperty('byPriority');
  });

  test('Admin can get performance trends', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/performance-trends')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        period: 'monthly'
      });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('date');
      expect(res.body[0]).toHaveProperty('completionRate');
      expect(res.body[0]).toHaveProperty('averageResolutionTime');
    }
  });

  test('Admin can get department comparison', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/department-comparison')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('departmentId');
      expect(res.body[0]).toHaveProperty('departmentName');
      expect(res.body[0]).toHaveProperty('totalTasks');
    }
  });

  test('Department head cannot get department comparison', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/department-comparison')
      .set('Authorization', `Bearer ${departmentHeadToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

    expect(res.statusCode).toBe(403);
  });

  test('Admin can get user activity metrics', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/user-activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('userId');
      expect(res.body[0]).toHaveProperty('firstname');
      expect(res.body[0]).toHaveProperty('lastname');
      expect(res.body[0]).toHaveProperty('action');
    }
  });

  test('Admin can get priority metrics', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/priority-metrics')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('priority');
      expect(res.body[0]).toHaveProperty('total');
      expect(res.body[0]).toHaveProperty('completionRate');
    }
  });

  test('Employee cannot access dashboard endpoints', async () => {
    const endpoints = [
      '/api/analytics/dashboard/task-distribution',
      '/api/analytics/dashboard/performance-trends',
      '/api/analytics/dashboard/user-activity',
      '/api/analytics/dashboard/priority-metrics'
    ];

    for (const endpoint of endpoints) {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${employeeToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(res.statusCode).toBe(403);
    }
  });

  test('Invalid date range returns 400', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/task-distribution')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-12-31',
        endDate: '2024-01-01'
      });

    expect(res.statusCode).toBe(400);
  });

  test('Invalid period returns 400', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/performance-trends')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        period: 'invalid'
      });

    expect(res.statusCode).toBe(400);
  });
});

describe('Advanced Filtering', () => {
  test('Admin can filter department metrics by status', async () => {
    const res = await request(app)
      .get(`/api/analytics/department/${departmentId}/metrics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        status: 'completed'
      });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Admin can filter user performance by priority', async () => {
    const res = await request(app)
      .get(`/api/analytics/user/${userId}/performance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        priority: 'high'
      });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Admin can filter task trends by assignedTo', async () => {
    const res = await request(app)
      .get(`/api/analytics/department/${departmentId}/trends`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        period: 'monthly',
        assignedTo: userId
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('completionRate');
  });

  test('Admin can filter priority metrics by createdBy', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/priority-metrics')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        createdBy: admin.id
      });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Admin can filter task distribution by status and priority', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/task-distribution')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        status: 'pending',
        priority: 'high'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('byStatus');
    expect(res.body).toHaveProperty('byPriority');
  });
});

describe('Anomaly & Trend Detection', () => {
  test('Admin can get department anomalies', async () => {
    const res = await request(app)
      .get(`/api/analytics/dashboard/department/${departmentId}/anomalies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Admin can get user anomalies', async () => {
    const res = await request(app)
      .get(`/api/analytics/dashboard/user/${userId}/anomalies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Admin can get department trends', async () => {
    const res = await request(app)
      .get(`/api/analytics/dashboard/department/${departmentId}/trends`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('metric');
      expect(res.body[0]).toHaveProperty('trend');
    }
  });
});

describe('Predictive Analytics & Forecasting', () => {
  test('Admin can get task completion forecast', async () => {
    const res = await request(app)
      .get(`/api/analytics/dashboard/department/${departmentId}/forecast/task-completion`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('date');
      expect(res.body[0]).toHaveProperty('predictedCompletedTasks');
    }
  });

  test('Admin can get user productivity forecast', async () => {
    const res = await request(app)
      .get(`/api/analytics/dashboard/user/${userId}/forecast/productivity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('date');
      expect(res.body[0]).toHaveProperty('predictedProductivityScore');
    }
  });

  test('Admin can get department workload forecast', async () => {
    const res = await request(app)
      .get(`/api/analytics/dashboard/department/${departmentId}/forecast/workload`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('date');
      expect(res.body[0]).toHaveProperty('predictedTotalTasks');
    }
  });
});

describe('Real-Time Analytics & Live Dashboards', () => {
  test('Admin can get live task status', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/live/task-status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Admin can get live user activity', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/live/user-activity')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Admin can get live department metrics', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard/live/department-metrics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
  });
}); 