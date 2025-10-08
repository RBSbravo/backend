const analyticsService = require('../services/analyticsService');
const userAnalytics = require('../services/userAnalyticsService');
const reportGenerationService = require('../services/reportGenerationService');
const { validationResult } = require('express-validator');
const { CustomReport, User, Ticket, Task, Department } = require('../models');
const { Op } = require('sequelize');

class AnalyticsController {
  async getDepartmentMetrics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { departmentId } = req.params;
      const { startDate, endDate } = req.query;

      const metrics = await analyticsService.getDepartmentMetrics(
        departmentId,
        startDate,
        endDate
      );

      res.json(metrics);
    } catch (error) {
      console.error('Error getting department metrics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getUserPerformance(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      const performance = await userAnalytics.getUserPerformanceMetrics(
        userId,
        startDate,
        endDate
      );

      res.json(performance);
    } catch (error) {
      console.error('Error getting user performance:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getDepartmentAnalytics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { departmentId } = req.params;
      const { startDate, endDate } = req.query;

      // Enforce department head can only access their own department
      if (req.user.role === 'department_head' && req.user.departmentId !== departmentId) {
        return res.status(403).json({ error: 'Forbidden: You can only access analytics for your own department.' });
      }

      const analytics = await analyticsService.getDepartmentAnalytics(
        departmentId,
        startDate,
        endDate
      );

      res.json(analytics || {});
    } catch (error) {
      console.error('Error getting department analytics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateMetrics(req, res) {
    try {
      await analyticsService.updateDailyMetrics();
      res.json({ message: 'Metrics updated successfully' });
    } catch (error) {
      console.error('Error updating metrics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getTaskTrends(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { departmentId } = req.params;
      const { period, startDate, endDate } = req.query;

      const trends = await analyticsService.calculateTaskTrends(
        departmentId,
        period,
        startDate,
        endDate
      );

      res.json(trends);
    } catch (error) {
      console.error('Error getting task trends:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getActivityLogs(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { startDate, endDate, action } = req.query;

      const logs = await analyticsService.getActivityLogs(
        userId,
        startDate,
        endDate,
        action
      );

      res.json(logs);
    } catch (error) {
      console.error('Error getting activity logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createCustomReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Allow admin or department_head
      if (req.user.role !== 'admin' && req.user.role !== 'department_head') {
        return res.status(403).json({ error: 'Only administrators or department heads can create custom reports' });
      }

      const { name, description, type, parameters, schedule } = req.body;
      const createdBy = req.user.id;

      // If department_head, force departmentId in parameters
      let reportParameters = parameters;
      if (req.user.role === 'department_head') {
        reportParameters = { ...parameters, departmentId: req.user.departmentId };
      }

      const report = await CustomReport.create({
        name,
        description,
        type,
        parameters: reportParameters,
        schedule,
        createdBy
      });

      res.status(201).json(report);
    } catch (error) {
      console.error('Error creating custom report:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getCustomReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Allow admin or department_head
      if (req.user.role !== 'admin' && req.user.role !== 'department_head') {
        return res.status(403).json({ error: 'Only administrators or department heads can view custom reports' });
      }

      const { reportId } = req.params;
      const report = await CustomReport.findByPk(reportId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      // If admin, only allow access to their own reports
      if (req.user.role === 'admin' && report.createdBy !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: You can only access reports you created.' });
      }
      
      // If department_head, only allow access to their own department's reports
      if (req.user.role === 'department_head') {
        if (!report.parameters || report.parameters.departmentId !== req.user.departmentId) {
          return res.status(403).json({ error: 'Forbidden: You can only access reports for your own department.' });
        }
      }
      // Generate and return the report data
      const reportData = await analyticsService.generateCustomReport(reportId, req.user.role);
      res.json(reportData);
    } catch (error) {
      console.error('Error getting custom report:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async listCustomReports(req, res) {
    try {
      // Allow admin or department_head
      if (req.user.role !== 'admin' && req.user.role !== 'department_head') {
        return res.status(403).json({ error: 'Only administrators or department heads can list custom reports' });
      }

      const { type, isActive } = req.query;
      const where = {};

      if (type) where.type = type;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      // Filter by creator and department based on user role
      if (req.user.role === 'admin') {
        where.createdBy = req.user.id;
      } else if (req.user.role === 'department_head') {
        // Department heads can see reports they created OR reports for their department
        where[Op.or] = [
          { createdBy: req.user.id },
          { 
            parameters: {
              [Op.like]: `%"departmentId":"${req.user.departmentId}"%`
            }
          }
        ];
      }

      const reports = await CustomReport.findAll({
        where,
        include: [{
          model: User,
          as: 'reportCreator',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }],
        order: [['createdAt', 'DESC']]
      });

      // No additional filtering needed - backend query handles it
      let filteredReports = reports;

      // Format reports for frontend consumption
      const formattedReports = filteredReports.map(report => ({
        id: report.id,
        title: report.name,
        name: report.name,
        description: report.description,
        type: report.type,
        parameters: report.parameters,
        createdAt: report.createdAt,
        createdBy: report.createdBy,
        generatedBy: report.reportCreator ? `${report.reportCreator.firstname} ${report.reportCreator.lastname}` : 'Unknown'
      }));

      // Server-side de-duplication: collapse items with same title+type+creator+parameters
      // Keep the most recent by createdAt
      const seen = new Map();
      for (const r of formattedReports) {
        const paramsKey = JSON.stringify(r.parameters || {});
        const key = `${r.title}::${r.type}::${r.createdBy}::${paramsKey}`;
        const prev = seen.get(key);
        if (!prev || new Date(r.createdAt) > new Date(prev.createdAt)) {
          seen.set(key, r);
        }
      }
      const deduped = Array.from(seen.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.json(deduped);
    } catch (error) {
      console.error('Error listing custom reports:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateCustomReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if user has admin role
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only administrators can update custom reports' });
      }

      const { reportId } = req.params;
      const { name, description, parameters, schedule, isActive } = req.body;

      const report = await CustomReport.findByPk(reportId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Admin can only update their own reports
      if (report.createdBy !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: You can only update reports you created.' });
      }

      await report.update({
        name,
        description,
        parameters,
        schedule,
        isActive
      });

      res.json(report);
    } catch (error) {
      console.error('Error updating custom report:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteCustomReport(req, res) {
    try {
      const { reportId } = req.params;
      
      // Find the report
      const report = await CustomReport.findByPk(reportId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Check permissions and delete
      if (req.user.role === 'admin') {
        // Admin can only delete their own reports
        if (report.createdBy !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden: You can only delete reports you created.' });
        }
        
        await report.destroy();
        
        // Verify deletion
        const deletedReport = await CustomReport.findByPk(reportId);
        if (deletedReport) {
          return res.status(500).json({ error: 'Failed to delete report from database' });
        }
        
        return res.json({ message: 'Report deleted successfully' });
      }
      
      if (req.user.role === 'department_head') {
        if (report.parameters && report.parameters.departmentId === req.user.departmentId) {
          await report.destroy();
          
          // Verify deletion
          const deletedReport = await CustomReport.findByPk(reportId);
          if (deletedReport) {
            return res.status(500).json({ error: 'Failed to delete report from database' });
          }
          
          return res.json({ message: 'Report deleted successfully' });
        } else {
          return res.status(403).json({ error: 'Forbidden: You can only delete reports for your own department.' });
        }
      }
      
      return res.status(403).json({ error: 'Only administrators or department heads can delete custom reports' });
      
    } catch (error) {
      console.error('Error deleting custom report:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateCustomReportSchedule(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if user has admin role
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only administrators can update report schedules' });
      }

      const { reportId } = req.params;
      const { cron, recipientEmail } = req.body;

      const report = await CustomReport.findByPk(reportId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Update the schedule field
      report.schedule = { cron, recipientEmail };
      await report.update({ schedule: report.schedule });

      res.json({ message: 'Report schedule updated successfully', report });
    } catch (error) {
      console.error('Error updating report schedule:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getDashboardStats(req, res) {
    try {
      // If department head, filter by their department
      if (req.user.role === 'department_head' && req.user.departmentId) {
        const departmentId = req.user.departmentId;
        // Department-specific stats (received tickets for current user)
        const totalTickets = await Ticket.count({
          where: {
            [Op.or]: [
              { assigned_to: req.user.id, is_active: true },
              { forwarded_to_id: req.user.id, is_forwarded: true }
            ]
          }
        });
        const openTickets = await Ticket.count({
          where: {
            status: { [Op.in]: ['open', 'pending'] },
            [Op.or]: [
              { assigned_to: req.user.id, is_active: true },
              { forwarded_to_id: req.user.id, is_forwarded: true }
            ]
          }
        });
        const closedTickets = await Ticket.count({
          where: {
            status: { [Op.in]: ['closed', 'completed', 'resolved'] },
            [Op.or]: [
              { assigned_to: req.user.id, is_active: true },
              { forwarded_to_id: req.user.id, is_forwarded: true }
            ]
          }
        });

        const overdueTickets = await Ticket.count({
          where: {
            due_date: { [Op.lt]: new Date() },
            status: { [Op.notIn]: ['closed', 'completed', 'resolved'] },
            [Op.or]: [
              { assigned_to: req.user.id, is_active: true },
              { forwarded_to_id: req.user.id, is_forwarded: true }
            ]
          }
        });

        const totalTasks = await Task.count({ where: { department_id: departmentId } });
        const completedTasks = await Task.count({ where: { department_id: departmentId, status: 'completed' } });
        const overdueTasks = await Task.count({
          where: {
            department_id: departmentId,
            due_date: { [Op.lt]: new Date() },
            status: { [Op.not]: 'completed' }
          }
        });

        const activeUsers = await User.count({ where: { departmentId: departmentId, isActive: true } });
        const departments = 1; // Only their department

        // Recent tickets/tasks (last 5) - show received tickets, not sent tickets
        const recentTickets = await Ticket.findAll({
          where: { 
            [Op.or]: [
              { assigned_to: req.user.id, is_active: true },
              { forwarded_to_id: req.user.id, is_forwarded: true }
            ]
          },
          order: [['created_at', 'DESC']],
          limit: 5,
          include: [
            { model: User, as: 'ticketCreator', attributes: ['id', 'firstname', 'lastname', 'email'] },
            { model: User, as: 'ticketAssignee', attributes: ['id', 'firstname', 'lastname', 'email'] },
            { model: Department, attributes: ['id', 'name'] }
          ]
        });
        const recentTasks = await Task.findAll({
          where: { department_id: departmentId },
          order: [['created_at', 'DESC']],
          limit: 5
        });

        // Team performance: role-based metrics for accurate display
        const users = await User.findAll({ where: { departmentId: departmentId, isActive: true }, include: [{ model: Department, attributes: ['name'] }] });
        const teamPerformance = await Promise.all(users.map(async (user) => {
          let tasksAssigned = 0;
          let tasksCompleted = 0;
          let ticketsAssigned = 0;
          let ticketsClosed = 0;
          
          // Role-based data collection
          if (user.role === 'employee') {
            // Employees: focus on tasks
            tasksAssigned = await Task.count({ where: { department_id: departmentId, assignedToId: user.id } });
            tasksCompleted = await Task.count({ where: { department_id: departmentId, assignedToId: user.id, status: 'completed' } });
            // Also count tickets they're assigned to
            ticketsAssigned = await Ticket.count({ where: { assigned_to: user.id } });
            ticketsClosed = await Ticket.count({ where: { assigned_to: user.id, status: 'completed' } });
          } else if (user.role === 'department_head') {
            // Department heads: focus on tickets managed by their department
            const departmentUsers = await User.findAll({ 
              where: { departmentId: user.departmentId },
              attributes: ['id']
            });
            const departmentUserIds = departmentUsers.map(u => u.id);
            
            // Count tickets received by department (assigned to or forwarded to department users)
            ticketsAssigned = await Ticket.count({
              where: {
                [Op.or]: [
                  { assigned_to: { [Op.in]: departmentUserIds } },
                  { forwarded_to_id: { [Op.in]: departmentUserIds } }
                ]
              }
            });
            ticketsClosed = await Ticket.count({
              where: {
                status: 'completed',
                [Op.or]: [
                  { assigned_to: { [Op.in]: departmentUserIds } },
                  { forwarded_to_id: { [Op.in]: departmentUserIds } }
                ]
              }
            });
            
            // Also count their own tasks
            tasksAssigned = await Task.count({ where: { department_id: departmentId, assignedToId: user.id } });
            tasksCompleted = await Task.count({ where: { department_id: departmentId, assignedToId: user.id, status: 'completed' } });
          }
          
          return {
            userId: user.id,
            name: `${user.firstname} ${user.lastname}`,
            departmentName: user.Department ? user.Department.name : 'Other',
            role: user.role,
            tasksAssigned,
            tasksCompleted,
            ticketsAssigned,
            ticketsClosed
          };
        }));

        return res.json({
          totalTickets,
          openTickets,
          closedTickets,
          overdueTickets,
          totalTasks,
          completedTasks,
          overdueTasks,
          activeUsers,
          departments,
          recentTickets,
          recentTasks,
          teamPerformance
        });
      }

      // For admin: global stats with team performance across all departments
      if (req.user.role === 'admin') {
        // Overall ticket statistics (all tickets in the system)
        const totalTickets = await Ticket.count();
        const pendingTickets = await Ticket.count({ where: { status: 'pending' } });
        const inProgressTickets = await Ticket.count({ where: { status: 'in_progress' } });
        const completedTickets = await Ticket.count({ where: { status: 'completed' } });
        const declinedTickets = await Ticket.count({ where: { status: 'declined' } });
        
        // Combined open tickets (pending + in_progress)
        const openTickets = pendingTickets + inProgressTickets;
        // Closed tickets (completed + declined)
        const closedTickets = completedTickets + declinedTickets;

        const overdueTickets = await Ticket.count({
          where: {
            due_date: { [Op.lt]: new Date() },
            status: { [Op.notIn]: ['completed', 'declined'] }
          }
        });

        const totalTasks = await Task.count();
        const completedTasks = await Task.count({ where: { status: 'completed' } });
        const overdueTasks = await Task.count({
          where: {
            due_date: { [Op.lt]: new Date() },
            status: { [Op.not]: 'completed' }
          }
        });

        const activeUsers = await User.count({ where: { isActive: true }, include: [{ model: Department, attributes: ['name'] }] });
        const departments = await Department.count();

        // Recent tickets/tasks (last 5)
        const recentTickets = await Ticket.findAll({
          order: [['created_at', 'DESC']],
          limit: 5
        });
        const recentTasks = await Task.findAll({
          order: [['created_at', 'DESC']],
          limit: 5
        });

        // Team performance: role-based metrics for accurate display
        const users = await User.findAll({ where: { isActive: true }, include: [{ model: Department, attributes: ['name'] }] });
        const teamPerformance = await Promise.all(users.map(async (user) => {
          let tasksAssigned = 0;
          let tasksCompleted = 0;
          let ticketsAssigned = 0;
          let ticketsClosed = 0;
          
          // Role-based data collection
          if (user.role === 'employee') {
            // Employees: focus on tasks
            tasksAssigned = await Task.count({ where: { assignedToId: user.id } });
            tasksCompleted = await Task.count({ where: { assignedToId: user.id, status: 'completed' } });
            // Also count tickets they're assigned to
            ticketsAssigned = await Ticket.count({ where: { assigned_to: user.id } });
            ticketsClosed = await Ticket.count({ where: { assigned_to: user.id, status: 'completed' } });
          } else if (user.role === 'department_head') {
            // Department heads: focus on tickets managed by their department
            const departmentUsers = await User.findAll({ 
              where: { departmentId: user.departmentId },
              attributes: ['id']
            });
            const departmentUserIds = departmentUsers.map(u => u.id);
            
            // Count tickets received by department (assigned to or forwarded to department users)
            ticketsAssigned = await Ticket.count({
              where: {
                [Op.or]: [
                  { assigned_to: { [Op.in]: departmentUserIds } },
                  { forwarded_to_id: { [Op.in]: departmentUserIds } }
                ]
              }
            });
            ticketsClosed = await Ticket.count({
              where: {
                status: 'completed',
                [Op.or]: [
                  { assigned_to: { [Op.in]: departmentUserIds } },
                  { forwarded_to_id: { [Op.in]: departmentUserIds } }
                ]
              }
            });
            
            // Also count their own tasks
            tasksAssigned = await Task.count({ where: { assignedToId: user.id } });
            tasksCompleted = await Task.count({ where: { assignedToId: user.id, status: 'completed' } });
          }
          
          return {
            userId: user.id,
            name: `${user.firstname} ${user.lastname}`,
            departmentName: user.Department ? user.Department.name : 'Other',
            role: user.role,
            tasksAssigned,
            tasksCompleted,
            ticketsAssigned,
            ticketsClosed
          };
        }));

        return res.json({
          totalTickets,
          openTickets,
          closedTickets,
          overdueTickets,
          // Detailed ticket breakdown for admin
          pendingTickets,
          inProgressTickets,
          completedTickets,
          declinedTickets,
          totalTasks,
          completedTasks,
          overdueTasks,
          activeUsers,
          departments,
          recentTickets,
          recentTasks,
          teamPerformance
        });
      }

      // For regular users: show their department's team performance if they have a department
      if (req.user.role === 'employee' && req.user.departmentId) {
        const departmentId = req.user.departmentId;
        
        // Employee stats (received tickets for current user)
        const totalTickets = await Ticket.count({
          where: {
            [Op.or]: [
              { assigned_to: req.user.id, is_active: true },
              { forwarded_to_id: req.user.id, is_forwarded: true }
            ]
          }
        });
        const openTickets = await Ticket.count({
          where: {
            status: { [Op.in]: ['open', 'pending'] },
            [Op.or]: [
              { assigned_to: req.user.id, is_active: true },
              { forwarded_to_id: req.user.id, is_forwarded: true }
            ]
          }
        });
        const closedTickets = await Ticket.count({
          where: {
            status: { [Op.in]: ['closed', 'completed', 'resolved'] },
            [Op.or]: [
              { assigned_to: req.user.id, is_active: true },
              { forwarded_to_id: req.user.id, is_forwarded: true }
            ]
          }
        });

        const totalTasks = await Task.count({ where: { department_id: departmentId } });
        const completedTasks = await Task.count({ where: { department_id: departmentId, status: 'completed' } });
        const overdueTasks = await Task.count({
          where: {
            department_id: departmentId,
            due_date: { [Op.lt]: new Date() },
            status: { [Op.not]: 'completed' }
          }
        });

        const activeUsers = await User.count({ where: { departmentId: departmentId, isActive: true }, include: [{ model: Department, attributes: ['name'] }] });
        const departments = 1;

        // Recent tickets/tasks (last 5)
        const recentTickets = await Ticket.findAll({
          where: { department_id: departmentId },
          order: [['created_at', 'DESC']],
          limit: 5
        });
        const recentTasks = await Task.findAll({
          where: { department_id: departmentId },
          order: [['created_at', 'DESC']],
          limit: 5
        });

        // Team performance: tasks/tickets assigned/completed per user in their department
        const users = await User.findAll({ where: { departmentId: departmentId, isActive: true }, include: [{ model: Department, attributes: ['name'] }] });
        const teamPerformance = await Promise.all(users.map(async (user) => {
          const tasksAssigned = await Task.count({ where: { department_id: departmentId, assignedToId: user.id } });
          const tasksCompleted = await Task.count({ where: { department_id: departmentId, assignedToId: user.id, status: 'completed' } });
          const ticketsAssigned = await Ticket.count({ where: { department_id: departmentId, assigned_to: user.id } });
          const ticketsClosed = await Ticket.count({ where: { department_id: departmentId, assigned_to: user.id, status: 'closed' } });
          return {
            userId: user.id,
            name: `${user.firstname} ${user.lastname}`,
            departmentName: user.Department ? user.Department.name : 'Other',
            role: user.role,
            tasksAssigned,
            tasksCompleted,
            ticketsAssigned,
            ticketsClosed
          };
        }));

        return res.json({
          totalTickets,
          openTickets,
          closedTickets,
          totalTasks,
          completedTasks,
          overdueTasks,
          activeUsers,
          departments,
          recentTickets,
          recentTasks,
          teamPerformance
        });
      }

      // Default: global stats without team performance (for users without department)
      const totalTickets = await Ticket.count();
      const openTickets = await Ticket.count({ where: { status: 'open' } });
      const closedTickets = await Ticket.count({ where: { status: 'closed' } });

      const totalTasks = await Task.count();
      const completedTasks = await Task.count({ where: { status: 'completed' } });
      const overdueTasks = await Task.count({
        where: {
          due_date: { [Op.lt]: new Date() },
          status: { [Op.not]: 'completed' }
        }
      });

      const activeUsers = await User.count({ where: { isActive: true }, include: [{ model: Department, attributes: ['name'] }] });
      const departments = await Department.count();

      // Recent tickets for admin (all tickets)
      const recentTickets = await Ticket.findAll({
        order: [['created_at', 'DESC']],
        limit: 5,
        include: [
          { model: User, as: 'ticketCreator', attributes: ['id', 'firstname', 'lastname', 'email'] },
          { model: User, as: 'ticketAssignee', attributes: ['id', 'firstname', 'lastname', 'email'] },
          { model: Department, attributes: ['id', 'name'] }
        ]
      });

      res.json({
        totalTickets,
        openTickets,
        closedTickets,
        totalTasks,
        completedTasks,
        overdueTasks,
        activeUsers,
        departments,
        recentTickets
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Generate Ticket Report
  async generateTicketReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const parameters = {
        ...req.body,
        userId: req.user.id
      };

      const reportData = await reportGenerationService.generateTicketReport(parameters, req.user.role);
      
      // Check if a similar report already exists to prevent duplicates
      const existingReport = await CustomReport.findOne({
        where: {
          name: parameters.title || `Ticket Report - ${new Date().toLocaleDateString()}`,
          type: 'ticket',
          createdBy: req.user.id,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
          }
        }
      });
      
      let savedReport;
      if (existingReport) {
        // Use existing report if found
        savedReport = existingReport;
        console.log('Using existing report to prevent duplicate:', existingReport.id);
      } else {
        // Save new report to database
        savedReport = await CustomReport.create({
          name: parameters.title || `Ticket Report - ${new Date().toLocaleDateString()}`,
          description: parameters.description || 'Generated ticket report',
          type: 'ticket',
          parameters: parameters,
          createdBy: req.user.id
        });
      }
      
      res.json({
        success: true,
        report: {
          id: savedReport.id,
          title: savedReport.name,
          description: savedReport.description,
          type: savedReport.type,
          generatedBy: `${req.user.firstname} ${req.user.lastname}`,
          generatedOn: new Date().toISOString(),
          filtersApplied: {
            dateRange: parameters.startDate && parameters.endDate ? 
              `${parameters.startDate} to ${parameters.endDate}` : 'All time',
            status: parameters.status || 'All statuses',
            priority: parameters.priority || 'All priorities',
            department: parameters.departmentId ? 'Specific department' : 'All departments',
            assignee: parameters.assignedTo ? 'Specific assignee' : 'All assignees'
          }
        },
        data: reportData
      });
    } catch (error) {
      console.error('Error generating ticket report:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Generate Task Report
  async generateTaskReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const parameters = {
        ...req.body,
        userId: req.user.id
      };

      const reportData = await reportGenerationService.generateTaskReport(parameters, req.user.role);
      
      // Check if a similar report already exists to prevent duplicates
      const existingReport = await CustomReport.findOne({
        where: {
          name: parameters.title || `Task Report - ${new Date().toLocaleDateString()}`,
          type: 'task',
          createdBy: req.user.id,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
          }
        }
      });
      
      let savedReport;
      if (existingReport) {
        // Use existing report if found
        savedReport = existingReport;
        console.log('Using existing task report to prevent duplicate:', existingReport.id);
      } else {
        // Save new report to database
        savedReport = await CustomReport.create({
          name: parameters.title || `Task Report - ${new Date().toLocaleDateString()}`,
          description: parameters.description || 'Generated task report',
          type: 'task',
          parameters: parameters,
          createdBy: req.user.id
        });
      }
      
      res.json({
        success: true,
        report: {
          id: savedReport.id,
          title: savedReport.name,
          description: savedReport.description,
          type: savedReport.type,
          generatedBy: `${req.user.firstname} ${req.user.lastname}`,
          generatedOn: new Date().toISOString(),
          filtersApplied: {
            dateRange: parameters.startDate && parameters.endDate ? 
              `${parameters.startDate} to ${parameters.endDate}` : 'All time',
            status: parameters.status || 'All statuses',
            dueDate: parameters.dueDate || 'All due dates',
            department: parameters.departmentId ? 'Specific department' : 'All departments',
            assignee: parameters.assignedTo ? 'Specific assignee' : 'All assignees',
            relatedTicket: parameters.relatedTicket || 'All tickets'
          }
        },
        data: reportData
      });
    } catch (error) {
      console.error('Error generating task report:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Generate User Report
  async generateUserReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const parameters = {
        ...req.body
        // Don't override userId - use the one from request body (selected user)
      };

      const reportData = await reportGenerationService.generateUserReport(parameters);
      
      // Check if a similar report already exists to prevent duplicates
      const reportName = parameters.title || `User Report - ${reportData.userProfile.fullName} - ${new Date().toLocaleDateString()}`;
      const existingReport = await CustomReport.findOne({
        where: {
          name: reportName,
          type: 'user',
          createdBy: req.user.id,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
          }
        }
      });
      
      let savedReport;
      if (existingReport) {
        // Use existing report if found
        savedReport = existingReport;
        console.log('Using existing user report to prevent duplicate:', existingReport.id);
      } else {
        // Save new report to database
        savedReport = await CustomReport.create({
          name: reportName,
          description: parameters.description || `Generated user report for ${reportData.userProfile.fullName}`,
          type: 'user',
          parameters: parameters,
          createdBy: req.user.id
        });
      }
      
      res.json({
        success: true,
        report: {
          id: savedReport.id,
          title: savedReport.name,
          description: savedReport.description,
          type: savedReport.type,
          generatedBy: `${req.user.firstname} ${req.user.lastname}`,
          generatedOn: new Date().toISOString(),
          filtersApplied: {
            dateRange: parameters.startDate && parameters.endDate ? 
              `${parameters.startDate} to ${parameters.endDate}` : 'All time',
            role: parameters.role || 'All roles',
            department: parameters.department || 'All departments'
          }
        },
        data: reportData
      });
    } catch (error) {
      console.error('Error generating user report:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Generate Department Report
  async generateDepartmentReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const parameters = {
        ...req.body,
        userId: req.user.id
      };

      const reportData = await reportGenerationService.generateDepartmentReport(parameters, req.user.role);
      
      // Check if a similar report already exists to prevent duplicates
      const reportName = parameters.title || `Department Report - ${reportData.departmentProfile.departmentName} - ${new Date().toLocaleDateString()}`;
      const existingReport = await CustomReport.findOne({
        where: {
          name: reportName,
          type: 'department',
          createdBy: req.user.id,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
          }
        }
      });
      
      let savedReport;
      if (existingReport) {
        // Use existing report if found
        savedReport = existingReport;
        console.log('Using existing department report to prevent duplicate:', existingReport.id);
      } else {
        // Save new report to database
        savedReport = await CustomReport.create({
          name: reportName,
          description: parameters.description || `Generated department report for ${reportData.departmentProfile.departmentName}`,
          type: 'department',
          parameters: parameters,
          createdBy: req.user.id
        });
      }
      
      res.json({
        success: true,
        report: {
          id: savedReport.id,
          title: savedReport.name,
          description: savedReport.description,
          type: savedReport.type,
          generatedBy: `${req.user.firstname} ${req.user.lastname}`,
          generatedOn: new Date().toISOString(),
          filtersApplied: {
            dateRange: parameters.startDate && parameters.endDate ? 
              `${parameters.startDate} to ${parameters.endDate}` : 'All time',
            ticketTaskStatus: parameters.status || 'All statuses'
          }
        },
        data: reportData
      });
    } catch (error) {
      console.error('Error generating department report:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Generate Custom Report
  async generateCustomReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const parameters = {
        ...req.body,
        userId: req.user.id
      };

      const reportData = await reportGenerationService.generateCustomReportData(parameters);
      
      // Check if a similar report already exists to prevent duplicates
      const reportName = parameters.title || `Custom Report - ${new Date().toLocaleDateString()}`;
      const existingReport = await CustomReport.findOne({
        where: {
          name: reportName,
          type: 'custom',
          createdBy: req.user.id,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
          }
        }
      });
      
      let savedReport;
      if (existingReport) {
        // Use existing report if found
        savedReport = existingReport;
        console.log('Using existing custom report to prevent duplicate:', existingReport.id);
      } else {
        // Save new report to database
        savedReport = await CustomReport.create({
          name: reportName,
          description: parameters.description || 'Generated custom report with selected fields',
          type: 'custom',
          parameters: parameters,
          createdBy: req.user.id
        });
      }
      
      res.json({
        success: true,
        report: {
          id: savedReport.id,
          title: savedReport.name,
          description: savedReport.description,
          type: savedReport.type,
          generatedBy: `${req.user.firstname} ${req.user.lastname}`,
          generatedOn: new Date().toISOString(),
          filtersApplied: {
            dateRange: parameters.startDate && parameters.endDate ? 
              `${parameters.startDate} to ${parameters.endDate}` : 'All time',
            customFilters: parameters.filters || 'No custom filters'
          }
        },
        data: reportData
      });
    } catch (error) {
      console.error('Error generating custom report:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AnalyticsController(); 