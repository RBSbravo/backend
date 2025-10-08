const { Sequelize } = require('sequelize');
require('dotenv').config();
const testConfig = require('./test.config');
const prodConfig = require('./prod.config');

const getSequelize = () => {
  if (process.env.NODE_ENV === 'test') {
    return new Sequelize(
      testConfig.database.database,
      testConfig.database.username,
      testConfig.database.password,
      {
        host: testConfig.database.host,
        dialect: testConfig.database.dialect,
        logging: testConfig.database.logging,
        pool: testConfig.database.pool,
        define: testConfig.database.define
      }
    );
  }

  if (process.env.NODE_ENV === 'production') {
    return new Sequelize(
      prodConfig.database.database,
      prodConfig.database.username,
      prodConfig.database.password,
      {
        host: prodConfig.database.host,
        dialect: prodConfig.database.dialect,
        logging: prodConfig.database.logging,
        pool: prodConfig.database.pool,
        define: prodConfig.database.define
      }
    );
  }

  // Railway MySQL configuration
  const dbConfig = {
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'ticketing_system',
    username: process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || 'root',
    host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
    port: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true
    }
  };

  // Add SSL configuration for Railway
  if (process.env.NODE_ENV === 'production' && process.env.MYSQL_HOST) {
    dbConfig.dialectOptions = {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    };
  }

  return new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
};

const sequelize = getSequelize();

// Test the connection
sequelize.authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1); // Exit if database connection fails
  });

module.exports = sequelize; 