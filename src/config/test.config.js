// Test environment configuration
const testConfig = {
  database: {
    database: 'ticketing_system_test',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '3306',
    dialect: 'mysql',
    logging: false,
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
  },
  server: {
    port: 3001
  },
  jwt: {
    secret: 'test-secret-key',
    expiresIn: '1h'
  },
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key'
  },
  test: {
    timeout: 30000,
    retries: 3
  }
};

// Set environment variables
Object.entries(testConfig.env).forEach(([key, value]) => {
  process.env[key] = value;
});

module.exports = testConfig; 