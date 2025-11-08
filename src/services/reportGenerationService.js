const { User, Task, Ticket, Department, UserActivityLog } = require('../models');
const { Op } = require('sequelize');

class ReportGenerationService {
  // Generate Ticket Report
  async generateTicketReport(parameters, userRole = null) {
    const { 
      startDate, 
      endDate, 
      departmentId, 
      assignedTo, 
      status, 
      priority,
      includeInsights = true 
    } = parameters;

    try {
      // Build where clause
      const whereClause = {};
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }
      
      if (status) {
        whereClause.status = status;
      }
      
      if (priority) {
        whereClause.priority = priority;
      }

      // Handle department filtering - get tickets assigned to users in the department
      let departmentUserIds = [];
      if (departmentId) {
        // Get all users in the specified department
        const departmentUsers = await User.findAll({
          where: { departmentId: departmentId },
          attributes: ['id']
        });
        departmentUserIds = departmentUsers.map(user => user.id);
      } else if (userRole === 'department_head') {
        // For department heads, get users in their department
        const user = await User.findByPk(parameters.userId);
        if (user && user.departmentId) {
          const departmentUsers = await User.findAll({
            where: { departmentId: user.departmentId },
            attributes: ['id']
          });
          departmentUserIds = departmentUsers.map(user => user.id);
        }
      }
      
      // Filter tickets assigned to users in the department
      if (departmentUserIds.length > 0) {
        whereClause.assigned_to = {
          [Op.in]: departmentUserIds
        };
      }

      // Handle assignee filtering
      if (assignedTo) {
        whereClause.assigned_to = assignedTo;
      }

      // Fetch tickets with related data
      console.log('Ticket Report - whereClause:', whereClause);
      const tickets = await Ticket.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'ticketAssignee',
            attributes: ['id', 'firstname', 'lastname', 'email', 'role']
          },
          {
            model: User,
            as: 'ticketCreator',
            attributes: ['id', 'firstname', 'lastname', 'email', 'role']
          },
          {
            model: Department,
            attributes: ['id', 'name']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Calculate summary statistics
      const totalTickets = tickets.length;
      const resolvedTickets = tickets.filter(t => t.status === 'completed').length;
      const pendingTickets = tickets.filter(t => t.status === 'pending').length;
      const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
      const declinedTickets = tickets.filter(t => t.status === 'declined').length;

      // Status breakdown
      const statusBreakdown = [
        { status: 'Pending', count: pendingTickets, percentage: totalTickets > 0 ? (pendingTickets / totalTickets * 100).toFixed(1) : 0 },
        { status: 'In Progress', count: inProgressTickets, percentage: totalTickets > 0 ? (inProgressTickets / totalTickets * 100).toFixed(1) : 0 },
        { status: 'Resolved', count: resolvedTickets, percentage: totalTickets > 0 ? (resolvedTickets / totalTickets * 100).toFixed(1) : 0 },
        { status: 'Declined', count: declinedTickets, percentage: totalTickets > 0 ? (declinedTickets / totalTickets * 100).toFixed(1) : 0 }
      ];

      // Priority breakdown
      const priorityBreakdown = [
        { priority: 'Low', count: tickets.filter(t => t.priority === 'low').length },
        { priority: 'Medium', count: tickets.filter(t => t.priority === 'medium').length },
        { priority: 'High', count: tickets.filter(t => t.priority === 'high').length },
        { priority: 'Critical', count: tickets.filter(t => t.priority === 'critical').length }
      ];

      // Calculate insights
      let insights = {};
      if (includeInsights) {
        // Include both completed and declined tickets as resolved (same as analytics dashboard)
        const resolvedTicketsWithTimes = tickets.filter(t => 
          (t.status === 'completed' || t.status === 'declined') && t.updatedAt
        );
        const averageResolutionTime = resolvedTicketsWithTimes.length > 0 
          ? resolvedTicketsWithTimes.reduce((sum, ticket) => {
              const resolutionTime = new Date(ticket.updatedAt) - new Date(ticket.createdAt);
              // Ensure resolution time is not negative (updatedAt should be >= createdAt)
              return sum + Math.max(0, resolutionTime);
            }, 0) / resolvedTicketsWithTimes.length
          : 0;

        // Resolution rate includes both completed and declined tickets
        const totalResolvedTickets = tickets.filter(t => t.status === 'completed' || t.status === 'declined').length;
        const resolutionRate = totalTickets > 0 ? (totalResolvedTickets / totalTickets * 100).toFixed(1) : 0;


        // Most active departments
        const departmentStats = {};
        tickets.forEach(ticket => {
          const deptName = ticket.Department?.name || 'Unknown';
          departmentStats[deptName] = (departmentStats[deptName] || 0) + 1;
        });

        const mostActiveDepartments = Object.entries(departmentStats)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([name, count]) => ({ department: name, ticketCount: count }));

        insights = {
          averageResolutionTime: Math.round(averageResolutionTime / (1000 * 60 * 60 * 24) * 10) / 10, // in days
          resolutionRate: parseFloat(resolutionRate),
          mostActiveDepartments
        };
      }

      // Format details table
      const details = tickets.map(ticket => ({
        ticketId: ticket.id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        assignee: ticket.ticketAssignee ? `${ticket.ticketAssignee.firstname} ${ticket.ticketAssignee.lastname}` : 'Unassigned',
        creator: ticket.ticketCreator ? `${ticket.ticketCreator.firstname} ${ticket.ticketCreator.lastname}` : 'Unknown',
        createdDate: ticket.createdAt.toISOString().split('T')[0],
        closedDate: ticket.status === 'completed' ? ticket.updatedAt.toISOString().split('T')[0] : null,
        department: ticket.Department?.name || 'Unknown'
      }));

