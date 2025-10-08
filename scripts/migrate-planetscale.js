#!/usr/bin/env node

/**
 * Database Migration Script for PlanetScale
 * This script runs the complete database schema on PlanetScale
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.production' });

async function runMigration() {
  let connection;
  
  try {
    console.log('🚀 Starting database migration to Railway MySQL...');
    
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

    console.log('✅ Connected to Railway MySQL database');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'src', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim()) {
        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
          await connection.execute(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          // Skip errors for statements that might already exist
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
              error.code === 'ER_DUP_KEYNAME' ||
              error.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
          } else {
            console.error(`❌ Error executing statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }

    console.log('🎉 Database migration completed successfully!');
    
    // Test the connection by querying a table
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM id_sequences');
    console.log(`✅ Verification: Found ${rows[0].count} sequence records`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
runMigration();
