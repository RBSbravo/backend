const { Task, User, Department, Ticket, UserSession } = require('../models');
const { Op } = require('sequelize');
const { safeParseDate, getDateString } = require('../utils/analyticsUtils');

// Department analytics functions

// Helper function to calculate active employees with multiple accuracy levels
async function calculateActiveEmployees(departmentUsers) {
  const departmentUserIds = departmentUsers.map(user => user.id);
  
  // Get current time for different activity windows
  const now = new Date();
  
  // Clean up expired and inactive sessions for better accuracy
  await UserSession.update(
    { isActive: false },
    {
      where: {
        isActive: true,
        [Op.or]: [
          { expiresAt: { [Op.lt]: now } }, // Expired sessions
          { updatedAt: { [Op.lt]: new Date(now.getTime() - 8 * 60 * 60 * 1000) } } // Inactive for 8+ hours
        ]
      }
    }
  );
  const veryRecent = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
  const recent = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  
  // Count users with different activity levels
  const veryActiveCount = await UserSession.count({
    where: { 
      isActive: true,
      userId: { [Op.in]: departmentUserIds },
      expiresAt: { [Op.gt]: now },
      updatedAt: { [Op.gte]: veryRecent } // Active within 30 minutes
    }
  });
  
  const activeCount = await UserSession.count({
    where: { 
      isActive: true,
      userId: { [Op.in]: departmentUserIds },
      expiresAt: { [Op.gt]: now },
      updatedAt: { [Op.gte]: recent } // Active within 2 hours
    }
  });
  
  const totalActiveCount = await UserSession.count({
    where: { 
      isActive: true,
      userId: { [Op.in]: departmentUserIds },
      expiresAt: { [Op.gt]: now } // Any active session
    }
  });
  
  // Return the most accurate count based on activity level
  // Priority: Very Active (30min) > Active (2h) > Total Active (8h)
  if (veryActiveCount > 0) {
    return veryActiveCount; // Most accurate - users active within 30 minutes
  } else if (activeCount > 0) {
    return activeCount; // Moderately accurate - users active within 2 hours
  } else {
    return totalActiveCount; // Fallback - any active session
  }
}

