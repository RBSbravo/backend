const { Model } = require('sequelize');
const IDGenerator = require('../utils/idGenerator');

module.exports = (sequelize, DataTypes) => {
  class UserSession extends Model {}

  UserSession.init({
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: true,
      validate: {
        is: /^SES-[0-9]{8}-[0-9]{5}$/ // SES-YYYYMMDD-XXXXX format
      }
    },
    userId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    token: {
      type: DataTypes.STRING(512),
      allowNull: false
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    userAgent: {
      type: DataTypes.STRING(256),
      allowNull: true,
      field: 'user_agent'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    sequelize,
    modelName: 'UserSession',
    tableName: 'user_sessions',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (userSession) => {
        if (!userSession.id) {
          // Get IDSequences model from sequelize
          const IDSequences = sequelize.models.IDSequences;
          const idGenerator = new IDGenerator(sequelize, IDSequences);
          userSession.id = await idGenerator.generateID('SES');
        }
      }
    }
  });

  return UserSession;
}; 