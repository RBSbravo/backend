# Database Migrations

This directory contains database migration files for the Ticketing and Task Management System.

## Migration Files

### `complete_schema_migration.sql`

**Date:** 2024-12-19  
**Purpose:** Complete database setup from scratch. Creates the entire database schema including all tables, functions, triggers, indexes, and views.

#### What This Migration Does:

- **Complete Database Setup**: Creates all 15 tables from scratch
- **ID Generation System**: Implements the standardized ID format (XXX-YYYYMMDD-XXXXX)
- **Utility Functions**: 8 functions for validation and ID manipulation
- **Triggers**: 10 triggers for automatic ID generation and validation
- **Performance Optimization**: 35+ indexes for optimal query performance
- **Views**: 4 views for common queries (department structure, user details, ticket/task summaries)
- **Sample Data**: Basic sample data for testing
- **Data Integrity**: Proper foreign key constraints with CASCADE deletion

#### When to Use:

- **Fresh Installation**: Setting up a new database from scratch
- **Development Environment**: Creating a clean development database
- **Testing**: Setting up test databases with known state
- **Reference**: Understanding the complete database structure

### `update_schema_cascade_constraints.sql`

**Date:** 2024-12-19  
**Purpose:** Updates an existing database schema to include proper CASCADE constraints, new ticket fields, and enhanced comment support.

#### Changes Applied:

1. **New Ticket Fields:**

   - Added `resolution` field (TEXT) for storing ticket resolution details
   - Added `tags` field (JSON) for ticket categorization

2. **Enhanced Comments Support:**

   - Made `task_id` nullable in comments table
   - Added `ticket_id` field to support comments on tickets
   - Added foreign key constraint with CASCADE delete

3. **CASCADE Constraints:**

   - Updated notifications table foreign keys to CASCADE
   - Updated file_attachments table foreign keys to CASCADE
   - Ensures proper cleanup when parent records are deleted

4. **Performance Improvements:**

   - Added missing indexes for analytics tables
   - Added index for ticket_id in comments table

5. **View Updates:**

   - Updated department_structure view
   - Updated user_department_details view

6. **Data Integrity:**
   - Added validation queries to check for orphaned records
   - Ensured sequence management is up to date

#### When to Use:

- **Existing Database**: Updating a database that already has the base schema
- **Production Updates**: Applying changes to a live database
- **Incremental Updates**: Adding new features to existing system

### `remove_analytics_tables.sql`

**Purpose:** Remove pre-calculated analytics tables

**Reason:** System now uses on-the-fly calculations for real-time accuracy

**Tables Removed:**

- `task_metrics`
- `user_performance`
- `department_analytics`

**Impact:** Analytics are now calculated in real-time from source data

### `remove_analytics_tables_clean.sql`

**Purpose:** Clean version of analytics table removal

**Usage:** Run directly in database for safe table removal

**Features:** No error-prone index removal attempts

## Analytics System Changes

### Before (Pre-calculated)

- Analytics data stored in separate tables
- Scheduled jobs updated metrics periodically
- Faster queries but potentially outdated data
- More complex architecture

### After (On-the-fly)

- Analytics calculated in real-time from source data
- Always up-to-date information
- Simplified architecture
- Better for real-time dashboards

## Running Migrations

### Option 1: Complete Schema Migration (Fresh Start)

```bash
# Navigate to the backend directory
cd backend

# Install dependencies if not already installed
npm install

# Set environment variables (optional)
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=ticketing_system

# Run the complete schema migration
node migrations/run_complete_migration.js
```

### Option 2: Update Existing Schema

```bash
# Navigate to the backend directory
cd backend

# Run the update migration
node migrations/run_migration.js
```

### Option 3: Using MySQL Command Line

```bash
# For complete schema (fresh start)
mysql -u root -p ticketing_system < migrations/complete_schema_migration.sql

# For updating existing schema
mysql -u root -p ticketing_system < migrations/update_schema_cascade_constraints.sql

# For removing analytics tables (if they exist)
mysql -u root -p ticketing_system < migrations/remove_analytics_tables_clean.sql
```

### Option 4: Using a Database Management Tool

1. Open your preferred database management tool (phpMyAdmin, MySQL Workbench, etc.)
2. Connect to your database
3. Open the desired migration file
4. Execute the SQL statements

