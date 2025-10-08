const { Model } = require('sequelize');
const IDGenerator = require('../utils/idGenerator');

module.exports = (sequelize, DataTypes) => {
  class Ticket extends Model {
    static associate(models) {
      // Associations are defined in index.js to avoid conflicts
      Ticket.hasMany(models.FileAttachment, { foreignKey: 'ticket_id', as: 'attachments' });
    }
  }

  Ticket.init({
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: true,
      validate: {
        is: /^TKT-[0-9]{8}-[0-9]{5}$/ // TKT-YYYYMMDD-XXXXX format
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
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'declined'),
      allowNull: false,
      defaultValue: 'pending'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium'
    },
    category: {
      type: DataTypes.ENUM('bug', 'feature', 'support', 'other'),
      allowNull: false,
      defaultValue: 'other'
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    assigned_to: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    created_by: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    department_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'departments',
        key: 'id'
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Forwarding fields
    forwarded_from_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    forwarded_to_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    forward_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    forward_chain_id: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    is_forwarded: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    original_creator_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    current_handler_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    desired_action: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Ticket',
    tableName: 'tickets',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (ticket) => {
        if (!ticket.id) {
          // Get IDSequences model from sequelize
          const IDSequences = sequelize.models.IDSequences;
          const idGenerator = new IDGenerator(sequelize, IDSequences);
          ticket.id = await idGenerator.generateID('TKT');
        }
      }
    }
  });

  return Ticket;
}; 