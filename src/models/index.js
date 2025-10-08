const { Sequelize } = require('sequelize');
const sequelize = require('../config/database.js');

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.User = require('./User')(sequelize, Sequelize);
db.Department = require('./Department')(sequelize, Sequelize);
db.Task = require('./Task')(sequelize, Sequelize);
db.Ticket = require('./Ticket')(sequelize, Sequelize);
db.Comment = require('./Comment')(sequelize, Sequelize);
db.Notification = require('./Notification')(sequelize, Sequelize);
db.FileAttachment = require('./FileAttachment')(sequelize, Sequelize);
db.UserSession = require('./UserSession')(sequelize, Sequelize);
db.IDSequences = require('./IDSequences')(sequelize, Sequelize);

// Import analytics models using the same sequelize instance
const analyticsModels = require('./analytics')(sequelize, Sequelize);
db.CustomReport = analyticsModels.CustomReport;

// Call associate for all models if defined
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Define associations
db.Department.hasMany(db.User, { foreignKey: 'department_id' });
db.User.belongsTo(db.Department, { foreignKey: 'department_id' });

db.Department.hasMany(db.Task, { foreignKey: 'department_id' });
db.Task.belongsTo(db.Department, { foreignKey: 'department_id' });

db.User.hasMany(db.Task, { foreignKey: 'created_by', as: 'createdTasks' });
db.Task.belongsTo(db.User, { foreignKey: 'created_by', as: 'taskCreator' });

db.User.hasMany(db.Task, { foreignKey: 'assigned_to_id', as: 'assignedTasks' });
db.Task.belongsTo(db.User, { foreignKey: 'assigned_to_id', as: 'taskAssignee' });

db.Department.belongsTo(db.User, { as: 'head', foreignKey: 'headId' });
db.User.hasMany(db.Department, { foreignKey: 'headId', as: 'headedDepartments' });

// Ticket associations
db.Department.hasMany(db.Ticket, { foreignKey: 'department_id' });
db.Ticket.belongsTo(db.Department, { foreignKey: 'department_id' });

db.User.hasMany(db.Ticket, { foreignKey: 'created_by', as: 'createdTickets' });
db.Ticket.belongsTo(db.User, { foreignKey: 'created_by', as: 'ticketCreator' });

db.User.hasMany(db.Ticket, { foreignKey: 'assigned_to', as: 'assignedTickets' });
db.Ticket.belongsTo(db.User, { foreignKey: 'assigned_to', as: 'ticketAssignee' });

// Forwarding associations
db.User.hasMany(db.Ticket, { foreignKey: 'forwarded_from_id', as: 'forwardedFromTickets' });
db.Ticket.belongsTo(db.User, { foreignKey: 'forwarded_from_id', as: 'forwardedFrom' });

db.User.hasMany(db.Ticket, { foreignKey: 'forwarded_to_id', as: 'forwardedToTickets' });
db.Ticket.belongsTo(db.User, { foreignKey: 'forwarded_to_id', as: 'forwardedTo' });

db.User.hasMany(db.Ticket, { foreignKey: 'original_creator_id', as: 'originalCreatedTickets' });
db.Ticket.belongsTo(db.User, { foreignKey: 'original_creator_id', as: 'originalCreator' });

db.User.hasMany(db.Ticket, { foreignKey: 'current_handler_id', as: 'handledTickets' });
db.Ticket.belongsTo(db.User, { foreignKey: 'current_handler_id', as: 'currentHandler' });

// Comment associations
db.User.hasMany(db.Comment, { foreignKey: 'author_id', as: 'userComments' });
db.Comment.belongsTo(db.User, { foreignKey: 'author_id', as: 'commentUser' });

db.Task.hasMany(db.Comment, { foreignKey: 'task_id', as: 'taskComments' });
db.Comment.belongsTo(db.Task, { foreignKey: 'task_id', as: 'commentTask' });

db.Ticket.hasMany(db.Comment, { foreignKey: 'ticket_id', as: 'ticketComments' });
db.Comment.belongsTo(db.Ticket, { foreignKey: 'ticket_id', as: 'commentTicket' });

// Notification associations
db.User.hasMany(db.Notification, { foreignKey: 'user_id', as: 'userNotifications' });
db.Notification.belongsTo(db.User, { foreignKey: 'user_id', as: 'notificationUser' });

// File Attachment associations
db.Ticket.hasMany(db.FileAttachment, { foreignKey: 'ticket_id' });
db.Task.hasMany(db.FileAttachment, { foreignKey: 'task_id' });
db.Comment.hasMany(db.FileAttachment, { foreignKey: 'comment_id' });
db.User.hasMany(db.FileAttachment, { foreignKey: 'uploaded_by', as: 'uploadedFiles' });

// Analytics associations
db.User.hasMany(db.CustomReport, { foreignKey: 'created_by', as: 'createdReports' });
db.CustomReport.belongsTo(db.User, { foreignKey: 'created_by', as: 'reportCreator' });

// Session associations
db.User.hasMany(db.UserSession, { foreignKey: 'user_id', as: 'sessions' });
db.UserSession.belongsTo(db.User, { foreignKey: 'user_id', as: 'sessionUser' });

// Sync models with database
const syncModels = async () => {
  try {
    // Disable foreign key checks temporarily
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    // Drop all tables in the correct order
    await sequelize.query('DROP TABLE IF EXISTS file_attachments;');
    await sequelize.query('DROP TABLE IF EXISTS user_sessions;');
    await sequelize.query('DROP TABLE IF EXISTS comments;');
    await sequelize.query('DROP TABLE IF EXISTS notifications;');
    await sequelize.query('DROP TABLE IF EXISTS custom_reports;');
    await sequelize.query('DROP TABLE IF EXISTS tasks;');
    await sequelize.query('DROP TABLE IF EXISTS tickets;');
    await sequelize.query('DROP TABLE IF EXISTS users;');
    await sequelize.query('DROP TABLE IF EXISTS departments;');
    await sequelize.query('DROP TABLE IF EXISTS id_sequences;');
    
    // Create IDSequences table first
    await db.IDSequences.sync({ force: true });
    
    // Sync all other models
    await sequelize.sync({ force: true });
    
    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    //console.log('Database models synchronized successfully');
  } catch (error) {
    console.error('Error syncing models:', error);
    throw error;
  }
};

module.exports = {
  ...db,
  sequelize,
  syncModels
}; 