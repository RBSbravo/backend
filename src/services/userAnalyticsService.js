const { Task, User, Department, Ticket, UserActivityLog, Comment } = require('../models');
const { Op } = require('sequelize');
const { safeParseDate, getDateString } = require('../utils/analyticsUtils');

// User analytics functions

async function calculateUserPerformance(userId, date) {
  const tasks = await Task.findAll({
    where: {
      assignedToId: userId,
      createdAt: {
        [Op.lte]: date
      }
    }
  });

  const performance = {
    tasksCompleted: tasks.filter(task => task.status === 'completed').length,
    tasksOverdue: tasks.filter(task => 
      task.status !== 'completed' && 
      new Date(task.dueDate) < new Date()
    ).length,
    averageResponseTime: 0,
    productivityScore: 0
  };

  // Calculate average response time (time to first action on task)
  const tasksWithComments = tasks.filter(task => task.comments && task.comments.length > 0);
  if (tasksWithComments.length > 0) {
    const totalResponseTime = tasksWithComments.reduce((sum, task) => {
      const firstComment = task.comments[0];
      const responseTime = new Date(firstComment.createdAt) - new Date(task.createdAt);
      return sum + responseTime;
    }, 0);
    performance.averageResponseTime = totalResponseTime / tasksWithComments.length;
  }

  // Calculate productivity score (0-100)
  const totalTasks = tasks.length;
  if (totalTasks > 0) {
    const completionRate = performance.tasksCompleted / totalTasks;
    const overdueRate = performance.tasksOverdue / totalTasks;
    performance.productivityScore = (completionRate * 100) - (overdueRate * 50);
  }

  return performance;
}

async function getUserPerformanceMetrics(userId, startDate, endDate) {
  // Calculate user performance on-the-fly from Task table for real-time accuracy
  const tasks = await Task.findAll({
    where: {
      assignedToId: userId,
      createdAt: {
        [Op.between]: [startDate, endDate]
      }
    },
    attributes: [
      'status',
      'dueDate',
      'createdAt',
      'updatedAt',
      [require('sequelize').fn('DATE', require('sequelize').col('createdAt')), 'date']
    ],
    include: [{
      model: Comment,
      as: 'comments',
      attributes: ['createdAt'],
      order: [['createdAt', 'ASC']],
      limit: 1
    }],
    order: [['createdAt', 'ASC']]
  });

  // Group tasks by date and calculate performance metrics
  const performanceByDate = {};
  
  tasks.forEach(task => {
    const date = task.getDataValue('date');
    if (!performanceByDate[date]) {
      performanceByDate[date] = {
        date,
        tasksCompleted: 0,
        tasksOverdue: 0,
        averageResponseTime: 0,
        productivityScore: 0,
        totalTasks: 0
      };
    }
    
    performanceByDate[date].totalTasks++;
    
    if (task.status === 'completed') {
      performanceByDate[date].tasksCompleted++;
    }
    
    // Check if overdue
    if (task.status !== 'completed' && new Date(task.dueDate) < new Date()) {
      performanceByDate[date].tasksOverdue++;
    }
  });

  // Calculate response time and productivity score for each date
  Object.keys(performanceByDate).forEach(date => {
    const dateTasks = tasks.filter(task => task.getDataValue('date') === date);
    
    // Calculate average response time (time to first comment)
    const tasksWithComments = dateTasks.filter(task => task.comments && task.comments.length > 0);
    if (tasksWithComments.length > 0) {
      const totalResponseTime = tasksWithComments.reduce((sum, task) => {
        const firstComment = task.comments[0];
        const responseTime = new Date(firstComment.createdAt) - new Date(task.createdAt);
        return sum + responseTime;
      }, 0);
      performanceByDate[date].averageResponseTime = totalResponseTime / tasksWithComments.length;
    }
    
    // Calculate productivity score (0-100)
    const totalTasks = performanceByDate[date].totalTasks;
    if (totalTasks > 0) {
      const completionRate = performanceByDate[date].tasksCompleted / totalTasks;
      const overdueRate = performanceByDate[date].tasksOverdue / totalTasks;
      performanceByDate[date].productivityScore = (completionRate * 100) - (overdueRate * 50);
    }
  });

  // Convert to array and sort by date
  const performance = Object.values(performanceByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  
  return performance;
}

module.exports = {
  calculateUserPerformance,
  getUserPerformanceMetrics
}; 