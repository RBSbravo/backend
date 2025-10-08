# Ticketing and Task Management System - Backend

A robust Node.js backend system for managing tickets, tasks, user authentication, file uploads, comments, analytics, and real-time notifications. Built with Express.js, MySQL, and Socket.IO for comprehensive enterprise-level functionality.

## 🚀 Features

### Authentication System ✅

- **User Registration & Login**: Secure user registration and authentication
- **JWT-based Authentication**: Token-based security with automatic refresh
- **Password Reset Functionality**:
  - Forgot password flow with secure token generation
  - Email-based reset token with 1-hour expiry
  - Password strength validation (minimum 8 characters, alphanumeric)
  - Token verification endpoint
  - Secure password update with token validation
- **Role-based Access Control**: Admin, Department-Head, Employee roles with granular permissions
- **User Approval System**: New accounts require admin approval (except admin users)
- **Session Management**: Persistent sessions with automatic token refresh

### Ticket Management ✅

- **Complete CRUD Operations**: Create, read, update, and delete tickets
- **Status Tracking**: pending, in_progress, completed, declined (with workflow validation)
- **Priority Levels**: low, medium, high, urgent with visual indicators
- **Category Management**: bug, feature, support, other with filtering
- **Desired Action Field**: Selectable action for each ticket (see below for options)
- **Forwarding System**: Tickets can be forwarded with full audit trail and forwarding fields:
  - forwarded_from_id, forwarded_to_id, forward_reason, forward_chain_id, is_forwarded, original_creator_id, current_handler_id
  - **Forwarded tickets trigger notifications for all involved users (sender, receiver, creator, assignee)**
  - **Forwarded tickets and updates create structured comments/remarks in the comment system**
- **Ticket Date Maturity**: Backend supports ticket maturity calculation (in progress, aging, overdue, etc.) and exposes relevant fields for frontend display
- **File Attachments**: Upload, download, delete with metadata tracking
- **Comment System**: Add, view, delete comments with user permissions
- **Department-specific Views**: Role-based ticket filtering and access
- **Advanced Filtering**: Search by title, description, status, priority, assignee
- **Pagination Support**: Efficient data loading with configurable page sizes
- **Role-based Permissions**: Different actions available based on user role
- **Assignment Logic**: Tickets can be assigned to departments or specific users
- **Due Date Management**: Optional due dates with validation

#### Desired Action Options (for tickets)

- Approval/Signature
- Comments/Recommendation
- Re-Write/Re-Draft
- Information/Notation
- Dispatch
- File
- Mis routed
- Return to office of origin
- Photocopy file
- Study
- Staff action
- See me/ Call me

### Task Management ✅

- **Task CRUD**: Complete create, read, update, delete operations
- **Status Tracking**: pending, in_progress, completed, cancelled
- **Due Date Management**: Flexible due date assignment and validation
- **Priority Levels**: low, medium, high, urgent
- **Task Dependencies**: Support for dependent task relationships
- **Progress Tracking**: Percentage-based progress monitoring
- **Task Comments**: Add, view, delete comments with user context
- **File Attachments**: Upload, download, delete files for tasks
- **Assignment System**: Tasks can be assigned to specific users or departments

### Department Management ✅

- **Department CRUD**: Create, read, update, delete departments
- **User Assignment**: Assign users to departments with role management
- **Department-specific Views**: Filtered data access based on department
- **Department Head Oversight**: Automatic head assignment and management
- **Department Analytics**: Performance metrics and statistics
- **Automatic Head Management**: Backend automatically manages department head relationships
- **Department Head Queries**: All department queries include head user object as `head`
- **Hierarchical Structure**: Support for department hierarchies and reporting

### Real-time Features ✅

- **WebSocket Integration**: Socket.IO for real-time updates
- **Live Notifications**: Real-time notifications for all system events
- **Notification Types**:
  - Task assigned/updated/completed
  - Comment added to task/ticket
  - Ticket status changed
  - New ticket created
  - File uploaded
  - User approval status changed
  - **Forwarded Ticket Activities**: All users involved in a forwarded ticket (sender, receiver, creator, assignee) receive notifications for all activities (forward, update, response)
