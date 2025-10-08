// Remove CSV and Excel export utilities
// const { Parser } = require('json2csv');
// const ExcelJS = require('exceljs');
// async function toCSV(data, fields = null) { ... }
// async function toExcel(data, sheetName = 'Sheet1') { ... }
// module.exports = { toCSV, toExcel }; 

const PDFDocument = require('pdfkit');
const path = require('path');

async function exportReportPDF(result, data, res) {
  try {
    console.log('Starting PDF generation for report type:', result?.report?.type);
    console.log('Data structure keys:', Object.keys(data || {}));
    console.log('Report ID:', result?.report?.id);
    console.log('Report name:', result?.report?.name);
    console.log('Data summary keys:', data?.summary ? Object.keys(data.summary) : 'No summary');
    console.log('Data userProfile:', data?.userProfile ? Object.keys(data.userProfile) : 'No userProfile');
    console.log('Data departmentProfile:', data?.departmentProfile ? Object.keys(data.departmentProfile) : 'No departmentProfile');
    console.log('Data customMetrics:', data?.customMetrics ? Object.keys(data.customMetrics) : 'No customMetrics');
    
  const doc = new PDFDocument({ 
    margin: 50, 
    size: 'A4',
    info: {
      Title: result?.report?.name || 'Report',
      Author: result?.report?.reportCreator ? `${result.report.reportCreator.firstname} ${result.report.reportCreator.lastname}` : 'System',
      Subject: `${result?.report?.type || 'Custom'} Report`,
      Keywords: 'report, analytics, management',
      Creator: 'MITO Management System'
    }
  });
  let buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
      try {
    const pdfData = Buffer.concat(buffers);
    res.header('Content-Type', 'application/pdf');
        
        // Generate descriptive filename with better error handling
        const reportType = result && result.report ? result.report.type : 'custom';
        const reportName = result && result.report ? (result.report.name || result.report.title || 'Report') : 'Report';
        const date = new Date().toISOString().split('T')[0];
        const safeName = (reportName || 'Report').replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${safeName}_${reportType}_${date}.pdf`;
        
        console.log('PDF generated successfully, filename:', filename);
        res.attachment(filename);
    res.send(pdfData);
      } catch (error) {
        console.error('Error in PDF generation end event:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
      }
    });
    doc.on('error', (error) => {
      console.error('PDF generation error:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
  });
  const dataTables = [];
  
  // --- Professional Header Section ---
  const headerY = 50;
  
  // Institution/Company Header with inline logo
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1B4D3E')
     .text('Municipal Information Technology Office', 50, headerY, { align: 'center', width: doc.page.width - 100 });
  
  doc.font('Helvetica').fontSize(10).fillColor('#666')
     .text('Ticketing and Task Management System', 50, headerY + 20, { align: 'center', width: doc.page.width - 100 });
  
  // Logo inline with header (if available)
  try {
    const logoPath = path.resolve(__dirname, '../../desktop-app/src/assets/mito_logo.png');
    doc.image(logoPath, doc.page.width - 80, headerY + 5, { width: 25 });
  } catch (e) {
    // If logo not found, add a small decorative element inline with header
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#E6F4EA')
       .text('MITO', doc.page.width - 60, headerY + 8, { align: 'center', width: 20 });
  }
  
  // Report Title Section
  const reportTitle = (result && result.report && (result.report.name || result.report.title)) || 'Report';
  const reportIdText = result && result.report && result.report.id ? ` (${result.report.id})` : '';
  
  doc.moveDown(1.8);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1B4D3E')
     .text(`${reportTitle}${reportIdText}`, 50, doc.y, { align: 'center', width: doc.page.width - 100 });
  
  // Report Type and Date
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(11).fillColor('#666')
     .text(`${result?.report?.type?.toUpperCase() || 'CUSTOM'} REPORT`, 50, doc.y, { align: 'center', width: doc.page.width - 100 });
  
  doc.moveDown(0.1);
  doc.font('Helvetica').fontSize(9).fillColor('#888')
     .text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 50, doc.y, { align: 'center', width: doc.page.width - 100 });
  
  // Professional separator line
  doc.moveDown(0.3);
  const lineY = doc.y;
  doc.save()
    .moveTo(50, lineY)
    .lineTo(doc.page.width - 50, lineY)
    .lineWidth(1)
    .stroke('#1B4D3E')
    .restore();
  
  doc.moveDown(0.4);
  
  // --- Report Information Section ---
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text('Report Information', { align: 'left' });
  doc.moveDown(0.2);
  
  // Clean metadata display without boxes
  const reportInfo = [
    { label: 'Report ID:', value: (result && result.report && result.report.id) || 'N/A' },
    { label: 'Report Type:', value: (result && result.report && result.report.type) || 'Custom' },
    { label: 'Generated By:', value: result && result.report && result.report.reportCreator ? `${result.report.reportCreator.firstname} ${result.report.reportCreator.lastname}` : 'System' },
    { label: 'Generated On:', value: result && result.report && result.report.createdAt ? new Date(result.report.createdAt).toLocaleString() : new Date().toLocaleString() },
    { label: 'Date Range:', value: result && result.report && result.report.parameters && result.report.parameters.startDate && result.report.parameters.endDate ? `${new Date(result.report.parameters.startDate).toLocaleDateString()} to ${new Date(result.report.parameters.endDate).toLocaleDateString()}` : 'All Time' }
  ];
  
  reportInfo.forEach(({ label, value }, index) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(label, 50, doc.y);
    
    // Calculate the width of the label to position the value right after it
    const labelWidth = doc.widthOfString(label);
    doc.font('Helvetica').fontSize(9).fillColor('#666').text(value, 50 + labelWidth + 5, doc.y);
    doc.moveDown(0.25);
  });
  
  doc.moveDown(0.3);
  // --- Report-specific content based on actual data structure ---
  if (result.report.type === 'user') {
    // User Report - display user profile and summary
    if (data.userProfile) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text('User Information', { align: 'left' });
    doc.moveDown(0.2);
      
    const userInfo = [
        { label: 'User Name:', value: data.userProfile.fullName || 'N/A' },
        { label: 'User ID:', value: data.userProfile.userId || 'N/A' },
        { label: 'Role:', value: data.userProfile.role || 'N/A' },
        { label: 'Department:', value: data.userProfile.department || 'N/A' },
        { label: 'Status:', value: data.userProfile.status || 'N/A' }
      ];
      
      userInfo.forEach(({ label, value }) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(label, 50, doc.y);
        
        // Calculate the width of the label to position the value right after it
        const labelWidth = doc.widthOfString(label);
        doc.font('Helvetica').fontSize(9).fillColor('#666').text(value, 50 + labelWidth + 5, doc.y);
        doc.moveDown(0.2);
      });
      
      doc.moveDown(0.3);
    }
    
    // User Report Summary
    if (data.summary) {
      const summaryPairs = [];
      Object.entries(data.summary).forEach(([key, value]) => {
        if (typeof value === 'number') {
          summaryPairs.push([key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase()), value]);
        }
      });
      
      if (summaryPairs.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text('Summary Statistics', 50, doc.y);
        doc.moveDown(0.2);
        
        // Display summary in a clean two-column format
        const leftColumnX = 50;
        const rightColumnX = doc.page.width / 2 + 20;
        let currentY = doc.y;
        let leftColumnY = currentY;
        let rightColumnY = currentY;
        
        summaryPairs.forEach(([label, value], index) => {
          const isLeftColumn = index % 2 === 0;
          const x = isLeftColumn ? leftColumnX : rightColumnX;
          const y = isLeftColumn ? leftColumnY : rightColumnY;
          
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(`${label}:`, x, y);
          
          // Calculate the width of the label to position the value right after it
          const labelWidth = doc.widthOfString(`${label}:`);
          doc.font('Helvetica').fontSize(9).fillColor('#666').text(value !== undefined ? value : 0, x + labelWidth + 5, y);
          
          if (isLeftColumn) {
            leftColumnY += 15;
          } else {
            rightColumnY += 15;
          }
        });
        
        // Move to the bottom of the higher column
        doc.y = Math.max(leftColumnY, rightColumnY) + 15;
        doc.moveDown(0.3);
      }
    }
    
    // User Activity
    if (data.activity && Array.isArray(data.activity)) {
      dataTables.push({
        title: 'User Activity',
        rows: data.activity.map(activity => ({
          Type: activity.type,
          Title: activity.title,
          Status: activity.status,
          Assignee: activity.assignee || 'N/A',
          'Created Date': activity.createdDate,
          'Due/Closed Date': activity.dueClosedDate || 'N/A'
        }))
      });
    }
  } else if (result.report.type === 'department') {
    // Department Report
    if (data.departmentProfile) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text('Department Information', 50, doc.y);
      doc.moveDown(0.2);
      
      const deptInfo = [
        { label: 'Department Name:', value: data.departmentProfile.departmentName || 'N/A' },
        { label: 'Total Users:', value: data.departmentProfile.totalUsers || 0 },
        { label: 'Active Users:', value: data.departmentProfile.activeUsers || 0 },
        { label: 'Department Head:', value: data.departmentProfile.manager || 'Not Assigned' }
      ];
      
      deptInfo.forEach(({ label, value }) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(label, 50, doc.y);
        
        // Calculate the width of the label to position the value right after it
        const labelWidth = doc.widthOfString(label);
        doc.font('Helvetica').fontSize(9).fillColor('#666').text(value, 50 + labelWidth + 5, doc.y);
        doc.moveDown(0.2);
      });
      
      doc.moveDown(0.3);
    }
    
    // Department Summary
    if (data.summary) {
      const summaryPairs = [];
      Object.entries(data.summary).forEach(([key, value]) => {
        if (typeof value === 'number') {
          summaryPairs.push([key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase()), value]);
        }
      });
      
      if (summaryPairs.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text('Department Summary', 50, doc.y);
        doc.moveDown(0.2);
        
        // Display summary in a clean two-column format
        const leftColumnX = 50;
        const rightColumnX = doc.page.width / 2 + 20;
        let currentY = doc.y;
        let leftColumnY = currentY;
        let rightColumnY = currentY;
        
        summaryPairs.forEach(([label, value], index) => {
          const isLeftColumn = index % 2 === 0;
          const x = isLeftColumn ? leftColumnX : rightColumnX;
          const y = isLeftColumn ? leftColumnY : rightColumnY;
          
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(`${label}:`, x, y);
          
          // Calculate the width of the label to position the value right after it
          const labelWidth = doc.widthOfString(`${label}:`);
          doc.font('Helvetica').fontSize(9).fillColor('#666').text(value !== undefined ? value : 0, x + labelWidth + 5, y);
          
          if (isLeftColumn) {
            leftColumnY += 15;
          } else {
            rightColumnY += 15;
          }
        });
        
        // Move to the bottom of the higher column
        doc.y = Math.max(leftColumnY, rightColumnY) + 15;
        doc.moveDown(0.3);
      }
    }
    
    // Department Activity
    if (data.activity && Array.isArray(data.activity)) {
      dataTables.push({
        title: 'Department Activity',
        rows: data.activity.map(activity => ({
          Type: activity.type,
          Title: activity.title,
          Status: activity.status,
          Assignee: activity.assignee || 'N/A',
          'Created Date': activity.createdDate,
          'Due/Closed Date': activity.dueClosedDate || 'N/A'
        }))
      });
    }
  } else if (result.report.type === 'ticket') {
    // Ticket Report Summary
    if (data.summary) {
    const summaryPairs = [];
      Object.entries(data.summary).forEach(([key, value]) => {
        if (typeof value === 'number') {
          summaryPairs.push([key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase()), value]);
        }
      });
      
      if (summaryPairs.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text('Ticket Summary', 50, doc.y);
        doc.moveDown(0.2);
        
        // Display summary in a clean two-column format
        const leftColumnX = 50;
        const rightColumnX = doc.page.width / 2 + 20;
        let currentY = doc.y;
        let leftColumnY = currentY;
        let rightColumnY = currentY;
        
        summaryPairs.forEach(([label, value], index) => {
          const isLeftColumn = index % 2 === 0;
          const x = isLeftColumn ? leftColumnX : rightColumnX;
          const y = isLeftColumn ? leftColumnY : rightColumnY;
          
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(`${label}:`, x, y);
          
          // Calculate the width of the label to position the value right after it
          const labelWidth = doc.widthOfString(`${label}:`);
          doc.font('Helvetica').fontSize(9).fillColor('#666').text(value !== undefined ? value : 0, x + labelWidth + 5, y);
          
          if (isLeftColumn) {
            leftColumnY += 15;
          } else {
            rightColumnY += 15;
          }
        });
        
        // Move to the bottom of the higher column
        doc.y = Math.max(leftColumnY, rightColumnY) + 15;
        doc.moveDown(0.3);
      }
    }
    
    // Ticket Details - Check both tickets array and details array
    let ticketData = data.tickets || data.details || [];
    if (Array.isArray(ticketData) && ticketData.length > 0) {
      dataTables.push({
        title: 'Ticket Details',
        rows: ticketData.map(ticket => {
          // Enhanced debug logging for each ticket
          console.log('Ticket data structure:', {
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
            assignee: ticket.assignee,
            creator: ticket.creator,
            createdDate: ticket.createdDate,
            closedDate: ticket.closedDate,
            department: ticket.department,
            fullTicket: ticket
          });
          
          return {
            Title: ticket.title || '',
            Status: ticket.status || '',
            Priority: ticket.priority || 'Medium',
            Assignee: ticket.assignee || 'Unassigned',
            Creator: ticket.creator || 'Unknown',
            'Created Date': ticket.createdDate || '',
            'Closed Date': ticket.closedDate || 'N/A',
            Department: ticket.department || 'N/A'
          };
        })
      });
    }
    
    // Removed duplicate ticket details table to prevent duplicate tables
    
    // Also check for activity data (like in department reports)
    if (data.activity && Array.isArray(data.activity)) {
      dataTables.push({
        title: 'Ticket Activity',
        rows: data.activity.filter(item => item.type === 'Ticket').map(ticket => ({
          Type: ticket.type || 'Ticket',
          Title: ticket.title || '',
          Status: ticket.status || '',
          Priority: ticket.priority || '',
          Assignee: ticket.assignee || 'Unassigned',
          'Created Date': ticket.createdDate || '',
          'Due/Closed Date': ticket.dueClosedDate || 'N/A'
        }))
      });
    }
  } else if (result.report.type === 'task') {
    // Task Report Summary
    if (data.summary) {
      const summaryPairs = [];
      Object.entries(data.summary).forEach(([key, value]) => {
        if (typeof value === 'number') {
          summaryPairs.push([key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase()), value]);
        }
      });
      
    if (summaryPairs.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text('Task Summary', 50, doc.y);
      doc.moveDown(0.2);
        
        // Display summary in a clean two-column format
        const leftColumnX = 50;
        const rightColumnX = doc.page.width / 2 + 20;
        let currentY = doc.y;
        let leftColumnY = currentY;
        let rightColumnY = currentY;
        
        summaryPairs.forEach(([label, value], index) => {
          const isLeftColumn = index % 2 === 0;
          const x = isLeftColumn ? leftColumnX : rightColumnX;
          const y = isLeftColumn ? leftColumnY : rightColumnY;
          
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(`${label}:`, x, y);
          
          // Calculate the width of the label to position the value right after it
          const labelWidth = doc.widthOfString(`${label}:`);
          doc.font('Helvetica').fontSize(9).fillColor('#666').text(value !== undefined ? value : 0, x + labelWidth + 5, y);
          
          if (isLeftColumn) {
            leftColumnY += 15;
          } else {
            rightColumnY += 15;
          }
        });
        
        // Move to the bottom of the higher column
        doc.y = Math.max(leftColumnY, rightColumnY) + 15;
        doc.moveDown(0.3);
      }
    }
    
    // Task Details - Check both tasks array and details array
    let taskData = data.tasks || data.details || [];
    if (Array.isArray(taskData) && taskData.length > 0) {
    dataTables.push({
        title: 'Task Details',
        rows: taskData.map(task => {
          // Enhanced debug logging for each task
          console.log('Task data structure:', {
            title: task.title,
            status: task.status,
            priority: task.priority,
            assignee: task.assignee,
            dueDate: task.dueDate,
            createdDate: task.createdDate,
            relatedTicket: task.relatedTicket,
            department: task.department,
            fullTask: task
          });
          
          return {
            Title: task.title || '',
            Status: task.status || '',
            'Due Date': task.dueDate || 'N/A',
            Assignee: task.assignee || 'Unassigned',
            'Related Ticket': task.relatedTicket || 'N/A',
            'Created Date': task.createdDate || '',
            Department: task.department || 'N/A'
          };
        })
      });
    }
    
    // Removed duplicate task details table to prevent duplicate tables
    
    // Also check for activity data (like in department reports)
    if (data.activity && Array.isArray(data.activity)) {
    dataTables.push({
        title: 'Task Activity',
        rows: data.activity.filter(item => item.type === 'Task').map(task => ({
          Type: task.type || 'Task',
          Title: task.title || '',
          Status: task.status || '',
          Priority: task.priority || '',
          Assignee: task.assignee || 'Unassigned',
          'Created Date': task.createdDate || '',
          'Due/Closed Date': task.dueClosedDate || 'N/A'
        }))
      });
    }
  } else if (Array.isArray(data.tasks) && data.tasks.length > 0) {
    dataTables.push({
      title: 'Tasks',
      rows: data.tasks.map(task => {
        const assignee = task.taskAssignee ? 
          `${task.taskAssignee.firstname} ${task.taskAssignee.lastname}` : 
          (task.assignedTo || task.assignedToId || 'Unassigned');
          
        const dueDate = task.dueDate ? (() => {
          try {
            const date = new Date(task.dueDate);
            return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
          } catch (e) {
            console.error('Date formatting error:', e);
            return '';
          }
        })() : 'N/A';
        
        const createdDate = task.createdAt ? (() => {
          try {
            const date = new Date(task.createdAt);
            return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
          } catch (e) {
            console.error('Date formatting error:', e);
            return '';
          }
        })() : '';
        
        const relatedTicket = task.relatedTicket || 
                             task.ticketId || 
                             task.ticket?.id || 
                             'N/A';
        
        const department = task.department?.name || 
                         task.Department?.name || 
                         task.departmentName || 
                         'N/A';
        
        return {
        Title: task.title,
        Status: task.status,
          'Due Date': dueDate,
          Assignee: assignee,
          'Related Ticket': relatedTicket,
          'Created Date': createdDate,
          Department: department
        };
      })
    });
  } else if (Array.isArray(data.tickets) && data.tickets.length > 0) {
    dataTables.push({
      title: 'Tickets',
      rows: data.tickets.map(ticket => {
        const assignee = ticket.ticketAssignee ? 
          `${ticket.ticketAssignee.firstname} ${ticket.ticketAssignee.lastname}` : 
          (ticket.assignedTo || 'Unassigned');
          
        const creator = ticket.ticketCreator ? 
          `${ticket.ticketCreator.firstname} ${ticket.ticketCreator.lastname}` : 
          (ticket.createdBy || 'Unknown');
          
        const createdDate = ticket.createdAt ? (() => {
          try {
            const date = new Date(ticket.createdAt);
            return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
          } catch (e) {
            console.error('Date formatting error:', e);
            return '';
          }
        })() : '';
        
        const closedDate = ticket.closedAt || ticket.updatedAt ? (() => {
          try {
            const date = new Date(ticket.closedAt || ticket.updatedAt);
            return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
          } catch (e) {
            console.error('Date formatting error:', e);
            return '';
          }
        })() : '';
        
        const department = ticket.department?.name || 
                         ticket.Department?.name || 
                         ticket.departmentName || 
                         'N/A';
        
        return {
        Title: ticket.title,
        Status: ticket.status,
          Priority: ticket.priority || 'Medium',
          Assignee: assignee,
          Creator: creator,
          'Created Date': createdDate,
          'Closed Date': closedDate,
          Department: department
        };
      })
    });
  }
  
  // Users table - Match ReportViewDialog structure
  if (data.users && Array.isArray(data.users)) {
    dataTables.push({
      title: 'Users',
      rows: data.users.map(user => ({
        Name: `${user.firstname} ${user.lastname}`,
        Email: user.email,
        Role: user.role,
        Department: user.department?.name || 'N/A',
        Status: user.isActive ? 'Active' : 'Inactive'
      }))
    });
  } else if (result.report.type === 'custom') {
    // Custom Report - display custom metrics and summary
    if (data.customMetrics) {
      const customMetricsPairs = [];
      Object.entries(data.customMetrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          customMetricsPairs.push([key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase()), value]);
        }
      });
      
      if (customMetricsPairs.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text('Custom Metrics', 50, doc.y);
        doc.moveDown(0.2);
        
        // Display summary in a clean two-column format
        const leftColumnX = 50;
        const rightColumnX = doc.page.width / 2 + 20;
        let currentY = doc.y;
        let leftColumnY = currentY;
        let rightColumnY = currentY;
        
        customMetricsPairs.forEach(([label, value], index) => {
          const isLeftColumn = index % 2 === 0;
          const x = isLeftColumn ? leftColumnX : rightColumnX;
          const y = isLeftColumn ? leftColumnY : rightColumnY;
          
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(`${label}:`, x, y);
          
          // Calculate the width of the label to position the value right after it
          const labelWidth = doc.widthOfString(`${label}:`);
          doc.font('Helvetica').fontSize(9).fillColor('#666').text(value !== undefined ? value : 0, x + labelWidth + 5, y);
          
          if (isLeftColumn) {
            leftColumnY += 15;
          } else {
            rightColumnY += 15;
          }
        });
        
        // Move to the bottom of the higher column
        doc.y = Math.max(leftColumnY, rightColumnY) + 15;
        doc.moveDown(0.3);
      }
      
      // Also add as table for detailed view
      dataTables.push({
        title: 'Custom Metrics Details',
        rows: Object.entries(data.customMetrics).map(([key, value]) => ({
          Metric: key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase()),
          Value: typeof value === 'number' ? value.toLocaleString() : String(value)
      }))
    });
    }
    
    // Custom Report Summary
    if (data.summary) {
      const summaryPairs = [];
      Object.entries(data.summary).forEach(([key, value]) => {
        if (typeof value === 'number') {
          summaryPairs.push([key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase()), value]);
        }
      });
      
      if (summaryPairs.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text('Report Summary', 50, doc.y);
        doc.moveDown(0.2);
        
        // Display summary in a clean two-column format
        const leftColumnX = 50;
        const rightColumnX = doc.page.width / 2 + 20;
        let currentY = doc.y;
        let leftColumnY = currentY;
        let rightColumnY = currentY;
        
        summaryPairs.forEach(([label, value], index) => {
          const isLeftColumn = index % 2 === 0;
          const x = isLeftColumn ? leftColumnX : rightColumnX;
          const y = isLeftColumn ? leftColumnY : rightColumnY;
          
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(`${label}:`, x, y);
          
          // Calculate the width of the label to position the value right after it
          const labelWidth = doc.widthOfString(`${label}:`);
          doc.font('Helvetica').fontSize(9).fillColor('#666').text(value !== undefined ? value : 0, x + labelWidth + 5, y);
          
          if (isLeftColumn) {
            leftColumnY += 15;
          } else {
            rightColumnY += 15;
          }
        });
        
        // Move to the bottom of the higher column
        doc.y = Math.max(leftColumnY, rightColumnY) + 15;
        doc.moveDown(0.3);
      }
    }
    
    // Custom Report Data Tables: skip ticket and task tables intentionally
  } else if (Array.isArray(data) && data.length > 0) {
    dataTables.push({
      title: 'Data',
      rows: data
    });
  }
  console.log('Generated data tables:', dataTables.length, 'tables');
  dataTables.forEach((table, index) => {
    console.log(`Table ${index + 1}: ${table.title} with ${table.rows.length} rows`);
  });
  
  if (dataTables.length === 0) {
    const msg = 'No data available for this report.';
    const msgWidth = doc.widthOfString(msg);
    const msgX = (doc.page.width - msgWidth) / 2;
    const msgY = doc.y + 6;
    doc.save().rect(msgX - 8, msgY - 4, msgWidth + 16, 18).fill('#F4F7F6').restore();
    doc.font('Helvetica').fontSize(10).fillColor('#888').text(msg, msgX, msgY, { align: 'center', width: msgWidth + 16 });
    doc.moveDown(1.2);
  } else {
    dataTables.forEach(table => {
      doc.moveDown(0.2);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text(table.title, 50, doc.y);
    doc.moveDown(0.1);
      if (table.rows.length > 0) {
        const headers = Object.keys(table.rows[0]);
        const numColumns = headers.length;
        
        // Calculate dynamic column widths based on content with better sizing
        const columnWidths = headers.map(header => {
          const maxContentLength = Math.max(
            header.length,
            ...table.rows.map(row => String(row[header] || '').length)
          );
          // More conservative width calculation to prevent overlapping
          const baseWidth = Math.max(80, maxContentLength * 4); // Reduced multiplier to prevent overflow
          return Math.min(120, baseWidth); // Reduced max width to prevent overlapping
        });
        
        const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        const maxPageWidth = doc.page.width - 100; // Leave 50px margin on each side
        
        // If table is too wide, scale down column widths proportionally
        if (totalWidth > maxPageWidth) {
          const scaleFactor = maxPageWidth / totalWidth;
          columnWidths.forEach((width, index) => {
            columnWidths[index] = Math.max(60, width * scaleFactor); // Ensure minimum width
          });
        }
        
        const finalTotalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        const tableX = doc.page.width / 2 - finalTotalWidth / 2;
        let y = doc.y;
        
        // Draw enhanced header
        let currentX = tableX;
        headers.forEach((h, i) => {
          // Enhanced header styling
          doc.save().rect(currentX, y, columnWidths[i], 12).fill('#2D6A4F').restore();
          doc.save().lineWidth(1).strokeColor('#1B4D3E').rect(currentX, y, columnWidths[i], 12).stroke().restore();
          doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF').text(h, currentX + 4, y + 2, { 
            width: columnWidths[i] - 8, 
            align: 'center',
            ellipsis: false // Prevent header text truncation
          });
          currentX += columnWidths[i];
        });
        y += 12;
        
        // Draw enhanced data rows
        table.rows.forEach((row, rowIdx) => {
          let currentX = tableX;
          headers.forEach((h, i) => {
            // Enhanced alternating row colors
            if (rowIdx % 2 === 1) {
              doc.save().rect(currentX, y, columnWidths[i], 10).fill('#F8FCFA').restore();
            } else {
              doc.save().rect(currentX, y, columnWidths[i], 10).fill('#FFFFFF').restore();
            }
            
            // Add subtle border
            doc.save().lineWidth(0.5).strokeColor('#E6F4EA').rect(currentX, y, columnWidths[i], 10).stroke().restore();
            
            const cellValue = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
            // Enhanced text rendering with better spacing and no truncation
            doc.font('Helvetica').fontSize(6).fillColor('#333').text(cellValue, currentX + 4, y + 1, { 
              width: columnWidths[i] - 8, 
              align: 'left',
              ellipsis: false // Prevent text truncation
            });
            currentX += columnWidths[i];
          });
          y += 10;
        });
        doc.moveDown(0.2);
      } else {
        doc.font('Helvetica').fontSize(10).fillColor('#888').text('No data available.', { align: 'center' });
        doc.moveDown(0.5);
      }
    });
  }
  
  // --- Signatory Section ---
  doc.moveDown(0.8);
  
  // Check if we need a new page for signatory section
  if (doc.y > doc.page.height - 120) {
    doc.addPage();
  }
  
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B4D3E').text('Authorization', 50, doc.y);
  doc.moveDown(0.3);
  
  // Signatory lines
  const signatureY = doc.y;
  
  // Prepared by line
  doc.font('Helvetica').fontSize(9).fillColor('#333').text('Prepared by:', 50, signatureY);
  doc.moveDown(1);
  doc.save()
    .moveTo(50, doc.y)
    .lineTo(200, doc.y)
    .lineWidth(0.5)
    .stroke('#666')
    .restore();
  doc.moveDown(0.1);
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('Signature', 50, doc.y);
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('Date: _______________', 50, doc.y);
  
  // Reviewed by line
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9).fillColor('#333').text('Reviewed by:', 300, signatureY);
  doc.y = signatureY + 15;
  doc.save()
    .moveTo(300, doc.y)
    .lineTo(450, doc.y)
    .lineWidth(0.5)
    .stroke('#666')
    .restore();
  doc.moveDown(0.1);
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('Signature', 300, doc.y);
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('Date: _______________', 300, doc.y);
  
  // Approved by line
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9).fillColor('#333').text('Approved by:', 50, doc.y);
  doc.moveDown(1);
  doc.save()
    .moveTo(50, doc.y)
    .lineTo(200, doc.y)
    .lineWidth(0.5)
    .stroke('#666')
    .restore();
  doc.moveDown(0.1);
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('Signature', 50, doc.y);
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('Date: _______________', 50, doc.y);
  
  // --- Professional Footer ---
  doc.moveDown(0.8);
  
  // Footer separator line
  const footerY = doc.y + 20;
  doc.save()
    .moveTo(50, footerY)
    .lineTo(doc.page.width - 50, footerY)
    .lineWidth(0.5)
    .stroke('#E6F4EA')
    .restore();
  
  // Footer content
  doc.font('Helvetica').fontSize(7).fillColor('#888')
     .text('Municipal Information Technology Office - Ticketing and Task Management System', 50, footerY + 8, { align: 'center', width: doc.page.width - 100 });
  
  doc.font('Helvetica').fontSize(7).fillColor('#888')
     .text('This report is confidential and intended for authorized personnel only.', 50, footerY + 18, { align: 'center', width: doc.page.width - 100 });
  
  // Page number - positioned below the confidentiality text and centered
  doc.font('Helvetica').fontSize(7).fillColor('#888')
     .text(`Page 1 of 1`, 50, footerY + 28, { align: 'center', width: doc.page.width - 100 });
    
  doc.end();
  } catch (error) {
    console.error('Error in exportReportPDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

module.exports = {
  exportReportPDF
}; 