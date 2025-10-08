const { Ticket, User, Department } = require('../models');
const { Op } = require('sequelize');
const { getDateString } = require('../utils/analyticsUtils');

// Ticket analytics functions

async function getTicketSummary(startDate, endDate) {
  const tickets = await Ticket.findAll({
    where: {
      createdAt: {
        [Op.between]: [startDate, endDate]
      }
    }
  });

  return {
    totalTickets: tickets.length,
    pendingTickets: tickets.filter(t => t.status === 'pending').length,
    inProgressTickets: tickets.filter(t => t.status === 'in_progress').length,
    closedTickets: tickets.filter(t => t.status === 'declined').length,
    resolvedTickets: tickets.filter(t => t.status === 'completed').length
  };
}

async function getTicketMetricsByMonth(departmentId, startDate, endDate) {
  // Get all users in the department first
  const departmentUsers = await User.findAll({
    where: { departmentId },
    attributes: ['id']
  });
  
  const userIds = departmentUsers.map(user => user.id);
  
  const allTickets = await Ticket.findAll({
    where: {
      [Op.or]: [
        { assigned_to: { [Op.in]: userIds } },
        { forwarded_to_id: { [Op.in]: userIds } },
        { current_handler_id: { [Op.in]: userIds } }
      ],
      createdAt: {
        [Op.between]: [startDate, endDate]
      }
    }
  });

  // Group tickets by month
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentDate = new Date();
  const ticketMetrics = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthName = months[month.getMonth()];
    const monthStart = month.toISOString().split('T')[0];
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().split('T')[0];
    const monthTickets = allTickets.filter(ticket => {
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
  return ticketMetrics;
}

module.exports = {
  getTicketSummary,
  getTicketMetricsByMonth
}; 