#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Tests the connection to PlanetScale database
 */

const mysql = require('mysql2/promise');

// Load environment variables
require('dotenv').config({ path: '.env.production' });

async function testConnection() {
  let connection;
  
  try {
    console.log('🔍 Testing Railway MySQL database connection...');
    
    // Create connection (Railway MySQL)
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || process.env.DB_HOST,
      user: process.env.MYSQL_USER || process.env.DB_USER,
      password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
      database: process.env.MYSQL_DATABASE || process.env.DB_NAME,
      port: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
      ssl: process.env.MYSQL_HOST ? {
        rejectUnauthorized: false
      } : undefined
    });

    console.log('✅ Successfully connected to Railway MySQL!');

    // Test basic query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Database query test passed');

    // Check if tables exist
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [process.env.DB_NAME]);

    console.log(`📊 Found ${tables.length} tables in database:`);
    tables.forEach(table => {
      console.log(`   - ${table.TABLE_NAME}`);
    });

    // Test ID generation function
    try {
      const [idTest] = await connection.execute('SELECT generate_id("USR") as test_id');
      console.log(`✅ ID generation test passed: ${idTest[0].test_id}`);
    } catch (error) {
      console.log('⚠️  ID generation function not found (run migration first)');
    }

    console.log('🎉 Database connection test completed successfully!');

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the test
testConnection();
