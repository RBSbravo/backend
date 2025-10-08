const { Task, User, Department, UserActivityLog, CustomReport, Ticket, Comment } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { safeParseDate, getDateString, getWeek } = require('../utils/analyticsUtils');
const taskAnalytics = require('./taskAnalyticsService');
const userAnalytics = require('./userAnalyticsService');
const departmentAnalytics = require('./departmentAnalyticsService');
const ticketAnalytics = require('./ticketAnalyticsService');
const reportService = require('./reportService');
const activityLogService = require('./activityLogService');

class AnalyticsService {
  async calculateUserPerformance(userId, date) {
    // This method is now in userAnalyticsService.js
  }

  async calculateDepartmentAnalytics(departmentId, date) {
    // This method is now in departmentAnalyticsService.js
  }

  async getDepartmentMetrics(departmentId, startDate, endDate) {
    // Calculate metrics on-the-fly from Task table for better real-time accuracy
    const tasks = await Task.findAll({
      where: {
        departmentId,
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'status',
        'dueDate',
        'createdAt',
        'updatedAt',
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date']
      ],
      order: [['createdAt', 'ASC']]
    });

    // Group tasks by date and calculate metrics
    const metricsByDate = {};
    
    tasks.forEach(task => {
      const date = task.getDataValue('date');
      if (!metricsByDate[date]) {
        metricsByDate[date] = {
          date,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          overdueTasks: 0,
          averageCompletionTime: 0
        };
      }
      
      metricsByDate[date].totalTasks++;
      
      if (task.status === 'completed') {
        metricsByDate[date].completedTasks++;
      } else if (task.status === 'pending') {
        metricsByDate[date].pendingTasks++;
      }
      
      // Check if overdue
      if (task.status !== 'completed' && new Date(task.dueDate) < new Date()) {
        metricsByDate[date].overdueTasks++;
      }
    });

    // Calculate average completion time for each date
    Object.keys(metricsByDate).forEach(date => {
      const dateTasks = tasks.filter(task => 
        task.getDataValue('date') === date && task.status === 'completed'
      );
      
      if (dateTasks.length > 0) {
        const totalCompletionTime = dateTasks.reduce((sum, task) => {
          const completionTime = new Date(task.updatedAt) - new Date(task.createdAt);
          return sum + completionTime;
        }, 0);
        metricsByDate[date].averageCompletionTime = totalCompletionTime / dateTasks.length;
      }
    });

    // Convert to array and sort by date
    const metrics = Object.values(metricsByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return metrics;
  }

  async getUserPerformanceMetrics(userId, startDate, endDate) {
    // This method is now in userAnalyticsService.js
  }

  async getDepartmentAnalytics(departmentId, startDate, endDate) {
    return await departmentAnalytics.getDepartmentAnalytics(departmentId, startDate, endDate);
  }

  async logUserActivity(userId, action, entityType, entityId, details = {}) {
    return await UserActivityLog.create({
      userId,
      action,
      entityType,
      entityId,
      details
    });
  }

  async generateCustomReport(reportId, userRole = null) {
    const report = await CustomReport.findByPk(reportId, {
      include: [{
        model: User,
        as: 'reportCreator',
        attributes: ['id', 'firstname', 'lastname', 'email', 'role']
      }]
    });

    if (!report) {
      throw new Error('Report not found');
    }

    let data;
    try {
      // Import the report generation service
      const reportGenerationService = require('./reportGenerationService');
      
      switch (report.type) {
        case 'ticket':
          data = await reportGenerationService.generateTicketReport(report.parameters, userRole || (report.reportCreator && report.reportCreator.role));
          break;
        case 'task':
          data = await reportGenerationService.generateTaskReport(report.parameters, userRole || (report.reportCreator && report.reportCreator.role));
          break;
        case 'user':
          data = await reportGenerationService.generateUserReport(report.parameters);
          break;
        case 'department':
          data = await reportGenerationService.generateDepartmentReport(report.parameters, report.reportCreator.role);
          break;
        case 'custom':
          data = await reportGenerationService.generateCustomReportData(report.parameters);
          break;
        default:
          throw new Error('Invalid report type');
        }
    } catch (error) {
      console.error(`Error generating ${report.type} report:`, error);
      // Return a meaningful error response instead of throwing
      data = {
        error: `Failed to generate ${report.type} report: ${error.message}`,
        summary: {
          totalRecords: 0,
          message: 'No data available for the specified criteria'
        }
      };
    }

    return {
      report: {
        id: report.id,
        name: report.name,
        title: report.name,
        type: report.type,
        createdAt: report.createdAt,
        parameters: report.parameters,
        reportCreator: report.reportCreator
      },
      data
    };
  }

  async generateTaskReport(parameters, userRole = null) {
    const { departmentId, startDate, endDate, status, priority } = parameters;
    // Set default date range if not provided
    const defaultStartDate = new Date();
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 1); // Last 30 days
    const queryStartDate = startDate || defaultStartDate.toISOString().split('T')[0];
    const queryEndDate = endDate || new Date().toISOString().split('T')[0];
    const where = {
      createdAt: {
        [Op.between]: [queryStartDate, queryEndDate]
      }
    };
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const tasks = await Task.findAll({
      where,
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: Department,
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // For admin with no departmentId, group tasks by department
    if (userRole === 'admin' && !departmentId) {
      const departments = await Department.findAll({ attributes: ['id', 'name'] });
      const grouped = {};
      departments.forEach(dept => {
        grouped[dept.id] = {
          departmentId: dept.id,
          departmentName: dept.name,
          tasks: []
        };
      });
      tasks.forEach(task => {
        const deptId = task.Department ? task.Department.id : task.departmentId;
        if (grouped[deptId]) {
          grouped[deptId].tasks.push(task);
        }
      });
      return {
        groupedTasks: grouped,
        summary: {
          totalTasks: tasks.length,
          completedTasks: tasks.filter(t => t.status === 'completed').length,
          pendingTasks: tasks.filter(t => t.status === 'pending').length,
          inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
          overdueTasks: tasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()).length,
          byPriority: {
            high: tasks.filter(t => t.priority === 'high').length,
            medium: tasks.filter(t => t.priority === 'medium').length,
            low: tasks.filter(t => t.priority === 'low').length
          },
          byStatus: {
            completed: tasks.filter(t => t.status === 'completed').length,
            pending: tasks.filter(t => t.status === 'pending').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            cancelled: tasks.filter(t => t.status === 'cancelled').length
          }
        },
        parameters: {
          startDate: queryStartDate,
          endDate: queryEndDate,
          departmentId,
          status,
          priority
        }
      };
    }

    // Generate summary statistics
    const summary = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
      overdueTasks: tasks.filter(t => 
        t.status !== 'completed' && 
        new Date(t.dueDate) < new Date()
      ).length,
      byPriority: {
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length
      },
      byStatus: {
        completed: tasks.filter(t => t.status === 'completed').length,
        pending: tasks.filter(t => t.status === 'pending').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length
      }
    };

    // Map/rename task fields for frontend compatibility
    const mappedTasks = tasks.map(task => ({
      title: task.title,
      status: task.status,
      priority: task.priority,
      createdAt: task.createdAt
    }));

    return {
      tasks: mappedTasks,
      summary,
      parameters: {
        startDate: queryStartDate,
        endDate: queryEndDate,
        departmentId,
        status,
        priority
      }
    };
  }