- **Real-time Updates**: Live status updates across all connected clients
- **Connection Management**: Automatic reconnection and session persistence

### Analytics and Reporting ✅

- **Comprehensive Statistics**: Ticket and task analytics
- **Performance Metrics**: User and department performance tracking
- **Department Analytics**: Department-specific statistics and insights
- **User Activity Tracking**: Detailed user activity logs
- **Custom Date Range Filtering**: Flexible date-based reporting
- **Priority and Status Distribution**: Visual analytics for workload distribution
- **Department Head Dashboard**:
  - Department-specific stats and metrics
  - Recent tickets and tasks
  - Team performance indicators
  - Secure filtering by department
- **Live Data**: All analytics use real database data, no mock data
- **Real-time Updates**: Analytics update in real-time as data changes

### File Management ✅

- **Secure File Upload**: Multi-part file upload with validation
- **File Download**: Secure file download with proper headers
- **File Deletion**: Safe file removal with cleanup
- **File Attachment System**: Attach files to tickets and tasks
- **File Type Validation**: Configurable allowed file types
- **Size Limits**: 10MB maximum file size with validation
- **Secure Storage**: Files stored in dedicated uploads directory
- **File Metadata Tracking**: File information stored in database
- **Duplicate Prevention**: File naming and storage optimization

### Comment System ✅

- **Add Comments**: Create comments for tasks and tickets
- **View Comments**: Retrieve comments with user information
- **Delete Comments**: Remove comments with permission validation
- **Role-based Permissions**: Different comment actions based on user role
- **User Context**: Comments include author information and timestamps
- **Real-time Updates**: Comments appear instantly via WebSocket
- **Comment Types**: comment, forward, response, update (**all types now fully supported and used for ticket forwarding, update remarks, and responses**)

### Notifications ✅

- **Real-time Notifications**: Instant notification delivery via WebSocket
- **Persistent Notifications**: Notifications stored in database
- **Read/Unread Management**: Mark notifications as read/unread
- **Bulk Operations**: Mark all notifications as read
- **Delete Notifications**: Remove notifications with confirmation
- **Notification Types**: Different notification types for different events
- **User-specific Filtering**: Notifications filtered by user and role
- **Forwarded Ticket Activities**: All users involved in a forwarded ticket (sender, receiver, creator, assignee) receive notifications for all activities (forward, update, response)

### Error Handling & Security ✅

- **Comprehensive Error Handling**: Detailed error messages and logging
- **Password Security**: bcrypt hashing with salt rounds
- **JWT Token Security**: Secure token generation and validation
- **Input Validation**: Express Validator for all inputs
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Configuration**: Secure cross-origin resource sharing
- **SQL Injection Prevention**: Parameterized queries and validation
- **XSS Protection**: Input sanitization and output encoding
- **Secure Headers**: Security headers for HTTP responses

## 🏗️ Technical Stack

