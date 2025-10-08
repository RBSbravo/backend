// Production environment configuration
const prodConfig = {
  database: {
    database: process.env.DB_NAME,      // Set in your production environment
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || '3306',
    dialect: 'mysql',
    logging: false, // Disable SQL logging in production
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true
    }
  },
  server: {
    port: process.env.PORT || 3000
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '12h'
  },
  env: {
    NODE_ENV: 'production'
  }
};

// Optionally set environment variables (if you want to enforce them here)
// Object.entries(prodConfig.env).forEach(([key, value]) => {
//   process.env[key] = value;
// });

module.exports = prodConfig; 