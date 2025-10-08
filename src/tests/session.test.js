const request = require('supertest');
const { app } = require('../app');
const { User, UserSession, Department, sequelize, syncModels } = require('../models');

describe('Session Management', () => {
  let user;
  let session;
  let department;

  beforeAll(async () => {
    await syncModels();
    // Create a department for the user
    department = await Department.create({ name: 'Test Department' });
    user = await User.create({
      firstname: 'testuser',
      lastname: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'employee',
      departmentId: department.id,
      status: 'approved'
    });
  });

  afterAll(async () => {
    await UserSession.destroy({ where: {} });
    await User.destroy({ where: {} });
    await Department.destroy({ where: {} });
  });

  it('should create a session on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    session = await UserSession.findOne({ where: { userId: user.id } });
    expect(session).toBeDefined();
    expect(session.isActive).toBe(true);
  });

  it('should invalidate session on logout', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${session.token}`);
    expect(res.status).toBe(200);
    await session.reload();
    expect(session.isActive).toBe(false);
  });
}); 