- **Runtime**: Node.js (v16+)
- **Framework**: Express.js (v4.18.2) with middleware architecture
- **Database**: MySQL (v3.14.1) with Sequelize ORM (v6.37.7)
- **Authentication**: JWT (v9.0.2) with bcrypt password hashing
- **Real-time**: Socket.IO (v4.8.1) for WebSocket connections
- **Testing**: Jest (v29.5.0) with comprehensive test coverage
- **Validation**: Express Validator (v7.2.1) for input validation
- **File Handling**: Multer (v2.0.1) for multipart file uploads
- **Documentation**: PDF Generation with PDFKit (v0.17.1)
- **Reporting**: Excel Export with ExcelJS (v4.4.0) and JSON2CSV (v6.0.0-alpha.2)
- **Email**: Nodemailer (v7.0.3) for email notifications
- **Scheduling**: Node-cron (v4.1.0) for automated tasks
- **Security**: Helmet (v8.1.0) for HTTP security headers
- **Compression**: Compression middleware (v1.8.0) for response optimization
- **Logging**: Morgan (v1.10.0) for HTTP request logging
- **Environment**: dotenv (v16.5.0) for configuration management

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.js      # Database configuration
│   │   └── test.config.js   # Test environment config
│   ├── controllers/         # Route controllers
│   │   ├── analyticsController.js    # Analytics and dashboard
│   │   ├── authController.js         # Authentication
│   │   ├── commentController.js      # Comment management
│   │   ├── departmentController.js   # Department operations
│   │   ├── notificationController.js # Notification system
│   │   ├── taskController.js         # Task management
│   │   ├── ticketController.js       # Ticket management
│   │   └── userController.js         # User management
│   ├── middleware/          # Custom middleware
│   │   ├── auth.js          # Authentication middleware
│   │   ├── validation.js    # Input validation
│   │   ├── sessionValidation.js # Session management
│   │   ├── taskValidation.js     # Task-specific validation
│   │   └── commentValidation.js  # Comment validation
│   ├── models/              # Database models
│   │   ├── User.js          # User model with associations
│   │   ├── Department.js    # Department model
│   │   ├── Ticket.js        # Ticket model
│   │   ├── Task.js          # Task model
│   │   ├── Comment.js       # Comment model
│   │   ├── FileAttachment.js # File model
│   │   ├── Notification.js  # Notification model
│   │   ├── UserSession.js   # Session tracking
│   │   ├── IDSequences.js   # ID generation
│   │   └── index.js         # Model associations
│   ├── routes/              # API routes
│   │   ├── analytics.js     # Analytics endpoints
│   │   ├── authRoutes.js    # Authentication routes
│   │   ├── commentRoutes.js # Comment routes
│   │   ├── departmentRoutes.js # Department routes
│   │   ├── fileRoutes.js    # File management routes
│   │   ├── notificationRoutes.js # Notification routes
│   │   ├── taskRoutes.js    # Task routes
│   │   ├── ticketRoutes.js  # Ticket routes
│   │   └── userRoutes.js    # User routes
│   ├── services/            # Business logic
│   │   ├── analyticsService.js # Analytics calculations
│   │   ├── notificationService.js # Notification logic
│   │   └── socketService.js # WebSocket management
│   ├── scheduler/           # Background tasks
│   │   └── reportScheduler.js # Automated reporting
│   ├── tests/               # Comprehensive test suite
│   │   ├── auth.test.js     # Authentication tests
│   │   ├── ticket.test.js   # Ticket tests
│   │   ├── task.test.js     # Task tests
│   │   ├── comment.test.js  # Comment tests
│   │   ├── file.test.js     # File tests
│   │   ├── notification.test.js # Notification tests
│   │   ├── analytics.test.js # Analytics tests
│   │   └── websocket.test.js # WebSocket tests
│   ├── utils/               # Utility functions
│   │   ├── idGenerator.js   # ID generation utilities
│   │   └── exportUtils.js   # Data export utilities
│   ├── database/            # Database files
│   │   ├── schema.sql       # Database schema
│   │   └── seed.sql         # Seed data
│   ├── logs/                # Application logs
│   ├── uploads/             # File upload directory
│   ├── app.js               # Express app configuration
│   └── index.js             # Server entry point
├── .env                     # Environment variables
├── package.json             # Project dependencies
└── README.md               # Project documentation
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
  - Requires: username, email, password, role, department_id (for non-admin)
  - Admin users automatically approved, others start as 'pending'
  - Password strength validation (8+ chars, alphanumeric)