## Prerequisites

- MySQL 5.7+ or MariaDB 10.2+
- Proper database permissions (CREATE, ALTER, DROP, INDEX, TRIGGER, FUNCTION)
- For complete migration: Database should exist (or create it first)
- For update migration: Existing database with base schema

## Database Creation

If you need to create the database first:

```sql
CREATE DATABASE ticketing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Verification

After running the migration, you can verify the changes:

```sql
-- Check all tables
SHOW TABLES;

-- Check all functions
SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE();

-- Check all triggers
SELECT TRIGGER_NAME FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE();

-- Check all views
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = DATABASE();

-- Verify foreign key constraints
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    DELETE_RULE
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('comments', 'notifications', 'file_attachments');
```

## Migration Safety

### Complete Schema Migration:

- **⚠️ WARNING**: This will DROP and RECREATE all tables
- **Data Loss**: All existing data will be lost
- **Use Case**: Fresh installations and development environments only

### Update Migration:

- **Safe**: Preserves existing data
- **Transactional**: Runs in a transaction for safety
- **Idempotent**: Can be run multiple times safely
- **Validation**: Includes data integrity checks

## Troubleshooting

### Common Issues:

1. **"Access denied" error:**

   - Check database credentials
   - Ensure user has proper permissions

2. **"Database doesn't exist" error:**

   - Create the database first: `CREATE DATABASE ticketing_system;`

3. **"Column already exists" error (update migration):**

   - This is normal if the migration was partially applied before
   - The migration handles this gracefully

4. **"Cannot drop foreign key" error (update migration):**

   - Some constraints may already be updated
   - The migration handles this automatically

5. **"Function already exists" error (complete migration):**
   - This is normal if functions were created before
   - The migration uses DROP IF EXISTS to handle this

### Getting Help:

If you encounter issues:

1. Check the error messages in the console output
2. Verify your database connection settings
3. Ensure you have the required permissions
4. Check the migration file for any specific error handling

## Next Steps

After running the migration:

### For Complete Migration:

1. Start your backend application
2. Test all functionality (tickets, tasks, comments, file uploads)
3. Verify that ID generation works correctly
4. Check that all views return expected data

### For Update Migration:

1. Restart your backend application
2. Test ticket creation, editing, and deletion
3. Verify that file uploads and comments work properly
4. Check that cascade deletion works as expected

## Migration Files Summary

| File                                    | Purpose                 | When to Use         | Data Safety       |
| --------------------------------------- | ----------------------- | ------------------- | ----------------- |
| `complete_schema_migration.sql`         | Complete database setup | Fresh installations | ⚠️ Drops all data |
| `update_schema_cascade_constraints.sql` | Update existing schema  | Production updates  | ✅ Preserves data |
| `run_complete_migration.js`             | Run complete migration  | Fresh installations | ⚠️ Drops all data |
| `run_migration.js`                      | Run update migration    | Production updates  | ✅ Preserves data |

## Backend Changes

The following backend files were updated to support on-the-fly analytics:

1. **`src/services/analyticsService.js`**

   - Optimized `getDepartmentMetrics()` method
   - Optimized `getUserPerformanceMetrics()` method
   - Optimized `getDepartmentAnalytics()` method
   - Removed `updateDailyMetrics()` method

2. **`src/models/analytics.js`**

   - Removed `TaskMetrics`, `UserPerformance`, `DepartmentAnalytics` models
   - Kept `TaskTrends`, `UserActivityLog`, `CustomReport` models

3. **`src/models/index.js`**

   - Removed analytics model imports and associations
   - Updated sync function

4. **`src/tests/analytics.test.js`**
   - Removed references to dropped models
   - Updated test setup

## Benefits of On-the-Fly Analytics

1. **Real-time Accuracy**: All metrics reflect current data
2. **Simplified Architecture**: No need to maintain separate analytics tables
3. **Consistency**: All metrics use the same calculation logic
4. **Flexibility**: Easy to add new metrics or change calculations
5. **Reduced Storage**: No duplicate data storage

## Performance Considerations

- **Small-Medium Applications**: On-the-fly calculations are fast enough
- **Large Applications**: Consider adding database indexes for better performance
- **Caching**: Optional short-term caching (5-15 minutes) can be implemented
