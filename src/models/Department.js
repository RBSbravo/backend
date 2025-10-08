const IDGenerator = require('../utils/idGenerator');

module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define('Department', {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: true,
      validate: {
        is: /^DEP-[0-9]{8}-[0-9]{5}$/ // DEP-YYYYMMDD-XXXXX format
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [2, 100]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    headId: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'departments',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (department) => {
        if (!department.id) {
          // Get IDSequences model from sequelize
          const IDSequences = sequelize.models.IDSequences;
          const idGenerator = new IDGenerator(sequelize, IDSequences);
          department.id = await idGenerator.generateID('DEP');
        }
      }
    }
  });

  return Department;
}; 