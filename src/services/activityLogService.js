const { UserActivityLog, User } = require('../models');
const { Op } = require('sequelize');

// Activity log analytics functions

async function logUserActivity(userId, action, entityType, entityId, details = {}) {
  return await UserActivityLog.create({
    userId,
    action,
    entityType,
    entityId,
    details
  });
}

async function getActivityLogs(userId, startDate, endDate, action = null) {
  const where = {
    userId,
    timestamp: {
      [Op.between]: [startDate, endDate]
    }
  };
  if (action) {
    where.action = action;
  }
  return await UserActivityLog.findAll({
    where,
    order: [['timestamp', 'DESC']],
    include: [{
      model: User,
      attributes: ['id', 'firstname', 'lastname', 'email']
    }]
  });
}

module.exports = {
  logUserActivity,
  getActivityLogs
}; 