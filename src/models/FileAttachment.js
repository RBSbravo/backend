const IDGenerator = require('../utils/idGenerator');

module.exports = (sequelize, DataTypes) => {
  const FileAttachment = sequelize.define('FileAttachment', {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: true,
      validate: {
        is: /^FIL-[0-9]{8}-[0-9]{5}$/ // FIL-YYYYMMDD-XXXXX format
      }
    },
    ticket_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'tickets',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },
    task_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'tasks',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },
    comment_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'comments',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },
    file_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    file_path: {
      type: DataTypes.STRING,
      allowNull: false
    },
    file_type: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        max: 10 * 1024 * 1024 // 10MB
      }
    },
    uploaded_by: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'NO ACTION',
      onUpdate: 'CASCADE'
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'file_attachments',
    underscored: true,
    hooks: {
      beforeCreate: async (fileAttachment) => {
        if (!fileAttachment.id) {
          // Get IDSequences model from sequelize
          const IDSequences = sequelize.models.IDSequences;
          const idGenerator = new IDGenerator(sequelize, IDSequences);
          fileAttachment.id = await idGenerator.generateID('FIL');
        }
      }
    }
  });

  FileAttachment.associate = (models) => {
    FileAttachment.belongsTo(models.Ticket, { foreignKey: 'ticket_id' });
    FileAttachment.belongsTo(models.Task, { foreignKey: 'task_id' });
    FileAttachment.belongsTo(models.Comment, { foreignKey: 'comment_id' });
    FileAttachment.belongsTo(models.User, { foreignKey: 'uploaded_by', as: 'uploader' });
  };

  return FileAttachment;
}; 