- `POST /api/auth/login` - User login
  - Requires: email, password
  - Returns: JWT token, user data, role information
  - Blocks unapproved accounts
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/forgot-password` - Request password reset
  - Requires: email
  - Generates secure reset token with 1-hour expiry
  - Returns token (dev) or sends email (production)
- `POST /api/auth/reset-password` - Reset password
  - Requires: reset token, new password
  - Validates token expiry and password strength
- `GET /api/auth/verify-reset-token/:token` - Verify reset token validity

### Tickets

- `GET /api/tickets` - List tickets (filtered by role, department, status, priority)
- `POST /api/tickets` - Create ticket (with file uploads, assignee assignment, desired_action, forwarding fields)
  - Required fields: title, description, priority, status, category, department_id, desired_action
  - Optional fields: assigned_to, due_date, tags, file attachments, forwarding fields
  - desired_action options: see above
- `GET /api/tickets/:id` - Get ticket details (with comments, files, creator, assignee, desired_action, forwarding info)
- `PUT /api/tickets/:id` - Update ticket (with validation and permission checks, desired_action, forwarding fields)
- `DELETE /api/tickets/:id` - Delete ticket (with cascade cleanup)

### Tasks

- `GET /api/tasks` - List tasks (with filtering and pagination)
- `POST /api/tasks` - Create task (with assignment and file uploads)
- `GET /api/tasks/:id` - Get task details (with comments and files)
- `PUT /api/tasks/:id` - Update task (with status validation)
- `DELETE /api/tasks/:id` - Delete task (with cleanup)

### Departments

- `GET /api/departments` - List departments (with head user information)
- `POST /api/departments` - Create department (with head assignment)
- `GET /api/departments/:id` - Get department details (with head and users)
- `PUT /api/departments/:id` - Update department (with head management)
- `DELETE /api/departments/:id` - Delete department (with user reassignment)

### Users

- `GET /api/users` - List users (role-based filtering)
- `GET /api/users/:id` - Get user by ID (with department information)
- `POST /api/users` - Create user (with role and department assignment)
- `PUT /api/users/:id` - Update user (with validation)
- `DELETE /api/users/:id` - Delete user (with cleanup)

### Notifications

- `GET /api/notifications` - Get user notifications (with pagination)
- `GET /api/notifications/unread` - Get unread notifications count
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all notifications as read
- `DELETE /api/notifications/:id` - Delete notification
- All users involved in a forwarded ticket (sender, receiver, creator, assignee) receive notifications for all activities (forward, update, response)

### Files

- `POST /api/files/ticket/:ticketId` - Upload file to ticket
- `GET /api/files/ticket/:ticketId` - List files for ticket
- `POST /api/files/task/:taskId` - Upload file to task
- `GET /api/files/task/:taskId` - List files for task
- `GET /api/files/:id/download` - Download file (with security checks)
- `DELETE /api/files/:id` - Delete file (with cleanup)

### Comments

- `POST /api/comments` - Add comment to task or ticket
- `GET /api/comments/task/:taskId` - Get comments for task
- `GET /api/comments/ticket/:ticketId` - Get comments for ticket
- `DELETE /api/comments/:id` - Delete comment (author-only)
- Comment types: comment, forward, response, update

### Analytics & Dashboard

- `GET /api/analytics/dashboard` - Get dashboard stats
  - Department-specific stats for department heads
  - Global stats for admins
  - Recent tickets/tasks
  - Team performance metrics
  - All data live from database

## 🧪 Testing

Comprehensive test coverage for all major features:

```bash
# Run all tests
npm test

# Run specific test file
npm test src/tests/auth.test.js

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Coverage Includes:

- Authentication flows (login, register, password reset)
- Ticket management (CRUD, file uploads, comments)
- Task management (CRUD, assignments, status changes)
- Department management (CRUD, head assignment)
- File operations (upload, download, delete)
- Comment system (add, view, delete)
- Notification system (create, read, delete)
- Analytics and reporting
- WebSocket real-time features
- Error handling and validation

## 🚀 Setup and Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file:

   ```
   NODE_ENV=development
   PORT=3000
   DB_HOST=localhost
   DB_USER=your_username
   DB_PASS=your_password
   DB_NAME=ticketing_system
   JWT_SECRET=your_secure_jwt_secret
   JWT_EXPIRES_IN=24h
   FILE_UPLOAD_PATH=./uploads
   MAX_FILE_SIZE=10485760
   ```

4. **Database Setup**

   ```sql
   CREATE DATABASE ticketing_system;
   ```

