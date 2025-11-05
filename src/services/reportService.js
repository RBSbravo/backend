const { CustomReport, User, Task, Ticket, Department, UserActivityLog } = require('../models');
const { Op } = require('sequelize');
const { getDateString } = require('../utils/analyticsUtils');
const reportGenerationService = require('./reportGenerationService');

// Report generation functions

async function generateCustomReport(reportId, userRole = null) {
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
    switch (report.type) {
      case 'task':
        data = await reportGenerationService.generateTaskReport(report.parameters, userRole || (report.reportCreator && report.reportCreator.role));
        break;
      case 'ticket':
        data = await reportGenerationService.generateTicketReport(report.parameters, userRole || (report.reportCreator && report.reportCreator.role));
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
      title: report.name,
      generatedBy: report.reportCreator ? `${report.reportCreator.firstname} ${report.reportCreator.lastname}` : null,
      createdAt: report.createdAt,
      type: report.type
    },
    data
  };
}

// Placeholder: You would move generateTaskReport, generateUserReport, generateDepartmentReport, generateCustomReportData here as well.

module.exports = {
  generateCustomReport
}; 