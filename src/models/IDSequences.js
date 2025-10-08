module.exports = (sequelize, DataTypes) => {
  const IDSequences = sequelize.define('IDSequences', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    prefix: {
      type: DataTypes.STRING(3),
      allowNull: false,
      validate: {
        len: [3, 3],
        isUppercase: true
      }
    },
    date: {
      type: DataTypes.STRING(8),
      allowNull: false,
      validate: {
        len: [8, 8],
        is: /^\d{8}$/
      }
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 99999
      }
    }
  }, {
    tableName: 'id_sequences',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['prefix', 'date']
      }
    ]
  });

  return IDSequences;
}; 