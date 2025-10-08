const { Model } = require('sequelize');
const IDGenerator = require('../utils/idGenerator');

module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    static associate(models) {
      Task.belongsTo(models.User, {
        foreignKey: 'assigned_to_id',
        as: 'assignedUser'
      });
      Task.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator'
      });
      Task.belongsTo(models.Department, {
        foreignKey: 'department_id'
      });
      Task.hasMany(models.Comment, {
        foreignKey: 'task_id'
      });
      Task.belongsTo(models.Ticket, { foreignKey: 'related_ticket_id', as: 'relatedTicket' });
    }
  }

  Task.init({
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: true,
      validate: {
        is: /^TSK-[0-9]{8}-[0-9]{5}$/ // TSK-YYYYMMDD-XXXXX format
      }
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [3, 100]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 1000]
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium'
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'due_date'
    },
    assignedToId: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'assigned_to_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    createdBy: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    departmentId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'department_id',
      references: {
        model: 'departments',
        key: 'id'
      }
    },
    relatedTicketId: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'related_ticket_id',
      references: {
        model: 'tickets',
        key: 'id'
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    sequelize,
    modelName: 'Task',
    tableName: 'tasks',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (task) => {
        if (!task.id) {
          // Get IDSequences model from sequelize
          const IDSequences = sequelize.models.IDSequences;
          const idGenerator = new IDGenerator(sequelize, IDSequences);
          task.id = await idGenerator.generateID('TSK');
        }
      }
    }
  });

  return Task;
}; 