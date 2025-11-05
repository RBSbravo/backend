const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ticketing_system',
  multipleStatements: true, // Allow multiple SQL statements
  charset: 'utf8mb4'
};

async function runCompleteMigration() {
  let connection;
  
  try {
    console.log(' Starting complete database schema migration...');
    console.log(` Connecting to database: ${dbConfig.database}`);
    
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'complete_schema_migration.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log(' Complete schema migration file loaded successfully');
    console.log(' Executing complete schema migration...');
    console.log('  This will DROP and RECREATE all tables!');
    
    // Execute migration
    const startTime = Date.now();
    await connection.execute(migrationSQL);
    const endTime = Date.now();
    
    console.log(` Complete schema migration completed successfully in ${endTime - startTime}ms`);
    console.log('\n Complete Schema Summary:');
    console.log('   • 15 tables created (including analytics tables)');
    console.log('   • 8 utility functions for ID generation and validation');
    console.log('   • 10 triggers for automatic ID generation and validation');
    console.log('   • 35+ indexes for optimal performance');
    console.log('   • 4 views for common queries');
    console.log('   • Sample data for testing');
    console.log('   • Proper foreign key constraints with CASCADE');
    console.log('   • Role-based validation triggers');
    console.log('   • Comprehensive ID generation system');
    
    console.log('\n🎉 Database is now ready for the Ticketing and Task Management System!');
    
  } catch (error) {
    console.error(' Complete schema migration failed:', error.message);
    console.error(' Error details:', error);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n Database access denied. Please check your credentials.');
    }
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n Database does not exist. Please create it first:');
      console.log(`   CREATE DATABASE ${dbConfig.database};`);
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runCompleteMigration().catch(console.error);
}

module.exports = { runCompleteMigration }; 