  async generateUserReport(parameters) {
    const { userId, userName, startDate, endDate } = parameters;
    
    if (!userId) {
      throw new Error('userId is required for user performance reports');
    }

    // Set default date range if not provided
    const defaultStartDate = new Date();
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 1); // Last 30 days
    
    const queryStartDate = startDate || defaultStartDate.toISOString().split('T')[0];
    const queryEndDate = endDate || new Date().toISOString().split('T')[0];

    // Get user's tasks
    const tasks = await Task.findAll({
      where: {
        assignedToId: userId,
        createdAt: {
          [Op.between]: [queryStartDate, queryEndDate]
        }
      },
      order: [['createdAt', 'DESC']]
    });

    // Get user's tickets
    const tickets = await Ticket.findAll({
      where: {
        assigned_to: userId,
        createdAt: {
          [Op.between]: [queryStartDate, queryEndDate]
        }
      }
    });

    // Ticket summary
    const ticketSummary = {
      totalTickets: tickets.length,
      pendingTickets: tickets.filter(t => t.status === 'pending').length,
      inProgressTickets: tickets.filter(t => t.status === 'in_progress').length,
      resolvedTickets: tickets.filter(t => t.status === 'completed').length,
      closedTickets: tickets.filter(t => t.status === 'declined').length,
      ticketResolutionRate: tickets.length > 0 ? ((tickets.filter(t => t.status === 'completed').length + tickets.filter(t => t.status === 'declined').length) / tickets.length) * 100 : 0
    };

