const IDGenerator = require('../utils/idGenerator');

module.exports = (sequelize, DataTypes) => {
  const CustomReport = sequelize.define('CustomReport', {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: true,
      validate: {
        is: /^RPT-[0-9]{8}-[0-9]{5}$/ // RPT-YYYYMMDD-XXXXX format
      }
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('task', 'ticket', 'user', 'department', 'custom'),
      allowNull: false
    },
    parameters: {
      type: DataTypes.JSON,
      allowNull: false
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
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'custom_reports',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (customReport) => {
        if (!customReport.id) {
          // Get IDSequences model from sequelize
          const IDSequences = sequelize.models.IDSequences;
          const idGenerator = new IDGenerator(sequelize, IDSequences);
          customReport.id = await idGenerator.generateID('RPT');
        }
      }
    }
  });

  return {
    CustomReport
  };
}; 