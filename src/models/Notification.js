const IDGenerator = require('../utils/idGenerator');

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: true,
      validate: {
        is: /^NOT-[0-9]{8}-[0-9]{5}$/ // NOT-YYYYMMDD-XXXXX format
      }
    },
    type: {
      type: DataTypes.STRING(32),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_read'
    },
    userId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    taskId: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'task_id',
      references: {
        model: 'tasks',
        key: 'id'
      }
    },
    ticketId: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'ticket_id',
      references: {
        model: 'tickets',
        key: 'id'
      }
    },
    relatedUserId: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'related_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (notification) => {
        if (!notification.id) {
          // Get IDSequences model from sequelize
          const IDSequences = sequelize.models.IDSequences;
          const idGenerator = new IDGenerator(sequelize, IDSequences);
          notification.id = await idGenerator.generateID('NOT');
        }
      }
    }
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'recipient'
    });
    Notification.belongsTo(models.Task, {
      foreignKey: 'task_id',
      as: 'task'
    });
    Notification.belongsTo(models.Ticket, {
      foreignKey: 'ticket_id',
      as: 'ticket'
    });
    Notification.belongsTo(models.User, {
      foreignKey: 'related_user_id',
      as: 'relatedUser'
    });
  };

  return Notification;
}; 