    // Calculate performance metrics from tasks
    const performance = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      overdueTasks: tasks.filter(t => 
        t.status !== 'completed' && 
        new Date(t.dueDate) < new Date()
      ).length,
      completionRate: tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0,
      averageResponseTime: 0, // Would need to calculate from task comments
      productivityScore: 0
    };

    // Calculate productivity score
    if (tasks.length > 0) {
      const completionRate = performance.completionRate / 100;
      const overdueRate = performance.overdueTasks / tasks.length;
      performance.productivityScore = Math.max(0, (completionRate * 100) - (overdueRate * 50));
    }

    // Try to get activity logs (might be empty)
    let activityLog = [];
    try {
      activityLog = await UserActivityLog.findAll({
      where: {
        userId,
        timestamp: {
            [Op.between]: [queryStartDate, queryEndDate]
        }
      },
        order: [['timestamp', 'DESC']],
        limit: 50 // Limit to recent activity
    });
    } catch (error) {
    }

    // Fetch user info for role and department
    const user = await User.findByPk(userId, {
      attributes: ['role', 'departmentId', 'firstname', 'lastname'],
      include: [{ model: Department, as: 'Department', attributes: ['name'] }]
    });

    // Map/rename task fields for frontend compatibility
    const mappedTasks = tasks.map(task => ({
      title: task.title,
      status: task.status,
      priority: task.priority,
      createdAt: task.createdAt
    }));

    return {
      userId,
      userName: userName || (user ? `${user.firstname} ${user.lastname}` : 'Unknown User'),
      role: user ? user.role : undefined,
      departmentName: user && user.Department ? user.Department.name : undefined,
      tasks: mappedTasks,
      tickets,
      ticketSummary,
      performance,
      activityLog,
      parameters: {
        startDate: queryStartDate,
        endDate: queryEndDate
      }
    };
  }

  async generateDepartmentReport(parameters, role) {
    const { departmentId, startDate, endDate } = parameters;
    
    if (!departmentId) {
      throw new Error('departmentId is required for department reports');
    }

    // Set default date range if not provided
    const defaultStartDate = new Date();
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 1); // Last 30 days
    
    const queryStartDate = startDate || defaultStartDate.toISOString().split('T')[0];
    const queryEndDate = endDate || new Date().toISOString().split('T')[0];

    // Get department info
    const department = await Department.findByPk(departmentId, {
      include: [{
        model: User,
        as: 'Users',
        attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'isActive']
      }]
    });

    if (!department) {
      throw new Error('Department not found');
    }

    // Get department tasks
    const tasks = await Task.findAll({
      where: {
        departmentId,
        createdAt: {
          [Op.between]: [queryStartDate, queryEndDate]
        }
      },
      include: [{
        model: User,
        as: 'assignedUser',
        attributes: ['id', 'firstname', 'lastname']
      }],
      order: [['createdAt', 'DESC']]
    });

    // Get department tickets (only for admin and department_head roles)
    // Fetch tickets received by the department, not sent by the department
    let tickets = [];
    if (role === 'admin' || role === 'department_head') {
      // Get all users in the department
      const departmentUsers = await User.findAll({
        where: { departmentId: departmentId },
        attributes: ['id']
      });
      
      const userIds = departmentUsers.map(user => user.id);
      
      tickets = await Ticket.findAll({
        where: {
          [Op.or]: [
            { assigned_to: { [Op.in]: userIds } },
            { forwarded_to_id: { [Op.in]: userIds } },
            { current_handler_id: { [Op.in]: userIds } }
          ],
          createdAt: {
            [Op.between]: [queryStartDate, queryEndDate]
          }
        },
        include: [
          {
            model: User,
            as: 'ticketAssignee',
            attributes: ['id', 'firstname', 'lastname']
          },
          {
            model: User,
            as: 'ticketCreator',
            attributes: ['id', 'firstname', 'lastname']
          }
        ],
        order: [['createdAt', 'DESC']]
      });
    }

    // Calculate department analytics
    const analytics = {
      totalEmployees: department.Users.length,
      activeEmployees: department.Users.filter(u => u.isActive).length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      overdueTasks: tasks.filter(t => 
        t.status !== 'completed' && 
        new Date(t.dueDate) < new Date()
      ).length,
      completionRate: tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0,
      averageTaskCompletionTime: 0
    };

    // Add ticket analytics for admin and department_head
    if (role === 'admin' || role === 'department_head') {
      analytics.totalTickets = tickets.length;
      analytics.pendingTickets = tickets.filter(t => t.status === 'pending').length;
      analytics.inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
      analytics.resolvedTickets = tickets.filter(t => t.status === 'completed').length;
      analytics.closedTickets = tickets.filter(t => t.status === 'declined').length;
      analytics.ticketResolutionRate = tickets.length > 0 ? 
        ((tickets.filter(t => t.status === 'completed').length + tickets.filter(t => t.status === 'declined').length) / tickets.length) * 100 : 0;
    }

    // Calculate average completion time
    const completedTasks = tasks.filter(t => t.status === 'completed');
    if (completedTasks.length > 0) {
      const totalCompletionTime = completedTasks.reduce((sum, task) => {
        const completionTime = new Date(task.updatedAt) - new Date(task.createdAt);
        return sum + completionTime;
      }, 0);
      analytics.averageTaskCompletionTime = totalCompletionTime / completedTasks.length;
    }

    // Try to get metrics (might be empty)
    let metrics = [];
    try {
      metrics = await this.getDepartmentMetrics(departmentId, queryStartDate, queryEndDate);
    } catch (error) {
    }

    // Try to get trends (might be empty)
    let trends = [];
    try {
      trends = await this.calculateTaskTrends(departmentId, 'monthly', queryStartDate, queryEndDate);
    } catch (error) {
    }

    // Get activity logs for department users
    let activityLogs = [];
    try {
      const departmentUserIds = department.Users.map(user => user.id);
      if (departmentUserIds.length > 0) {
        activityLogs = await UserActivityLog.findAll({
          where: {
            userId: departmentUserIds,
            timestamp: {
              [Op.between]: [queryStartDate, queryEndDate]
            }
          },
          include: [{
            model: User,
            attributes: ['id', 'firstname', 'lastname']
          }],
          order: [['timestamp', 'DESC']],
          limit: 50 // Limit to recent 50 activities
        });
      }
    } catch (error) {
    }

    return {
      department,
      tasks,
      tickets: role === 'admin' || role === 'department_head' ? tickets : [],
      analytics,
      metrics,
      trends,
      activityLog: activityLogs,
      parameters: {
        startDate: queryStartDate,
        endDate: queryEndDate,
        role
      }
    };
  }

  async generateCustomReportData(parameters) {
    // Generate a basic custom report with available data
    const { startDate, endDate, customParameters } = parameters;
    
    // Set default date range if not provided
    const defaultStartDate = new Date();
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);
    
    const queryStartDate = startDate || defaultStartDate.toISOString().split('T')[0];
    const queryEndDate = endDate || new Date().toISOString().split('T')[0];

    // Get overall system statistics and tickets
    const [totalTasks, totalUsers, totalDepartments, users, tickets] = await Promise.all([
      Task.count({
        where: {
          createdAt: {
            [Op.between]: [queryStartDate, queryEndDate]
          }
        }
      }),
      User.count(),
      Department.count(),
      User.findAll({ attributes: ['id', 'firstname', 'lastname', 'role', 'email'] }),
      Ticket.findAll({
        where: {
          createdAt: {
            [Op.between]: [queryStartDate, queryEndDate]
          }
        },
        attributes: ['id', 'title', 'status', 'priority', 'category', 'assigned_to', 'created_by', 'createdAt']
      })
    ]);

    // Ticket summary for the period
    const ticketSummary = {
      totalTickets: tickets.length,
      pendingTickets: tickets.filter(t => t.status === 'pending').length,
      inProgressTickets: tickets.filter(t => t.status === 'in_progress').length,
      closedTickets: tickets.filter(t => t.status === 'declined').length,
      resolvedTickets: tickets.filter(t => t.status === 'completed').length
    };

    // Fetch all tasks for breakdown
    const allTasks = await Task.findAll({
      where: {
        createdAt: {
          [Op.between]: [queryStartDate, queryEndDate]
        }
      },
      attributes: ['status', 'dueDate']
    });

    // Task breakdown for the period
    const taskBreakdown = {
      totalTasks: allTasks.length,
      openTasks: allTasks.filter(t => t.status === 'open').length,
      closedTasks: allTasks.filter(t => t.status === 'closed').length,
      completedTasks: allTasks.filter(t => t.status === 'completed').length,
      pendingTasks: allTasks.filter(t => t.status === 'pending').length,
      inProgressTasks: allTasks.filter(t => t.status === 'in_progress').length,
      overdueTasks: allTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length
    };

    // User breakdown by role
    const userBreakdown = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    // Department breakdown by isActive
    const allDepartmentsList = await Department.findAll({ attributes: ['isActive'] });
    const departmentBreakdown = {
      active: allDepartmentsList.filter(d => d.isActive).length,
      inactive: allDepartmentsList.filter(d => !d.isActive).length
    };

    return {
      systemOverview: {
        totalTasks,
        totalUsers,
        totalDepartments,
        totalTickets: ticketSummary.totalTickets,
        openTickets: ticketSummary.openTickets,
        closedTickets: ticketSummary.closedTickets,
        resolvedTickets: ticketSummary.resolvedTickets,
        ...taskBreakdown,
        userBreakdown,
        departmentBreakdown,
        period: {
          startDate: queryStartDate,
          endDate: queryEndDate
        }
      },
      records: users.map(u => ({
        id: u.id,
        name: `${u.firstname} ${u.lastname}`,
        role: u.role,
        email: u.email
      })),
      tickets: tickets.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        category: t.category,
        assignedTo: t.assigned_to,
        createdBy: t.created_by,
        createdAt: t.createdAt
      })),
      customParameters: customParameters || {},
      message: 'Custom report generated with available system data'
    };
  }

  async getActivityLogs(userId, startDate, endDate, action = null) {
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

  async getPerformanceTrends(departmentId, startDate, endDate, period) {
    try {
      const whereClause = {
        date: {
          [Op.between]: [startDate, endDate]
        }
      };

      if (departmentId) {
        whereClause.departmentId = departmentId;
      }

      const metrics = await Task.findAll({
        where: whereClause,
        order: [['date', 'ASC']]
      });

      const formatDate = (date) => {
        const d = safeParseDate(date);
        if (!d) return 'Invalid Date';
        
        switch (period) {
          case 'daily':
            return d.toISOString().split('T')[0];
          case 'weekly':
            const week = getWeek(d);
            return `Week ${week}`;
          case 'monthly':
            return d.toISOString().slice(0, 7);
          default:
            return d.toISOString().split('T')[0];
        }
      };

      return metrics.map(metric => ({
        date: formatDate(metric.date),
        completionRate: metric.totalTasks > 0 ? (metric.completedTasks / metric.totalTasks) * 100 : 0,
        averageResolutionTime: metric.averageCompletionTime || 0,
        productivityScore: metric.productivityScore || 0
      }));
    } catch (error) {
      console.error('Error in getPerformanceTrends:', error);
      throw new Error('Failed to get performance trends');
    }
  }

  async getDepartmentComparison(startDate, endDate) {
    const departments = await Department.findAll({
      include: [{
        model: Task,
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        required: false
      }]
    });

    return departments.map(dept => ({
      departmentId: dept.id,
      departmentName: dept.name,
      totalTasks: dept.Tasks.length,
      completedTasks: dept.Tasks.filter(task => task.status === 'completed').length,
      averageCompletionTime: dept.Tasks.reduce((acc, task) => {
        if (task.completedAt) {
          const completedDate = safeParseDate(task.completedAt);
          const createdDate = safeParseDate(task.createdAt);
          if (completedDate && createdDate) {
            return acc + (completedDate.getTime() - createdDate.getTime());
          }
        }
        return acc;
      }, 0) / dept.Tasks.length || 0,
      productivityScore: dept.Tasks.reduce((acc, task) => acc + (task.productivityScore || 0), 0) / dept.Tasks.length || 0
    }));
  }

  async getUserActivityMetrics(departmentId, startDate, endDate) {
    const whereClause = {
      createdAt: {
        [Op.between]: [startDate, endDate]
      }
    };

    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    const activities = await UserActivityLog.findAll({
      where: whereClause,
      include: [{
        model: User,
        attributes: ['firstname', 'lastname', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });

    return activities.map(activity => ({
      userId: activity.userId,
      username: activity.User.firstname + ' ' + activity.User.lastname,
      action: activity.action,
      timestamp: activity.createdAt,
      details: activity.details
    }));
  }

  async getPriorityMetrics(departmentId, startDate, endDate, filters = {}) {
    try {
      const whereClause = {
        created_at: {
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
          'priority',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('AVG', sequelize.literal('TIMESTAMPDIFF(HOUR, created_at, updated_at)')), 'avgResolutionTime'],
          [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "completed" THEN 1 ELSE 0 END')), 'completed']
        ],
        group: ['priority']
      });

      return tasks.map(task => {
        const total = parseInt(task.getDataValue('total')) || 0;
        const completed = parseInt(task.getDataValue('completed')) || 0;
        return {
          priority: task.getDataValue('priority'),
          total,
          completed,
          avgResolutionTime: parseFloat(task.getDataValue('avgResolutionTime')) || 0,
          completionRate: total > 0 ? (completed / total) * 100 : 0
        };
      });
    } catch (error) {
      console.error('Error in getPriorityMetrics:', error);
      throw new Error('Failed to get priority metrics');
    }
  }

  // Anomaly & Trend Detection
  async detectTaskAnomalies(departmentId, startDate, endDate) {
    // Fetch metrics for the period
    const metrics = await this.getDepartmentMetrics(departmentId, startDate, endDate);
    if (!metrics || metrics.length < 2) return [];
    // Simple anomaly: sudden drop or spike in completedTasks or overdueTasks
    const anomalies = [];
    for (let i = 1; i < metrics.length; i++) {
      const prev = metrics[i - 1];
      const curr = metrics[i];
      // Detect >50% change in completedTasks or overdueTasks
      if (prev.completedTasks > 0 && Math.abs(curr.completedTasks - prev.completedTasks) / prev.completedTasks > 0.5) {
        anomalies.push({
          date: curr.date,
          type: 'completedTasks',
          message: `Significant change in completed tasks: ${prev.completedTasks} → ${curr.completedTasks}`
        });
      }
      if (prev.overdueTasks > 0 && Math.abs(curr.overdueTasks - prev.overdueTasks) / prev.overdueTasks > 0.5) {
        anomalies.push({
          date: curr.date,
          type: 'overdueTasks',
          message: `Significant change in overdue tasks: ${prev.overdueTasks} → ${curr.overdueTasks}`
        });
      }
    }
    return anomalies;
  }

  async detectUserActivityAnomalies(userId, startDate, endDate) {
    // Fetch user performance for the period
    const performance = await this.getUserPerformanceMetrics(userId, startDate, endDate);
    if (!performance || performance.length < 2) return [];
    const anomalies = [];
    for (let i = 1; i < performance.length; i++) {
      const prev = performance[i - 1];
      const curr = performance[i];
      // Detect >50% change in tasksCompleted or tasksOverdue
      if (prev.tasksCompleted > 0 && Math.abs(curr.tasksCompleted - prev.tasksCompleted) / prev.tasksCompleted > 0.5) {
        anomalies.push({
          date: curr.date,
          type: 'tasksCompleted',
          message: `Significant change in tasks completed: ${prev.tasksCompleted} → ${curr.tasksCompleted}`
        });
      }
      if (prev.tasksOverdue > 0 && Math.abs(curr.tasksOverdue - prev.tasksOverdue) / prev.tasksOverdue > 0.5) {
        anomalies.push({
          date: curr.date,
          type: 'tasksOverdue',
          message: `Significant change in overdue tasks: ${prev.tasksOverdue} → ${curr.tasksOverdue}`
        });
      }
    }
    return anomalies;
  }

  async detectDepartmentTrends(departmentId, startDate, endDate) {
    // Fetch metrics for the period
    const metrics = await this.getDepartmentMetrics(departmentId, startDate, endDate);
    if (!metrics || metrics.length < 2) return [];
    // Simple trend: check if completion rate is increasing or decreasing
    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    const trend = last.completedTasks - first.completedTasks;
    let trendType = 'stable';
    if (trend > 0) trendType = 'increasing';
    else if (trend < 0) trendType = 'decreasing';
    return [{
      metric: 'completedTasks',
      trend: trendType,
      from: first.completedTasks,
      to: last.completedTasks
    }];
  }

  // Predictive Analytics & Forecasting
  async forecastTaskCompletion(departmentId, startDate, endDate) {
    // Fetch historical metrics for the period
    const metrics = await this.getDepartmentMetrics(departmentId, startDate, endDate);
    if (!metrics || metrics.length < 2) return [];
    // Simple forecast: linear projection of completedTasks
    const forecast = [];
    const lastMetric = metrics[metrics.length - 1];
    const avgChange = (lastMetric.completedTasks - metrics[0].completedTasks) / (metrics.length - 1);
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(lastMetric.date);
      nextDate.setDate(nextDate.getDate() + i);
      forecast.push({
        date: getDateString(nextDate),
        predictedCompletedTasks: Math.round(lastMetric.completedTasks + avgChange * i)
      });
    }
    return forecast;
  }

  async forecastUserProductivity(userId, startDate, endDate) {
    // Fetch historical performance for the period
    const performance = await this.getUserPerformanceMetrics(userId, startDate, endDate);
    if (!performance || performance.length < 2) return [];
    // Simple forecast: linear projection of productivityScore
    const forecast = [];
    const lastPerf = performance[performance.length - 1];
    const avgChange = (lastPerf.productivityScore - performance[0].productivityScore) / (performance.length - 1);
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(lastPerf.date);
      nextDate.setDate(nextDate.getDate() + i);
      forecast.push({
        date: getDateString(nextDate),
        predictedProductivityScore: Math.round(lastPerf.productivityScore + avgChange * i)
      });
    }
    return forecast;
  }

  async forecastDepartmentWorkload(departmentId, startDate, endDate) {
    // Fetch historical metrics for the period
    const metrics = await this.getDepartmentMetrics(departmentId, startDate, endDate);
    if (!metrics || metrics.length < 2) return [];
    // Simple forecast: linear projection of totalTasks
    const forecast = [];
    const lastMetric = metrics[metrics.length - 1];
    const avgChange = (lastMetric.totalTasks - metrics[0].totalTasks) / (metrics.length - 1);
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(lastMetric.date);
      nextDate.setDate(nextDate.getDate() + i);
      forecast.push({
        date: getDateString(nextDate),
        predictedTotalTasks: Math.round(lastMetric.totalTasks + avgChange * i)
      });
    }
    return forecast;
  }

  async getUserPerformance(userId, startDate, endDate) {
    // Get user information including role
    const user = await User.findByPk(userId, {
      attributes: ['id', 'firstname', 'lastname', 'role']
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get user's tasks
    const tasks = await Task.findAll({
      where: {
        assignedToId: userId,
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      }
    });

    // Get user's tickets
    const tickets = await Ticket.findAll({
      where: {
        assigned_to: userId,
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      }
    });

    // Calculate performance metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const totalTickets = tickets.length;
    const efficiency = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Generate task performance over time (last 6 months)
    const taskPerformance = [];
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
      
      taskPerformance.push({
        month: monthName,
        completed: monthTasks.filter(t => t.status === 'completed').length,
        pending: monthTasks.filter(t => t.status === 'pending').length
      });
    }

    // Generate performance metrics for radar chart
    const metrics = [
      { metric: 'Task Completion', value: efficiency },
      { metric: 'Ticket Resolution', value: totalTickets > 0 ? Math.round((tickets.filter(t => t.status === 'completed').length / totalTickets) * 100) : 0 },
      { metric: 'Time Management', value: Math.max(0, 100 - (tasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()).length / totalTasks * 100)) },
      { metric: 'Communication', value: 85 }, // Placeholder - could be calculated from comments
      { metric: 'Problem Solving', value: Math.round(efficiency * 0.9) } // Placeholder - could be calculated from task complexity
    ];

    // Generate recent activity
    const recentActivity = [
      {
        type: 'Task Completed',
        description: `Completed ${completedTasks} out of ${totalTasks} tasks`,
        status: 'completed'
      },
      {
        type: 'Tickets Handled',
        description: `Handled ${totalTickets} tickets`,
        status: totalTickets > 0 ? 'completed' : 'pending'
      },
      {
        type: 'Performance Score',
        description: `Efficiency rate: ${efficiency}%`,
        status: efficiency >= 80 ? 'completed' : efficiency >= 60 ? 'pending' : 'pending'
      }
    ];

    return {
      totalTasks,
      completedTasks,
      totalTickets,
      efficiency,
      taskPerformance,
      metrics,
      recentActivity,
      user: {
        name: `${user.firstname} ${user.lastname}`,
        role: user.role
      }
    };
  }
}

module.exports = new AnalyticsService(); 