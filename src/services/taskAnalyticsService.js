const { Task, User, Department, Comment } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { safeParseDate, getDateString, getWeek } = require('../utils/analyticsUtils');

// Task analytics functions

async function calculateTaskMetrics(departmentId, date) {
  const tasks = await Task.findAll({
    where: {
      departmentId,
      createdAt: {
        [Op.lte]: date
      }
    }
  });

  const metrics = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(task => task.status === 'completed').length,
    pendingTasks: tasks.filter(task => task.status === 'pending').length,
    overdueTasks: tasks.filter(task => 
      task.status !== 'completed' && 
      new Date(task.dueDate) < new Date()
    ).length,
    averageCompletionTime: 0
  };

  const completedTasks = tasks.filter(task => task.status === 'completed');
  if (completedTasks.length > 0) {
    const totalCompletionTime = completedTasks.reduce((sum, task) => {
      const completionTime = new Date(task.updatedAt) - new Date(task.createdAt);
      return sum + completionTime;
    }, 0);
    metrics.averageCompletionTime = totalCompletionTime / completedTasks.length;
  }

  return metrics;
}

async function calculateTaskTrends(departmentId, period, startDate, endDate) {
  const tasks = await Task.findAll({
    where: {
      departmentId,
      createdAt: {
        [Op.between]: [startDate, endDate]
      }
    }
  });

  const trends = {
    completionRate: 0,
    averageResolutionTime: 0,
    priorityDistribution: {
      high: 0,
      medium: 0,
      low: 0
    },
    statusDistribution: {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0
    }
  };

  // Calculate completion rate
  const completedTasks = tasks.filter(task => task.status === 'completed');
  trends.completionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

  // Calculate average resolution time
  if (completedTasks.length > 0) {
    const totalResolutionTime = completedTasks.reduce((sum, task) => {
      const createdDate = safeParseDate(task.createdAt);
      const updatedDate = safeParseDate(task.updatedAt);
      if (createdDate && updatedDate) {
        return sum + (updatedDate.getTime() - createdDate.getTime());
      }
      return sum;
    }, 0);
    trends.averageResolutionTime = totalResolutionTime / completedTasks.length;
  }

  // Calculate priority distribution
  tasks.forEach(task => {
    trends.priorityDistribution[task.priority]++;
  });

  // Calculate status distribution
  tasks.forEach(task => {
    trends.statusDistribution[task.status]++;
  });

  return trends;
}

async function getTaskDistribution(departmentId, startDate, endDate, filters = {}) {
  const whereClause = {
    createdAt: {
      [Op.between]: [startDate, endDate]
    }
  };
  if (departmentId) whereClause.departmentId = departmentId;
  if (filters.status) whereClause.status = filters.status;
  if (filters.priority) whereClause.priority = filters.priority;
  if (filters.assignedTo) whereClause.assignedTo = filters.assignedTo;
  if (filters.createdBy) whereClause.createdBy = filters.createdBy;

  const tasks = await Task.findAll({
    where: whereClause,
    attributes: [
      'status',
      'priority',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['status', 'priority']
  });

  return {
    byStatus: tasks.reduce((acc, task) => {
      const status = task.getDataValue('status');
      const count = parseInt(task.getDataValue('count'));
      acc[status] = (acc[status] || 0) + count;
      return acc;
    }, {}),
    byPriority: tasks.reduce((acc, task) => {
      const priority = task.getDataValue('priority');
      const count = parseInt(task.getDataValue('count'));
      acc[priority] = (acc[priority] || 0) + count;
      return acc;
    }, {})
  };
}

module.exports = {
  calculateTaskMetrics,
  calculateTaskTrends,
  getTaskDistribution
}; 