async function calculateDepartmentAnalytics(departmentId, date) {
  const department = await Department.findByPk(departmentId, {
    include: [{
      model: User,
      as: 'Users'
    }]
  });

  // Calculate active employees based on actual sessions
  const activeEmployees = await calculateActiveEmployees(department.Users);

  const analytics = {
    totalEmployees: department.Users.length,
    activeEmployees: activeEmployees,
    departmentEfficiency: 0,
    averageTaskCompletionTime: 0
  };

  // Calculate department efficiency
  const tasks = await Task.findAll({
    where: {
      departmentId,
      createdAt: {
        [Op.lte]: date
      }
    }
  });

  const completedTasks = tasks.filter(task => task.status === 'completed');
  if (completedTasks.length > 0) {
    const totalCompletionTime = completedTasks.reduce((sum, task) => {
      const completionTime = new Date(task.updatedAt) - new Date(task.createdAt);
      // Ensure completion time is not negative (updatedAt should be >= createdAt)
      return sum + Math.max(0, completionTime);
    }, 0);
    analytics.averageTaskCompletionTime = totalCompletionTime / completedTasks.length;
  } else {
    // Set to null when no completed tasks to indicate no data
    analytics.averageTaskCompletionTime = null;
  }

  // Calculate department efficiency score (0-100) - consider both tasks and tickets
  const totalTasks = tasks.length;
  
  // Get tickets for the department
  const departmentUsers = await User.findAll({
    where: { departmentId },
    attributes: ['id']
  });
  
  const userIds = departmentUsers.map(user => user.id);
  
  const tickets = await Ticket.findAll({
    where: {
      [Op.or]: [
        { assigned_to: { [Op.in]: userIds } },
        { forwarded_to_id: { [Op.in]: userIds } },
        { current_handler_id: { [Op.in]: userIds } }
      ],
      createdAt: {
        [Op.lte]: date
      }
    }
  });
  
  const completedTickets = tickets.filter(ticket => ticket.status === 'completed');
  const closedTickets = tickets.filter(ticket => ticket.status === 'declined');
  const totalTickets = tickets.length;
  
  // Calculate combined efficiency from both tasks and tickets
  let taskEfficiency = 0;
  let ticketEfficiency = 0;
  let combinedEfficiency = 0;
  
  // Calculate task efficiency
  if (totalTasks > 0) {
    const completionRate = completedTasks.length / totalTasks;
    const overdueRate = tasks.filter(task => 
      task.status !== 'completed' && 
      task.dueDate && 
      new Date(task.dueDate) < new Date()
    ).length / totalTasks;
    
    const onTimeRate = tasks.filter(task => 
      task.status === 'completed' && 
      task.dueDate && 
      new Date(task.updatedAt) <= new Date(task.dueDate)
    ).length / totalTasks;
    
    const baseScore = completionRate * 100;
    const overduePenalty = overdueRate * 30;
    const onTimeBonus = onTimeRate * 10;
    
    taskEfficiency = Math.max(0, Math.min(100, baseScore - overduePenalty + onTimeBonus));
  }
  
  // Calculate ticket efficiency
  if (totalTickets > 0) {
    const ticketResolutionRate = (completedTickets.length + closedTickets.length) / totalTickets;
    const ticketOverdueRate = tickets.filter(ticket => 
      ticket.status !== 'completed' && 
      ticket.status !== 'declined' &&
      ticket.dueDate && 
      new Date(ticket.dueDate) < new Date()
    ).length / totalTickets;
    
    const ticketOnTimeRate = tickets.filter(ticket => 
      (ticket.status === 'completed' || ticket.status === 'declined') && 
      ticket.dueDate && 
      new Date(ticket.updatedAt) <= new Date(ticket.dueDate)
    ).length / totalTickets;
    
    const baseScore = ticketResolutionRate * 100;
    const overduePenalty = ticketOverdueRate * 30;
    const onTimeBonus = ticketOnTimeRate * 10;
    
    ticketEfficiency = Math.max(0, Math.min(100, baseScore - overduePenalty + onTimeBonus));
  }
  
  // Calculate combined efficiency with weighted average
  if (totalTasks > 0 && totalTickets > 0) {
    // Both tasks and tickets available - use weighted average (60% tasks, 40% tickets)
    combinedEfficiency = (taskEfficiency * 0.6) + (ticketEfficiency * 0.4);
  } else if (totalTasks > 0) {
    // Only tasks available
    combinedEfficiency = taskEfficiency;
  } else if (totalTickets > 0) {
    // Only tickets available
    combinedEfficiency = ticketEfficiency;
  } else {
    // No tasks or tickets - efficiency remains 0
    combinedEfficiency = 0;
  }
  
  analytics.departmentEfficiency = Math.round(combinedEfficiency);

  return analytics;
}

