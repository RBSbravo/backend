const { Model } = require('sequelize');
const IDGenerator = require('../utils/idGenerator');

module.exports = (sequelize, DataTypes) => {
  class Comment extends Model {
    static associate(models) {
      // Associations are defined in index.js to avoid conflicts
    }
  }

  Comment.init({
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: true,
      validate: {
        is: /^CMT-[0-9]{8}-[0-9]{5}$/ // CMT-YYYYMMDD-XXXXX format
      }
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 1000]
      }
    },
    task_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'tasks',
        key: 'id'
      }
    },
    ticket_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'tickets',
        key: 'id'
      }
    },
    author_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    comment_type: {
      type: DataTypes.ENUM('comment', 'forward', 'response', 'update'),
      allowNull: false,
      defaultValue: 'comment'
    },
    forward_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'returned'),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Comment',
    tableName: 'comments',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (comment) => {
        if (!comment.id) {
          // Get IDSequences model from sequelize
          const IDSequences = sequelize.models.IDSequences;
          const idGenerator = new IDGenerator(sequelize, IDSequences);
          comment.id = await idGenerator.generateID('CMT');
        }
      }
    }
  });

  return Comment;
}; 