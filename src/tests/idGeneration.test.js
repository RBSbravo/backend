const IDGenerator = require('../utils/idGenerator');
const { sequelize, IDSequences, syncModels } = require('../models');

describe('ID Generation System', () => {
  beforeAll(async () => {
    // Ensure database is synced
    await syncModels();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clear sequences before each test
    await IDSequences.destroy({ where: {} });
  });

  describe('IDGenerator.generateID', () => {
    test('should generate valid IDs with correct format', async () => {
      const idGenerator = new IDGenerator(sequelize, IDSequences);
      
      const userId = await idGenerator.generateID('USR');
      const taskId = await idGenerator.generateID('TSK');
      const ticketId = await idGenerator.generateID('TKT');
      
      // Check format: XXX-YYYYMMDD-XXXXX
      expect(userId).toMatch(/^USR-\d{8}-\d{5}$/);
      expect(taskId).toMatch(/^TSK-\d{8}-\d{5}$/);
      expect(ticketId).toMatch(/^TKT-\d{8}-\d{5}$/);
      
      // Check that IDs are different
      expect(userId).not.toBe(taskId);
      expect(taskId).not.toBe(ticketId);
    });

    test('should increment sequence numbers correctly', async () => {
      const idGenerator = new IDGenerator(sequelize, IDSequences);
      
      const id1 = await idGenerator.generateID('USR');
      const id2 = await idGenerator.generateID('USR');
      const id3 = await idGenerator.generateID('USR');
      
      const seq1 = IDGenerator.getSequence(id1);
      const seq2 = IDGenerator.getSequence(id2);
      const seq3 = IDGenerator.getSequence(id3);
      
      expect(seq2).toBe(seq1 + 1);
      expect(seq3).toBe(seq2 + 1);
    });

    test('should reset sequence daily', async () => {
      const idGenerator = new IDGenerator(sequelize, IDSequences);
      
      // Generate IDs for today
      const todayId1 = await idGenerator.generateID('TSK');
      const todayId2 = await idGenerator.generateID('TSK');
      
      // Mock tomorrow's date
      const originalDate = Date;
      global.Date = class extends Date {
        constructor() {
          const tomorrow = new originalDate();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return tomorrow;
        }
      };
      
      const tomorrowId = await idGenerator.generateID('TSK');
      
      // Restore original Date
      global.Date = originalDate;
      
      const todaySeq1 = IDGenerator.getSequence(todayId1);
      const todaySeq2 = IDGenerator.getSequence(todayId2);
      const tomorrowSeq = IDGenerator.getSequence(tomorrowId);
      
      expect(todaySeq2).toBe(todaySeq1 + 1);
      expect(tomorrowSeq).toBe(1); // Should reset to 1
    });

    test('should handle different prefixes independently', async () => {
      const idGenerator = new IDGenerator(sequelize, IDSequences);
      
      const userId = await idGenerator.generateID('USR');
      const taskId = await idGenerator.generateID('TSK');
      const ticketId = await idGenerator.generateID('TKT');
      
      expect(IDGenerator.getPrefix(userId)).toBe('USR');
      expect(IDGenerator.getPrefix(taskId)).toBe('TSK');
      expect(IDGenerator.getPrefix(ticketId)).toBe('TKT');
      
      // All should have sequence 1 since they're different prefixes
      expect(IDGenerator.getSequence(userId)).toBe(1);
      expect(IDGenerator.getSequence(taskId)).toBe(1);
      expect(IDGenerator.getSequence(ticketId)).toBe(1);
    });

    test('should throw error for invalid prefix length', async () => {
      const idGenerator = new IDGenerator(sequelize, IDSequences);
      
      await expect(idGenerator.generateID('')).rejects.toThrow('Prefix must be exactly 3 characters');
      await expect(idGenerator.generateID('AB')).rejects.toThrow('Prefix must be exactly 3 characters');
      await expect(idGenerator.generateID('ABCD')).rejects.toThrow('Prefix must be exactly 3 characters');
    });

    test('should convert prefix to uppercase', async () => {
      const idGenerator = new IDGenerator(sequelize, IDSequences);
      
      const lowercaseId = await idGenerator.generateID('usr');
      const mixedCaseId = await idGenerator.generateID('UsR');
      
      expect(IDGenerator.getPrefix(lowercaseId)).toBe('USR');
      expect(IDGenerator.getPrefix(mixedCaseId)).toBe('USR');
    });
  });

  describe('IDGenerator.validateID', () => {
    test('should validate correct ID format', () => {
      expect(IDGenerator.validateID('USR-20241201-00001')).toBe(true);
      expect(IDGenerator.validateID('TSK-20241201-00001')).toBe(true);
      expect(IDGenerator.validateID('TKT-20241201-00001')).toBe(true);
    });

    test('should reject invalid ID format', () => {
      expect(IDGenerator.validateID('USR-20241201-0001')).toBe(false); // 4 digits
      expect(IDGenerator.validateID('USR-20241201-000001')).toBe(false); // 6 digits
      expect(IDGenerator.validateID('USR-2024121-00001')).toBe(false); // 7 digits in date
      expect(IDGenerator.validateID('USR-202412001-00001')).toBe(false); // 9 digits in date
      expect(IDGenerator.validateID('US-20241201-00001')).toBe(false); // 2 letter prefix
      expect(IDGenerator.validateID('USRR-20241201-00001')).toBe(false); // 4 letter prefix
      expect(IDGenerator.validateID('usr-20241201-00001')).toBe(false); // lowercase prefix
      expect(IDGenerator.validateID('')).toBe(false);
      expect(IDGenerator.validateID(null)).toBe(false);
      expect(IDGenerator.validateID(undefined)).toBe(false);
    });

    test('should validate with expected prefix', () => {
      expect(IDGenerator.validateID('USR-20241201-00001', 'USR')).toBe(true);
      expect(IDGenerator.validateID('TSK-20241201-00001', 'TSK')).toBe(true);
      expect(IDGenerator.validateID('USR-20241201-00001', 'TSK')).toBe(false);
    });
  });

  describe('IDGenerator.parseID', () => {
    test('should parse valid ID correctly', () => {
      const parsed = IDGenerator.parseID('USR-20241201-00001');
      
      expect(parsed).toEqual({
        prefix: 'USR',
        date: '20241201',
        sequence: 1
      });
    });

    test('should throw error for invalid ID', () => {
      expect(() => IDGenerator.parseID('invalid')).toThrow('Invalid ID format');
      expect(() => IDGenerator.parseID('')).toThrow('Invalid ID format');
    });
  });

  describe('IDGenerator static methods', () => {
    test('should extract prefix correctly', () => {
      expect(IDGenerator.getPrefix('USR-20241201-00001')).toBe('USR');
      expect(IDGenerator.getPrefix('TSK-20241201-00001')).toBe('TSK');
      expect(IDGenerator.getPrefix('invalid')).toBe(null);
    });

    test('should extract date correctly', () => {
      expect(IDGenerator.getDate('USR-20241201-00001')).toBe('20241201');
      expect(IDGenerator.getDate('TSK-20241201-00001')).toBe('20241201');
      expect(IDGenerator.getDate('invalid')).toBe(null);
    });

    test('should extract sequence correctly', () => {
      expect(IDGenerator.getSequence('USR-20241201-00001')).toBe(1);
      expect(IDGenerator.getSequence('TSK-20241201-00099')).toBe(99);
      expect(IDGenerator.getSequence('invalid')).toBe(null);
    });
  });

  describe('Model Integration', () => {
    test('should generate IDs automatically when creating models', async () => {
      const { Department, User } = require('../models');
      
      const department = await Department.create({
        name: 'Test Department',
        description: 'Test Description'
      });
      
      const user = await User.create({
        firstname: 'testuser',
        lastname: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'employee',
        departmentId: department.id
      });
      
      expect(department.id).toMatch(/^DEP-\d{8}-\d{5}$/);
      expect(user.id).toMatch(/^USR-\d{8}-\d{5}$/);
    });
  });
}); 