async function getDepartmentAnalytics(departmentId, startDate, endDate) {
  // Set default date range if not provided - make it more inclusive
  if (!startDate) {
    startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1); // Last 1 year instead of 6 months
    startDate = startDate.toISOString().split('T')[0];
  }
  if (!endDate) {
    endDate = new Date().toISOString().split('T')[0];
  }

  // Calculate department analytics on-the-fly for real-time accuracy
  const department = await Department.findByPk(departmentId, {
    include: [{
      model: User,
      as: 'Users',
      attributes: ['id', 'firstname', 'lastname', 'isActive']
    }]
  });

  if (!department) {
    throw new Error('Department not found');
  }

  // Calculate active employees based on actual sessions
  const activeEmployees = await calculateActiveEmployees(department.Users);

  // Calculate current department stats
  const departmentStats = {
    totalEmployees: department.Users.length,
    activeEmployees: activeEmployees,
    departmentEfficiency: 0,
    averageTaskCompletionTime: 0
  };

  // Get all tasks for the department
  const allTasks = await Task.findAll({
    where: {
      departmentId
    },
    include: [{
      model: User,
      as: 'assignedUser',
      attributes: ['id', 'firstname', 'lastname']
    }]
  });

  // Calculate department efficiency and average completion time
  const completedTasks = allTasks.filter(task => task.status === 'completed');
  if (completedTasks.length > 0) {
    const totalCompletionTime = completedTasks.reduce((sum, task) => {
      const completionTime = new Date(task.updatedAt) - new Date(task.createdAt);
      // Ensure completion time is not negative (updatedAt should be >= createdAt)
      return sum + Math.max(0, completionTime);
    }, 0);
    departmentStats.averageTaskCompletionTime = totalCompletionTime / completedTasks.length;
  } else {
    // Set to null when no completed tasks to indicate no data
    departmentStats.averageTaskCompletionTime = null;
  }

  // Calculate department efficiency score (0-100) - consider both tasks and tickets
  const totalTasks = allTasks.length;
  
  // Get tickets for the department
  const deptUsers = await User.findAll({
    where: { departmentId },
    attributes: ['id']
  });
  
  const deptUserIds = deptUsers.map(user => user.id);
  
  const deptTickets = await Ticket.findAll({
    where: {
      [Op.or]: [
        { assigned_to: { [Op.in]: deptUserIds } },
        { forwarded_to_id: { [Op.in]: deptUserIds } },
        { current_handler_id: { [Op.in]: deptUserIds } }
      ]
    }
  });
  
  const completedTickets = deptTickets.filter(ticket => ticket.status === 'completed');
  const closedTickets = deptTickets.filter(ticket => ticket.status === 'declined');
  const totalTickets = deptTickets.length;
  
  // Calculate combined efficiency from both tasks and tickets
  let taskEfficiency = 0;
  let ticketEfficiency = 0;
  let combinedEfficiency = 0;
  
  // Calculate task efficiency
  if (totalTasks > 0) {
    const completionRate = completedTasks.length / totalTasks;
    const overdueRate = allTasks.filter(task => 
      task.status !== 'completed' && 
      task.dueDate && 
      new Date(task.dueDate) < new Date()
    ).length / totalTasks;
    
    const onTimeRate = allTasks.filter(task => 
      task.status === 'completed' && 
      task.dueDate && 
      new Date(task.updatedAt) <= new Date(task.dueDate)
    ).length / totalTasks;
    
    const baseScore = completionRate * 100;
    const overduePenalty = overdueRate * 30;
    const onTimeBonus = onTimeRate * 10;
    
    taskEfficiency = Math.max(0, Math.min(100, baseScore - overduePenalty + onTimeBonus));
  }
  
  // Calculate ticket efficiency
  if (totalTickets > 0) {
    const ticketResolutionRate = (completedTickets.length + closedTickets.length) / totalTickets;
    const ticketOverdueRate = deptTickets.filter(ticket => 
      ticket.status !== 'completed' && 
      ticket.status !== 'declined' &&
      ticket.dueDate && 
      new Date(ticket.dueDate) < new Date()
    ).length / totalTickets;
    
    const ticketOnTimeRate = deptTickets.filter(ticket => 
      (ticket.status === 'completed' || ticket.status === 'declined') && 
      ticket.dueDate && 
      new Date(ticket.updatedAt) <= new Date(ticket.dueDate)
    ).length / totalTickets;
    
    const baseScore = ticketResolutionRate * 100;
    const overduePenalty = ticketOverdueRate * 30;
    const onTimeBonus = ticketOnTimeRate * 10;
    
    ticketEfficiency = Math.max(0, Math.min(100, baseScore - overduePenalty + onTimeBonus));
  }
  
  // Calculate combined efficiency with weighted average
  if (totalTasks > 0 && totalTickets > 0) {
    // Both tasks and tickets available - use weighted average (60% tasks, 40% tickets)
    combinedEfficiency = (taskEfficiency * 0.6) + (ticketEfficiency * 0.4);
  } else if (totalTasks > 0) {
    // Only tasks available
    combinedEfficiency = taskEfficiency;
  } else if (totalTickets > 0) {
    // Only tickets available
    combinedEfficiency = ticketEfficiency;
  } else {
    // No tasks or tickets - efficiency remains 0
    combinedEfficiency = 0;
  }
  
  departmentStats.departmentEfficiency = Math.round(combinedEfficiency);

  // Filter tasks by date range for monthly metrics
  const tasks = allTasks.filter(task => {
    const taskDate = getDateString(task.createdAt);
    return taskDate && taskDate >= startDate && taskDate <= endDate;
  });

  // Group tasks by month - use last 6 months from current date
  const taskMetrics = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentDate = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthName = months[month.getMonth()];
    const monthStart = month.toISOString().split('T')[0];
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const monthTasks = tasks.filter(task => {
      const taskDate = getDateString(task.createdAt);
      return taskDate && taskDate >= monthStart && taskDate <= monthEnd;
    });
    
    taskMetrics.push({
      name: monthName,
      completed: monthTasks.filter(t => t.status === 'completed').length,
      inProgress: monthTasks.filter(t => t.status === 'in_progress').length,
      pending: monthTasks.filter(t => t.status === 'pending').length
    });
  }

  // Add total task distribution for pie chart (across all time periods)
  const totalTaskDistribution = {
    name: 'Total',
    completed: allTasks.filter(t => t.status === 'completed').length,
    inProgress: allTasks.filter(t => t.status === 'in_progress').length,
    pending: allTasks.filter(t => t.status === 'pending').length
  };
  
  // Add total distribution as first item for pie chart
  taskMetrics.unshift(totalTaskDistribution);

  // Generate ticket metrics from tickets received by the department
  // Get all users in the department first
  const departmentUsers = await User.findAll({
    where: { departmentId },
    attributes: ['id', 'firstname', 'lastname', 'role']
  });
  
  const userIds = departmentUsers.map(user => user.id);
  
  const allTickets = await Ticket.findAll({
    where: {
      [Op.or]: [
        { assigned_to: { [Op.in]: userIds } },
        { forwarded_to_id: { [Op.in]: userIds } },
        { current_handler_id: { [Op.in]: userIds } }
      ]
    }
  });

  // Filter tickets by date range
  const tickets = allTickets.filter(ticket => {
    const ticketDate = getDateString(ticket.createdAt);
    return ticketDate && ticketDate >= startDate && ticketDate <= endDate;
  });

  // Group tickets by month
  const ticketMetrics = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthName = months[month.getMonth()];
    const monthStart = month.toISOString().split('T')[0];
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const monthTickets = tickets.filter(ticket => {
      const ticketDate = getDateString(ticket.createdAt);
      return ticketDate && ticketDate >= monthStart && ticketDate <= monthEnd;
    });
    
    ticketMetrics.push({
      name: monthName,
      resolved: monthTickets.filter(t => t.status === 'completed').length,
      closed: monthTickets.filter(t => t.status === 'declined').length,
      pending: monthTickets.filter(t => t.status === 'pending').length,
      inProgress: monthTickets.filter(t => t.status === 'in_progress').length
    });
  }

  // Add total ticket distribution for pie chart (across all time periods)
  const totalTicketDistribution = {
    name: 'Total',
    resolved: allTickets.filter(t => t.status === 'completed').length,
    closed: allTickets.filter(t => t.status === 'declined').length,
    pending: allTickets.filter(t => t.status === 'pending').length,
    inProgress: allTickets.filter(t => t.status === 'in_progress').length
  };
  
  // Add total distribution as first item for pie chart
  ticketMetrics.unshift(totalTicketDistribution);

  // Generate user performance data
  const users = await User.findAll({
    where: { departmentId },
    attributes: ['id', 'firstname', 'lastname', 'role']
  });

  const userPerformance = await Promise.all(users.map(async (user) => {
    const userTasks = allTasks.filter(task => task.assignedToId === user.id);
    // Count tickets received by this user (assigned, forwarded, or currently handling)
    const userTickets = allTickets.filter(ticket => 
      ticket.assigned_to === user.id || 
      ticket.forwarded_to_id === user.id || 
      ticket.current_handler_id === user.id
    );
    
    const completedTasks = userTasks.filter(task => task.status === 'completed').length;
    const totalTasks = userTasks.length;
    
    // Count tickets by status
    const resolvedTickets = userTickets.filter(ticket => ticket.status === 'completed').length;
    const closedTickets = userTickets.filter(ticket => ticket.status === 'declined').length;
    const totalTickets = userTickets.length;
    
    // Smart efficiency calculation based on available data
    let efficiency = 0;
    
    // Determine which efficiency to calculate based on available data and role
    const shouldUseTicketEfficiency = user.role === 'department_head' || (user.role === 'employee' && totalTickets > 0 && totalTasks === 0);
    const shouldUseTaskEfficiency = user.role === 'employee' && totalTasks > 0;
    
    if (shouldUseTicketEfficiency && totalTickets > 0) {
      // Calculate ticket efficiency
      const ticketResolutionRate = (resolvedTickets + closedTickets) / totalTickets;
      const ticketOverdueRate = userTickets.filter(ticket => 
        ticket.status !== 'completed' && 
        ticket.status !== 'declined' &&
        ticket.dueDate && 
        new Date(ticket.dueDate) < new Date()
      ).length / totalTickets;
      
      const ticketOnTimeRate = userTickets.filter(ticket => 
        (ticket.status === 'completed' || ticket.status === 'declined') && 
        ticket.dueDate && 
        new Date(ticket.updatedAt) <= new Date(ticket.dueDate)
      ).length / totalTickets;
      
      // Ticket efficiency calculation
      const baseScore = ticketResolutionRate * 100;
      const overduePenalty = ticketOverdueRate * 30;
      const onTimeBonus = ticketOnTimeRate * 10;
      
      efficiency = Math.max(0, Math.min(100, Math.round(baseScore - overduePenalty + onTimeBonus)));
    } else if (shouldUseTaskEfficiency) {
      // Calculate task efficiency
      const taskCompletionRate = completedTasks / totalTasks;
      const taskOverdueRate = userTasks.filter(task => 
        task.status !== 'completed' && 
        task.dueDate && 
        new Date(task.dueDate) < new Date()
      ).length / totalTasks;
      
      const taskOnTimeRate = userTasks.filter(task => 
        task.status === 'completed' && 
        task.dueDate && 
        new Date(task.updatedAt) <= new Date(task.dueDate)
      ).length / totalTasks;
      
      // Task efficiency calculation
      const baseScore = taskCompletionRate * 100;
      const overduePenalty = taskOverdueRate * 30;
      const onTimeBonus = taskOnTimeRate * 10;
      
      efficiency = Math.max(0, Math.min(100, Math.round(baseScore - overduePenalty + onTimeBonus)));
    }
    
    return {
      name: `${user.firstname} ${user.lastname}`,
      role: user.role,
      tasks: totalTasks,
      tickets: userTickets.length,
      efficiency: efficiency
    };
  }));

  const result = {
    departmentStats: departmentStats,
    taskMetrics: taskMetrics,
    ticketMetrics: ticketMetrics,
    userPerformance: userPerformance
  };

  return result || {};
}

module.exports = {
  calculateDepartmentAnalytics,
  getDepartmentAnalytics
}; 