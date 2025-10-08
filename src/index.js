require('dotenv').config();
const { app, server } = require('./app');
const sequelize = require('../config/database.js');

const PORT = process.env.PORT || 3000;

// Database connection and server start
const startServer = async () => {
  try {
    await sequelize.authenticate();
   // console.log('Database connection established successfully.');
    
    // Sync all models
    await sequelize.sync();
    //console.log('Database models synchronized.');

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer(); 