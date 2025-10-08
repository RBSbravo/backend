const bcrypt = require('bcryptjs');
const IDGenerator = require('../utils/idGenerator');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: true,
      validate: {
        is: /^USR-[0-9]{8}-[0-9]{5}$/ // USR-YYYYMMDD-XXXXX format
      }
    },
    firstname: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 50]
      }
    },
    lastname: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 50]
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'department_head', 'employee'),
      allowNull: false,
      defaultValue: 'employee'
    },
    departmentId: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'departments',
        key: 'id'
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastLogin: {
      type: DataTypes.DATE
    },
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resetTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (user) => {
        if (!user.id) {
          const IDSequences = sequelize.models.IDSequences;
          const idGenerator = new IDGenerator(sequelize, IDSequences);
          user.id = await idGenerator.generateID('USR');
        }
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      afterCreate: async (user, options) => {
        if (user.role === 'department_head' && user.departmentId) {
          const Department = sequelize.models.Department;
          const department = await Department.findByPk(user.departmentId);
          if (department && department.headId !== user.id) {
            department.headId = user.id;
            await department.save({ transaction: options.transaction });
          }
        }
      },
      afterUpdate: async (user, options) => {
        if (user.role === 'department_head' && user.departmentId) {
          const Department = sequelize.models.Department;
          const department = await Department.findByPk(user.departmentId);
          if (department && department.headId !== user.id) {
            department.headId = user.id;
            await department.save({ transaction: options.transaction });
          }
        }
      }
    }
  });

  User.prototype.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password);
  };

  return User;
}; 