5. **Run Database Migrations**

   ```bash
   npm run migrate
   ```

6. **Start the server**

   ```bash
   # Development with hot reload
   npm run dev

   # Production
   npm start
   ```

## 🔧 Development

- **Hot Reload**: Use `npm run dev` for development with automatic restart
- **Code Style**: Follow established conventions and ESLint rules
- **Testing**: Write tests for all new features
- **Documentation**: Update API documentation as needed
- **Logging**: Use structured logging for debugging

## 🔒 Security Features

- **Password Security**: bcrypt hashing with 12 salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Comprehensive validation for all inputs
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Configuration**: Secure cross-origin resource sharing
- **SQL Injection Prevention**: Parameterized queries throughout
- **XSS Protection**: Input sanitization and output encoding
- **File Upload Security**: File type and size validation
- **Secure Headers**: Security headers for all HTTP responses
- **Session Management**: Secure session handling and cleanup

## 🗄️ Database Schema

### Tickets Table

- id, title, description, desired_action, status, priority, category, department_id, created_by, assigned_to, due_date, resolution, tags, forwarded_from_id, forwarded_to_id, forward_reason, forward_chain_id, is_forwarded, original_creator_id, current_handler_id, is_active, created_at, updated_at
- status ENUM: pending, in_progress, completed, declined
- priority ENUM: low, medium, high, urgent
- category ENUM: bug, feature, support, other
- desired_action: see options above
- All forwarding fields are present and used for audit trail and workflow

### Comments Table

- id, content, task_id, ticket_id, author_id, comment_type, forward_status, created_at, updated_at
- comment_type ENUM: comment, forward, response, update

## 📊 Performance Optimizations

- **Database Indexing**: Optimized indexes for common queries
- **Query Optimization**: Efficient database queries with proper joins
- **Caching**: Strategic caching for frequently accessed data
- **Pagination**: Efficient pagination for large datasets
- **File Streaming**: Efficient file upload/download handling
- **WebSocket Optimization**: Efficient real-time communication

## 🔄 Recent Updates

### Latest Features Added:

- **Enhanced Security**: Added Helmet v8.1.0 for improved HTTP security headers
- **Performance Optimization**: Implemented compression middleware for response optimization
- **Advanced Reporting**: Added ExcelJS and JSON2CSV for flexible data exports
- **Automated Tasks**: Integrated Node-cron for scheduled operations
- **Email Integration**: Added Nodemailer support for automated notifications
- **PDF Generation**: Integrated PDFKit for dynamic PDF report generation
- **Enhanced Testing**: Updated Jest to v29.5.0 with improved test coverage
- **Database Optimization**: Upgraded MySQL driver to v3.14.1 and Sequelize to v6.37.7
- **Real-time Updates**: Socket.IO upgrade to v4.8.1 for better WebSocket performance
- **Input Validation**: Express Validator upgrade to v7.2.1 for enhanced security
- **File Management**: Upgraded Multer to v2.0.1 for improved file handling
- **JWT Security**: Updated to jsonwebtoken v9.0.2 for enhanced token security

### Technical Improvements:

- **Response Optimization**: Added compression for faster API responses
- **Security Enhancements**: Implemented latest security headers with Helmet
- **Logging Improvements**: Enhanced HTTP request logging with Morgan
- **Environment Management**: Updated dotenv to v16.5.0 for better configuration
- **Development Workflow**: Updated development dependencies for better DX
- **Documentation**: Added comprehensive API documentation with examples
- **Error Handling**: Improved error handling with detailed logging
- **Performance Monitoring**: Added request logging and performance metrics

## 🤝 API Integration

The backend is fully integrated with:

- **Desktop App**: Electron-based desktop application
- **Web App**: React-based web application
- **Mobile App**: React Native mobile application

All applications use the same RESTful API endpoints and WebSocket connections for real-time features.

## 📞 Support

For support and questions:

- Check the API documentation in `/docs`
- Review the test files for usage examples
- Create an issue in the repository
- Contact the development team

## 📄 License

This project is licensed under the MIT License.