      return {
        summary: {
          totalTickets,
          resolvedTickets,
          pendingTickets,
          inProgressTickets,
          declinedTickets,
          resolutionRate: insights.resolutionRate || 0,
          averageResolutionTime: insights.averageResolutionTime || 0
        },
        statusBreakdown,
          priorityBreakdown,
          details,
          insights,
          filtersApplied: {
            startDate: startDate || 'Not specified',
            endDate: endDate || 'Not specified',
            departmentId: departmentId || 'Not specified',
            assignedTo: assignedTo || 'All users',
            status: status || 'All statuses',
            priority: priority || 'All priorities'
          }
        };
    } catch (error) {
      console.error('Error generating ticket report:', error);
      throw error;
    }
  }

  // Generate Task Report
  async generateTaskReport(parameters, userRole = null) {
    const { 
      startDate, 
      endDate, 
      departmentId, 
      assignedTo, 
      status, 
      dueDate,
      includeInsights = true 
    } = parameters;

    try {
      // Build where clause
      const whereClause = {};
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }
      
      if (status) {
        whereClause.status = status;
      }

      // Handle department filtering
      if (departmentId) {
        whereClause.department_id = departmentId;
      } else if (userRole === 'department_head') {
        const user = await User.findByPk(parameters.userId);
        if (user && user.departmentId) {
          whereClause.department_id = user.departmentId;
        }
      }

      // Handle assignee filtering
      if (assignedTo) {
        whereClause.assignedToId = assignedTo;
      }

      // Fetch tasks with related data
      console.log('Task Report - whereClause:', whereClause);
      const tasks = await Task.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'assignedUser',
            attributes: ['id', 'firstname', 'lastname', 'email', 'role']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'firstname', 'lastname', 'email', 'role']
          },
          {
            model: Department,
            attributes: ['id', 'name']
          },
          {
            model: Ticket,
            as: 'relatedTicket',
            attributes: ['id', 'title', 'status']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Calculate summary statistics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const pendingTasks = tasks.filter(t => t.status === 'pending').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const overdueTasks = tasks.filter(t => {
        if (t.dueDate && t.status !== 'completed') {
          return new Date(t.dueDate) < new Date();
        }
        return false;
      }).length;

      // Status breakdown
      const statusBreakdown = [
        { status: 'Completed', count: completedTasks, percentage: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0 },
        { status: 'In Progress', count: inProgressTasks, percentage: totalTasks > 0 ? (inProgressTasks / totalTasks * 100).toFixed(1) : 0 },
        { status: 'Pending', count: pendingTasks, percentage: totalTasks > 0 ? (pendingTasks / totalTasks * 100).toFixed(1) : 0 },
        { status: 'Overdue', count: overdueTasks, percentage: totalTasks > 0 ? (overdueTasks / totalTasks * 100).toFixed(1) : 0 }
      ];

      // Task distribution by department/user
      const departmentDistribution = {};
      const userDistribution = {};
      
      tasks.forEach(task => {
        const deptName = task.Department?.name || 'Unknown';
        const userName = task.assignedUser ? `${task.assignedUser.firstname} ${task.assignedUser.lastname}` : 'Unassigned';
        
        departmentDistribution[deptName] = (departmentDistribution[deptName] || 0) + 1;
        userDistribution[userName] = (userDistribution[userName] || 0) + 1;
      });

      // Calculate insights
      let insights = {};
      if (includeInsights) {
        const completedTasksWithTimes = tasks.filter(t => t.status === 'completed' && t.updatedAt);
        const averageCompletionTime = completedTasksWithTimes.length > 0 
          ? completedTasksWithTimes.reduce((sum, task) => {
              const completionTime = new Date(task.updatedAt) - new Date(task.createdAt);
              return sum + completionTime;
            }, 0) / completedTasksWithTimes.length
          : 0;

        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;

        // Task load per user
        const taskLoadPerUser = Object.entries(userDistribution)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([name, count]) => ({ user: name, taskCount: count }));

        insights = {
          averageCompletionTime: Math.round(averageCompletionTime / (1000 * 60 * 60 * 24) * 10) / 10, // in days
          completionRate: parseFloat(completionRate),
          overdueTaskCount: overdueTasks,
          taskLoadPerUser
        };
      }

      // Format details table
      const details = tasks.map(task => ({
        taskId: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : null,
        assignee: task.assignedUser ? `${task.assignedUser.firstname} ${task.assignedUser.lastname}` : 'Unassigned',
        relatedTicket: task.relatedTicket ? `${task.relatedTicket.id} - ${task.relatedTicket.title}` : null,
        createdDate: task.createdAt.toISOString().split('T')[0],
        department: task.Department?.name || 'Unknown'
      }));

      return {
        summary: {
          totalTasks,
          completedTasks,
          pendingTasks,
          inProgressTasks,
          overdueTasks,
          completionRate: insights.completionRate || 0
        },
        statusBreakdown,
        departmentDistribution,
          userDistribution,
          details,
          insights,
          filtersApplied: {
            startDate: startDate || 'Not specified',
            endDate: endDate || 'Not specified',
            departmentId: departmentId || 'Not specified',
            assignedTo: assignedTo || 'All users',
            status: status || 'All statuses',
            dueDate: dueDate || 'Not specified'
          }
        };
    } catch (error) {
      console.error('Error generating task report:', error);
      throw error;
    }
  }

  // Generate User Report
  async generateUserReport(parameters) {
    const { userId, startDate, endDate, includeInsights = true } = parameters;

    try {
      // Get user information
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Department,
            attributes: ['id', 'name']
          }
        ]
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Build date filter
      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter[Op.between] = [new Date(startDate), new Date(endDate)];
      }

      let tasks = [];
      let tickets = [];

      // Role-based data fetching
      console.log('User Report - userId:', userId, 'userRole:', user.role, 'dateFilter:', dateFilter);
      if (user.role === 'department_head') {
        // Department heads see received tickets (assigned to them)
        const ticketWhereClause = {
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
        };

        // Get tickets assigned to the user (received tickets)
        tickets = await Ticket.findAll({
          where: {
            assigned_to: userId,
            ...ticketWhereClause
          },
          include: [
            {
              model: User,
              as: 'ticketAssignee',
              attributes: ['id', 'firstname', 'lastname', 'email', 'role']
            },
            {
              model: User,
              as: 'ticketCreator',
              attributes: ['id', 'firstname', 'lastname', 'email', 'role']
            },
            {
              model: Department,
              attributes: ['id', 'name']
            }
          ],
          order: [['createdAt', 'DESC']]
        });
      } else if (user.role === 'employee') {
        // Employees see tasks assigned to them
        tasks = await Task.findAll({
          where: {
            assignedToId: userId,
            ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
          },
          include: [
            {
              model: User,
              as: 'assignedUser',
              attributes: ['id', 'firstname', 'lastname', 'email', 'role']
            },
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'firstname', 'lastname', 'email', 'role']
            },
            {
              model: Department,
              attributes: ['id', 'name']
            },
            {
              model: Ticket,
              as: 'relatedTicket',
              attributes: ['id', 'title', 'status']
            }
          ],
          order: [['createdAt', 'DESC']]
        });
      } else if (user.role === 'admin') {
        // Admins see both tasks and tickets
        tasks = await Task.findAll({
          where: {
            assignedToId: userId,
            ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
          },
          include: [
            {
              model: User,
              as: 'assignedUser',
              attributes: ['id', 'firstname', 'lastname', 'email', 'role']
            },
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'firstname', 'lastname', 'email', 'role']
            },
            {
              model: Department,
              attributes: ['id', 'name']
            },
            {
              model: Ticket,
              as: 'relatedTicket',
              attributes: ['id', 'title', 'status']
            }
          ],
          order: [['createdAt', 'DESC']]
        });

        tickets = await Ticket.findAll({
          where: {
            assigned_to: userId,
            ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
          },
          include: [
            {
              model: User,
              as: 'ticketAssignee',
              attributes: ['id', 'firstname', 'lastname', 'email', 'role']
            },
            {
              model: User,
              as: 'ticketCreator',
              attributes: ['id', 'firstname', 'lastname', 'email', 'role']
            },
            {
              model: Department,
              attributes: ['id', 'name']
            }
          ],
          order: [['createdAt', 'DESC']]
        });
      }

      // Calculate summary statistics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const totalTickets = tickets.length;
      const closedTickets = tickets.filter(t => t.status === 'completed').length;

      // Calculate insights based on user role
      let insights = {};
      if (includeInsights) {
        if (user.role === 'department_head') {
          // Department head insights - focus on tickets
          // Include both completed and declined tickets as resolved (same as analytics dashboard)
          const resolvedTicketsWithTimes = tickets.filter(t => 
            (t.status === 'completed' || t.status === 'declined') && t.updatedAt
          );
          const averageTicketResolutionTime = resolvedTicketsWithTimes.length > 0 
            ? resolvedTicketsWithTimes.reduce((sum, ticket) => {
                const resolutionTime = new Date(ticket.updatedAt) - new Date(ticket.createdAt);
                // Ensure resolution time is not negative (updatedAt should be >= createdAt)
                return sum + Math.max(0, resolutionTime);
              }, 0) / resolvedTicketsWithTimes.length
            : 0;

          // Resolution rate includes both completed and declined tickets
          const totalResolvedTickets = tickets.filter(t => t.status === 'completed' || t.status === 'declined').length;
          const resolutionRate = totalTickets > 0 ? (totalResolvedTickets / totalTickets * 100).toFixed(1) : 0;

          // Ticket priority distribution
          const priorityDistribution = {};
          tickets.forEach(ticket => {
            const priority = ticket.priority || 'Medium';
            priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
          });

          // Most frequent ticket categories
          const ticketCategories = {};
          tickets.forEach(ticket => {
            const category = ticket.category || 'General';
            ticketCategories[category] = (ticketCategories[category] || 0) + 1;
          });

          const mostFrequentCategories = Object.entries(ticketCategories)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([category, count]) => ({ category, count }));

          insights = {
            averageResolutionTime: Math.round(averageTicketResolutionTime / (1000 * 60 * 60 * 24) * 10) / 10, // in days
            resolutionRate: parseFloat(resolutionRate),
            priorityDistribution,
            mostFrequentCategories,
            receivedTicketCount: tickets.length
          };
        } else if (user.role === 'employee') {
          // Employee insights - focus on tasks
          const completedTasksWithTimes = tasks.filter(t => t.status === 'completed' && t.updatedAt);
          const averageTaskDuration = completedTasksWithTimes.length > 0 
            ? completedTasksWithTimes.reduce((sum, task) => {
                const duration = new Date(task.updatedAt) - new Date(task.createdAt);
                return sum + duration;
              }, 0) / completedTasksWithTimes.length
            : 0;

          const completionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;

          // Overdue tasks
          const overdueTasks = tasks.filter(t => {
            if (t.dueDate && t.status !== 'completed') {
              return new Date(t.dueDate) < new Date();
            }
            return false;
          }).length;

          // Task priority distribution
          const priorityDistribution = {};
          tasks.forEach(task => {
            const priority = task.priority || 'Medium';
            priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
          });

          insights = {
            averageTaskDuration: Math.round(averageTaskDuration / (1000 * 60 * 60 * 24) * 10) / 10, // in days
            completionRate: parseFloat(completionRate),
            overdueItems: overdueTasks,
            priorityDistribution
          };
        } else if (user.role === 'admin') {
          // Admin insights - both tasks and tickets
          const completedTasksWithTimes = tasks.filter(t => t.status === 'completed' && t.updatedAt);
          const averageTaskDuration = completedTasksWithTimes.length > 0 
            ? completedTasksWithTimes.reduce((sum, task) => {
                const duration = new Date(task.updatedAt) - new Date(task.createdAt);
                return sum + duration;
              }, 0) / completedTasksWithTimes.length
            : 0;

          // Include both completed and declined tickets as resolved (same as analytics dashboard)
          const resolvedTicketsWithTimes = tickets.filter(t => 
            (t.status === 'completed' || t.status === 'declined') && t.updatedAt
          );
          const averageTicketResolutionTime = resolvedTicketsWithTimes.length > 0 
            ? resolvedTicketsWithTimes.reduce((sum, ticket) => {
                const resolutionTime = new Date(ticket.updatedAt) - new Date(ticket.createdAt);
                // Ensure resolution time is not negative (updatedAt should be >= createdAt)
                return sum + Math.max(0, resolutionTime);
              }, 0) / resolvedTicketsWithTimes.length
            : 0;

          const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;
          // Resolution rate includes both completed and declined tickets
          const totalResolvedTicketsForAdmin = tickets.filter(t => t.status === 'completed' || t.status === 'declined').length;
          const ticketResolutionRate = totalTickets > 0 ? (totalResolvedTicketsForAdmin / totalTickets * 100).toFixed(1) : 0;

          insights = {
            averageTaskDuration: Math.round(averageTaskDuration / (1000 * 60 * 60 * 24) * 10) / 10,
            averageTicketResolutionTime: Math.round(averageTicketResolutionTime / (1000 * 60 * 60 * 24) * 10) / 10,
            taskCompletionRate: parseFloat(taskCompletionRate),
            ticketResolutionRate: parseFloat(ticketResolutionRate),
            totalAssignedItems: totalTasks + totalTickets
          };
        }
      }

      // Format activity table
      const activity = [
        ...tasks.map(task => ({
          type: 'Task',
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority || 'Medium',
          assignee: task.assignedUser ? `${task.assignedUser.firstname} ${task.assignedUser.lastname}` : 'Unassigned',
          createdDate: task.createdAt.toISOString().split('T')[0],
          dueClosedDate: task.status === 'completed' ? task.updatedAt.toISOString().split('T')[0] : 
                        task.dueDate ? task.dueDate.toISOString().split('T')[0] : null
        })),
        ...tickets.map(ticket => ({
          type: 'Ticket',
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority || 'Medium',
          assignee: ticket.ticketAssignee ? `${ticket.ticketAssignee.firstname} ${ticket.ticketAssignee.lastname}` : 'Unassigned',
          createdDate: ticket.createdAt.toISOString().split('T')[0],
          dueClosedDate: ticket.status === 'completed' ? ticket.updatedAt.toISOString().split('T')[0] : null
        }))
      ].sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

      return {
        userProfile: {
          userId: user.id,
          fullName: `${user.firstname} ${user.lastname}`,
          role: user.role,
          department: user.Department?.name || 'Unknown',
          status: user.isActive ? 'Active' : 'Inactive',
          lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null
        },
        summary: user.role === 'department_head' ? {
          ticketsAssigned: totalTickets,
          ticketsCompleted: closedTickets,
          resolutionRate: insights.resolutionRate || 0,
          averageResolutionTime: insights.averageResolutionTime || 0,
          receivedTicketCount: insights.receivedTicketCount || 0
        } : user.role === 'employee' ? {
          tasksAssigned: totalTasks,
          tasksCompleted: completedTasks,
          completionRate: insights.completionRate || 0,
          averageTaskDuration: insights.averageTaskDuration || 0,
          overdueItems: insights.overdueItems || 0
        } : {
          // Admin summary
          ticketsAssigned: totalTickets,
          tasksAssigned: totalTasks,
          ticketsCompleted: closedTickets,
          tasksCompleted: completedTasks,
          ticketResolutionRate: insights.ticketResolutionRate || 0,
          taskCompletionRate: insights.taskCompletionRate || 0,
          averageTicketResolutionTime: insights.averageTicketResolutionTime || 0,
          averageTaskDuration: insights.averageTaskDuration || 0,
          totalAssignedItems: insights.totalAssignedItems || 0
        },
        activity,
        insights,
        filtersApplied: {
          userId: userId || 'Not specified',
          startDate: startDate || 'Not specified',
          endDate: endDate || 'Not specified'
        }
      };
    } catch (error) {
      console.error('Error generating user report:', error);
      throw error;
    }
  }

  // Generate Department Report
  async generateDepartmentReport(parameters, userRole = null) {
    const { departmentId, startDate, endDate, includeInsights = true } = parameters;

    try {
      // Get department information
      const department = await Department.findByPk(departmentId, {
        include: [
          {
            model: User,
            attributes: ['id', 'firstname', 'lastname', 'email', 'role', 'isActive', 'lastLogin']
          }
        ]
      });

      if (!department) {
        throw new Error('Department not found');
      }

      // Build date filter
      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter[Op.between] = [new Date(startDate), new Date(endDate)];
      }

      // Get department's tasks
      console.log('Department Report - departmentId:', departmentId, 'dateFilter:', dateFilter);
      const tasks = await Task.findAll({
        where: {
          department_id: departmentId,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
        },
        include: [
          {
            model: User,
            as: 'assignedUser',
            attributes: ['id', 'firstname', 'lastname', 'email']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

        // Get department's tickets (received tickets - assigned to users in this department + forwarded tickets)
        const departmentUserIds = department.Users.map(user => user.id);
        const tickets = await Ticket.findAll({
          where: {
            [Op.or]: [
              {
                assigned_to: {
                  [Op.in]: departmentUserIds
                }
              },
              {
                forwarded_to_id: {
                  [Op.in]: departmentUserIds
                }
              }
            ],
            ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
          },
        include: [
          {
            model: User,
            as: 'ticketAssignee',
            attributes: ['id', 'firstname', 'lastname', 'email']
          },
          {
            model: User,
            as: 'ticketCreator',
            attributes: ['id', 'firstname', 'lastname', 'email']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Calculate summary statistics
      const totalUsers = department.Users.length;
      const activeUsers = department.Users.filter(u => u.isActive).length;
      const totalTasks = tasks.length;
      const totalTickets = tickets.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      // Include both completed and declined tickets as resolved (same as analytics dashboard)
      const resolvedTickets = tickets.filter(t => t.status === 'completed' || t.status === 'declined').length;

      // Calculate insights
      let insights = {};
      if (includeInsights) {
        const completedTasksWithTimes = tasks.filter(t => t.status === 'completed' && t.updatedAt);
        const averageResolutionTime = completedTasksWithTimes.length > 0 
          ? completedTasksWithTimes.reduce((sum, task) => {
              const resolutionTime = new Date(task.updatedAt) - new Date(task.createdAt);
              return sum + resolutionTime;
            }, 0) / completedTasksWithTimes.length
          : 0;


        // Overdue items
        const overdueTasks = tasks.filter(t => {
          if (t.dueDate && t.status !== 'completed') {
            return new Date(t.dueDate) < new Date();
          }
          return false;
        }).length;

        // Department workload distribution
        const workloadDistribution = {};
        department.Users.forEach(user => {
          const userTasks = tasks.filter(t => t.assignedTo === user.id).length;
          const userTickets = tickets.filter(t => t.assignedTo === user.id).length;
          workloadDistribution[`${user.firstname} ${user.lastname}`] = {
            tasks: userTasks,
            tickets: userTickets,
            total: userTasks + userTickets
          };
        });

        insights = {
          averageResolutionTime: Math.round(averageResolutionTime / (1000 * 60 * 60 * 24) * 10) / 10, // in days
          overdueItems: overdueTasks,
          workloadDistribution
        };
      }

      // Format activity table
      const activity = [
        ...tasks.map(task => ({
          type: 'Task',
          id: task.id,
          title: task.title,
          status: task.status,
          assignee: task.assignedUser ? `${task.assignedUser.firstname} ${task.assignedUser.lastname}` : 'Unassigned',
          createdDate: task.createdAt.toISOString().split('T')[0],
          dueClosedDate: task.status === 'completed' ? task.updatedAt.toISOString().split('T')[0] : 
                        task.dueDate ? task.dueDate.toISOString().split('T')[0] : null
        })),
        ...tickets.map(ticket => ({
          type: 'Ticket',
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          assignee: ticket.ticketAssignee ? `${ticket.ticketAssignee.firstname} ${ticket.ticketAssignee.lastname}` : 'Unassigned',
          createdDate: ticket.createdAt.toISOString().split('T')[0],
          dueClosedDate: ticket.status === 'completed' ? ticket.updatedAt.toISOString().split('T')[0] : null
        }))
      ].sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

      return {
        departmentProfile: {
          departmentName: department.name,
          totalUsers,
          activeUsers,
          manager: department.Users.find(u => u.role === 'department_head')?.firstname + ' ' + 
                  department.Users.find(u => u.role === 'department_head')?.lastname || 'Not Assigned'
        },
        summary: {
          totalTickets,
          totalTasks,
          averageResolutionTime: insights.averageResolutionTime || 0,
          overdueItems: insights.overdueItems || 0
        },
        activity,
        insights,
        filtersApplied: {
          departmentId: departmentId || 'Not specified',
          startDate: startDate || 'Not specified',
          endDate: endDate || 'Not specified'
        }
      };
    } catch (error) {
      console.error('Error generating department report:', error);
      throw error;
    }
  }

  // Generate Custom Report
  async generateCustomReportData(parameters) {
    const { 
      selectedFields: originalSelectedFields = [], 
      startDate, 
      endDate, 
      departmentId,
      filters = {},
      includeInsights = true 
    } = parameters;

    // Remove user and department metrics from custom report generation
    const removedMetrics = new Set([
      'totalUsers', 'activeUsers', 'inactiveUsers', 'userProductivityScore', 'userTaskLoad',
      'departmentEfficiency', 'departmentWorkload', 'departmentPerformance'
    ]);
    const selectedFields = (originalSelectedFields || []).filter(key => !removedMetrics.has(key));

    console.log('Custom report parameters:', { selectedFields, startDate, endDate, filters });

    try {
      // Build base query conditions
      const whereClause = {};
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      // Add department filtering for custom reports - get tickets assigned to users in the department
      let departmentUserIds = [];
      if (departmentId) {
        // Get all users in the specified department
        const departmentUsers = await User.findAll({
          where: { departmentId: departmentId },
          attributes: ['id']
        });
        departmentUserIds = departmentUsers.map(user => user.id);
      }

      // Apply custom filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          whereClause[key] = value;
        }
      });
      
      console.log('Built whereClause:', whereClause);

      // Fetch data based on selected fields
      const data = {};

      // Calculate custom metrics based on selected fields
      const customMetrics = {};
      
      // Task Metrics
      if (selectedFields.includes('totalTasks')) {
        // Fetch tasks data for total count
        const tasks = await Task.findAll({
          where: whereClause,
          include: [
            {
              model: User,
              as: 'taskAssignee',
              attributes: ['id', 'firstname', 'lastname', 'email']
            },
            {
              model: Department,
              attributes: ['id', 'name']
            }
          ],
          order: [['createdAt', 'DESC']]
        });
        data.tasks = tasks;
        customMetrics.totalTasks = tasks.length;
        console.log(`Total tasks found: ${tasks.length}`);
      }
      if (selectedFields.includes('pendingTasks')) {
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        customMetrics.pendingTasks = data.tasks.filter(t => t.status === 'pending').length;
      }
      if (selectedFields.includes('inProgressTasks')) {
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        customMetrics.inProgressTasks = data.tasks.filter(t => t.status === 'in_progress').length;
      }
      if (selectedFields.includes('completedTasks')) {
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        customMetrics.completedTasks = data.tasks.filter(t => t.status === 'completed').length;
      }
      if (selectedFields.includes('overdueTasks')) {
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        customMetrics.overdueTasks = data.tasks.filter(t => {
          if (t.dueDate && t.status !== 'completed') {
            return new Date(t.dueDate) < new Date();
          }
          return false;
        }).length;
      }
      if (selectedFields.includes('taskCompletionRate')) {
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        const totalTasks = data.tasks.length;
        const completedTasks = data.tasks.filter(t => t.status === 'completed').length;
        customMetrics.taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;
      }
      if (selectedFields.includes('averageTaskCompletionTime')) {
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        const completedTasks = data.tasks.filter(t => t.status === 'completed' && t.updatedAt);
        customMetrics.averageTaskCompletionTime = completedTasks.length > 0 
          ? completedTasks.reduce((sum, task) => {
              const completionTime = new Date(task.updatedAt) - new Date(task.createdAt);
              return sum + completionTime;
            }, 0) / completedTasks.length / (1000 * 60 * 60 * 24) // Convert to days
          : 0;
      }

      // Ticket Metrics
      if (selectedFields.includes('totalTickets')) {
        // Build ticket-specific where clause
        const ticketWhereClause = { ...whereClause };
        
        // Filter tickets assigned to users in the department (received tickets) + forwarded tickets
        if (departmentUserIds.length > 0) {
          ticketWhereClause[Op.or] = [
            {
              assigned_to: {
                [Op.in]: departmentUserIds
              }
            },
            {
              forwarded_to_id: {
                [Op.in]: departmentUserIds
              }
            }
          ];
        }
        
        // Fetch tickets data for total count
        const tickets = await Ticket.findAll({
          where: ticketWhereClause,
          include: [
            {
              model: User,
              as: 'ticketAssignee',
              attributes: ['id', 'firstname', 'lastname', 'email']
            },
            {
              model: Department,
              attributes: ['id', 'name']
            }
          ],
          order: [['createdAt', 'DESC']]
        });
        data.tickets = tickets;
        customMetrics.totalTickets = tickets.length;
        console.log(`Total tickets found: ${tickets.length}`);
      }
      if (selectedFields.includes('pendingTickets')) {
        if (!data.tickets) {
          const ticketWhereClause = { ...whereClause };
          if (departmentUserIds.length > 0) {
            ticketWhereClause[Op.or] = [
              { assigned_to: { [Op.in]: departmentUserIds } },
              { forwarded_to_id: { [Op.in]: departmentUserIds } }
            ];
          }
          data.tickets = await Ticket.findAll({ where: ticketWhereClause });
        }
        customMetrics.pendingTickets = data.tickets.filter(t => t.status === 'pending').length;
      }
      if (selectedFields.includes('inProgressTickets')) {
        if (!data.tickets) {
          const ticketWhereClause = { ...whereClause };
          if (departmentUserIds.length > 0) {
            ticketWhereClause[Op.or] = [
              { assigned_to: { [Op.in]: departmentUserIds } },
              { forwarded_to_id: { [Op.in]: departmentUserIds } }
            ];
          }
          data.tickets = await Ticket.findAll({ where: ticketWhereClause });
        }
        customMetrics.inProgressTickets = data.tickets.filter(t => t.status === 'in_progress').length;
      }
      if (selectedFields.includes('completedTickets')) {
        if (!data.tickets) {
          const ticketWhereClause = { ...whereClause };
          if (departmentUserIds.length > 0) {
            ticketWhereClause[Op.or] = [
              { assigned_to: { [Op.in]: departmentUserIds } },
              { forwarded_to_id: { [Op.in]: departmentUserIds } }
            ];
          }
          data.tickets = await Ticket.findAll({ where: ticketWhereClause });
        }
        customMetrics.completedTickets = data.tickets.filter(t => t.status === 'completed').length;
      }
      if (selectedFields.includes('declinedTickets')) {
        if (!data.tickets) {
          const ticketWhereClause = { ...whereClause };
          if (departmentUserIds.length > 0) {
            ticketWhereClause[Op.or] = [
              { assigned_to: { [Op.in]: departmentUserIds } },
              { forwarded_to_id: { [Op.in]: departmentUserIds } }
            ];
          }
          data.tickets = await Ticket.findAll({ where: ticketWhereClause });
        }
        customMetrics.declinedTickets = data.tickets.filter(t => t.status === 'declined').length;
      }
      if (selectedFields.includes('ticketResolutionRate')) {
        if (!data.tickets) {
          const ticketWhereClause = { ...whereClause };
          if (departmentUserIds.length > 0) {
            ticketWhereClause[Op.or] = [
              { assigned_to: { [Op.in]: departmentUserIds } },
              { forwarded_to_id: { [Op.in]: departmentUserIds } }
            ];
          }
          data.tickets = await Ticket.findAll({ where: ticketWhereClause });
        }
        const totalTickets = data.tickets.length;
        // Include both completed and declined tickets as resolved (same as analytics dashboard)
        const resolvedTickets = data.tickets.filter(t => t.status === 'completed' || t.status === 'declined').length;
        customMetrics.ticketResolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets * 100).toFixed(1) : 0;
      }
      if (selectedFields.includes('averageTicketResolutionTime')) {
        if (!data.tickets) {
          const ticketWhereClause = { ...whereClause };
          if (departmentUserIds.length > 0) {
            ticketWhereClause[Op.or] = [
              { assigned_to: { [Op.in]: departmentUserIds } },
              { forwarded_to_id: { [Op.in]: departmentUserIds } }
            ];
          }
          data.tickets = await Ticket.findAll({ where: ticketWhereClause });
        }
        // Include both completed and declined tickets as resolved (same as analytics dashboard)
        const resolvedTickets = data.tickets.filter(t => 
          (t.status === 'completed' || t.status === 'declined') && t.updatedAt
        );
        customMetrics.averageTicketResolutionTime = resolvedTickets.length > 0 
          ? resolvedTickets.reduce((sum, ticket) => {
              const resolutionTime = new Date(ticket.updatedAt) - new Date(ticket.createdAt);
              // Ensure resolution time is not negative (updatedAt should be >= createdAt)
              return sum + Math.max(0, resolutionTime);
            }, 0) / resolvedTickets.length / (1000 * 60 * 60 * 24) // Convert to days
          : 0;
      }

      // User Metrics
      if (selectedFields.includes('totalUsers')) {
        // Fetch users data for total count - don't filter by date for user counts
        const userWhereClause = { ...whereClause };
        delete userWhereClause.createdAt; // Remove date filter for user counts
        
        const users = await User.findAll({
          where: userWhereClause,
          include: [
            {
              model: Department,
              attributes: ['id', 'name']
            }
          ],
          order: [['createdAt', 'DESC']]
        });
        data.users = users;
        customMetrics.totalUsers = users.length;
        console.log(`Total users found: ${users.length}`);
      }
      if (selectedFields.includes('activeUsers')) {
        if (!data.users) {
          const userWhereClause = { ...whereClause };
          delete userWhereClause.createdAt; // Remove date filter for user counts
          data.users = await User.findAll({ where: userWhereClause });
        }
        customMetrics.activeUsers = data.users.filter(u => u.isActive).length;
      }
      if (selectedFields.includes('inactiveUsers')) {
        if (!data.users) {
          const userWhereClause = { ...whereClause };
          delete userWhereClause.createdAt; // Remove date filter for user counts
          data.users = await User.findAll({ where: userWhereClause });
        }
        customMetrics.inactiveUsers = data.users.filter(u => !u.isActive).length;
      }
      if (selectedFields.includes('userProductivityScore')) {
        if (!data.users) {
          const userWhereClause = { ...whereClause };
          delete userWhereClause.createdAt; // Remove date filter for user counts
          data.users = await User.findAll({ where: userWhereClause });
        }
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        // Calculate average productivity score based on task completion
        const userProductivity = data.users.map(user => {
          const userTasks = data.tasks.filter(t => t.assigned_to_id === user.id);
          const completedTasks = userTasks.filter(t => t.status === 'completed').length;
          return userTasks.length > 0 ? (completedTasks / userTasks.length * 100) : 0;
        });
        customMetrics.userProductivityScore = userProductivity.length > 0 
          ? (userProductivity.reduce((sum, score) => sum + score, 0) / userProductivity.length).toFixed(1)
          : 0;
      }
      if (selectedFields.includes('userTaskLoad')) {
        if (!data.users) {
          const userWhereClause = { ...whereClause };
          delete userWhereClause.createdAt; // Remove date filter for user counts
          data.users = await User.findAll({ where: userWhereClause });
        }
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        // Calculate average task load per user
        customMetrics.userTaskLoad = data.users.length > 0 ? (data.tasks.length / data.users.length).toFixed(1) : 0;
      }

      // Department Metrics
      if (selectedFields.includes('departmentEfficiency')) {
        if (!data.departments) {
          const deptWhereClause = { ...whereClause };
          delete deptWhereClause.createdAt; // Remove date filter for department counts
          data.departments = await Department.findAll({ where: deptWhereClause });
        }
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        if (!data.tickets) {
          data.tickets = await Ticket.findAll({ where: whereClause });
        }
        const departmentEfficiency = data.departments.map(dept => {
          const deptTasks = data.tasks.filter(t => t.department_id === dept.id);
          const deptTickets = data.tickets.filter(t => t.department_id === dept.id);
          const completedTasks = deptTasks.filter(t => t.status === 'completed').length;
          const resolvedTickets = deptTickets.filter(t => t.status === 'completed').length;
          const totalItems = deptTasks.length + deptTickets.length;
          return totalItems > 0 ? ((completedTasks + resolvedTickets) / totalItems * 100) : 0;
        });
        customMetrics.departmentEfficiency = departmentEfficiency.length > 0 
          ? (departmentEfficiency.reduce((sum, eff) => sum + eff, 0) / departmentEfficiency.length).toFixed(1)
          : 0;
      }
      if (selectedFields.includes('departmentWorkload')) {
        if (!data.departments) {
          const deptWhereClause = { ...whereClause };
          delete deptWhereClause.createdAt; // Remove date filter for department counts
          data.departments = await Department.findAll({ where: deptWhereClause });
        }
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        if (!data.tickets) {
          data.tickets = await Ticket.findAll({ where: whereClause });
        }
        customMetrics.departmentWorkload = data.departments.length > 0 ? ((data.tasks.length + data.tickets.length) / data.departments.length).toFixed(1) : 0;
      }
      if (selectedFields.includes('departmentPerformance')) {
        // Calculate performance based on completion rates and workload balance
        if (!data.departments) {
          const deptWhereClause = { ...whereClause };
          delete deptWhereClause.createdAt; // Remove date filter for department counts
          data.departments = await Department.findAll({ where: deptWhereClause });
        }
        if (!data.tasks) {
          data.tasks = await Task.findAll({ where: whereClause });
        }
        if (!data.tickets) {
          data.tickets = await Ticket.findAll({ where: whereClause });
        }
        
        const departmentPerformance = data.departments.map(dept => {
          const deptTasks = data.tasks.filter(t => t.department_id === dept.id);
          const deptTickets = data.tickets.filter(t => t.department_id === dept.id);
          const completedTasks = deptTasks.filter(t => t.status === 'completed').length;
          const resolvedTickets = deptTickets.filter(t => t.status === 'completed').length;
          const totalItems = deptTasks.length + deptTickets.length;
          
          // Performance score: completion rate + workload balance bonus
          let performanceScore = totalItems > 0 ? ((completedTasks + resolvedTickets) / totalItems * 100) : 0;
          
          // Bonus for balanced workload (not too many pending items)
          const pendingItems = deptTasks.filter(t => t.status === 'pending').length + 
                              deptTickets.filter(t => t.status === 'pending').length;
          const workloadBalance = totalItems > 0 ? Math.max(0, 100 - (pendingItems / totalItems * 100)) : 100;
          
          return (performanceScore + workloadBalance) / 2; // Average of completion rate and workload balance
        });
        
        customMetrics.departmentPerformance = departmentPerformance.length > 0 
          ? (departmentPerformance.reduce((sum, perf) => sum + perf, 0) / departmentPerformance.length).toFixed(1)
          : 0;
      }


      // Filter out empty objects and undefined values from customMetrics
      const filteredCustomMetrics = {};
      Object.entries(customMetrics).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (typeof value === 'object' && !Array.isArray(value)) {
            // Only include non-empty objects
            if (Object.keys(value).length > 0) {
              filteredCustomMetrics[key] = value;
            }
          } else {
            filteredCustomMetrics[key] = value;
          }
        }
      });
      
      console.log('Calculated custom metrics:', customMetrics);
      console.log('Filtered custom metrics:', filteredCustomMetrics);

      // Calculate accurate total records based on selected fields (exclude users/departments)
      let totalRecords = 0;
      if (data.tasks) {
        totalRecords += data.tasks.length;
        console.log(`Tasks count: ${data.tasks.length}`);
      }
      if (data.tickets) {
        totalRecords += data.tickets.length;
        console.log(`Tickets count: ${data.tickets.length}`);
      }
      console.log(`Total records calculated (tasks + tickets only): ${totalRecords}`);

      return {
        summary: {
          totalRecords: totalRecords
        },
        customMetrics: filteredCustomMetrics,
        data,
        insights: includeInsights ? {
          crossSectionalAnalysis: filteredCustomMetrics,
          customKPIs: {
            overallEfficiency: data.tasks && data.tickets 
              ? ((filteredCustomMetrics.taskCompletionRate || 0) + (filteredCustomMetrics.ticketResolutionRate || 0)) / 2
              : filteredCustomMetrics.taskCompletionRate || filteredCustomMetrics.ticketResolutionRate || 0
          }
        } : {},
        filtersApplied: {
          startDate: startDate || 'Not specified',
          endDate: endDate || 'Not specified',
          departmentId: departmentId || 'Not specified',
          selectedFields: selectedFields.length > 0 ? selectedFields.join(', ') : 'All fields',
          customFilters: Object.keys(filters).length > 0 ? JSON.stringify(filters) : 'None'
        }
      };
    } catch (error) {
      console.error('Error generating custom report:', error);
      throw error;
    }
  }
}

module.exports = new ReportGenerationService();
