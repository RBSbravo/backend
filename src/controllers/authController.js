const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User, UserSession, Department } = require('../models');
const { Op } = require('sequelize');
const testConfig = require('../config/test.config');
const notificationService = require('../services/notificationService');

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: parseInt(process.env.EMAIL_PORT) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || 'user@example.com',
    pass: process.env.EMAIL_PASSWORD || 'password'
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Simplified: Use single web URL for all platforms
const sendPasswordResetEmail = async (email, resetToken) => {
  // Use web URL for all platforms - simpler and more consistent
  const baseUrl = process.env.FRONTEND_URL_WEB || 'http://localhost:5173';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    to: email,
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your account.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">
        Reset Password
      </a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br>MITO Team</p>
    `,
    text: `
      Password Reset Request
      
      You requested a password reset for your account.
      
      Click the link below to reset your password:
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request this, please ignore this email.
      
      Best regards,
      MITO Team
    `
  };

  await transporter.sendMail(mailOptions);
};

// Get JWT secret based on environment
const getJwtSecret = () => {
  return process.env.NODE_ENV === 'test' ? testConfig.jwt.secret : process.env.JWT_SECRET;
};

// Register a new user
const register = async (req, res) => {
  try {
    const { firstname, lastname, email, password, role, departmentId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Only employees and department heads require departmentId and are set to pending
    let status = 'approved';
    let finalDepartmentId = null;
    if (role === 'department_head' || role === 'employee') {
      if (!departmentId) {
        return res.status(400).json({ error: 'Department is required for this role' });
      }
      status = 'pending';
      finalDepartmentId = departmentId;
    } else if (role === 'admin') {
      // Admin users don't need a department and are automatically approved
      status = 'approved';
      finalDepartmentId = null;
    }

    // Create user (password will be hashed by model hook)
    const user = await User.create({
      firstname,
      lastname,
      email,
      password,
      role: role || 'employee', // Default role is employee
      departmentId: finalDepartmentId,
      status
    });

    // Fetch user with department information
    const userWithDepartment = await User.findOne({
      where: { id: user.id },
      include: [{
        model: Department,
        attributes: ['id', 'name']
      }]
    });

    // Notify all admins about new pending user registration
    if (status === 'pending') {
      try {
        const admins = await User.findAll({
          where: { role: 'admin' },
          attributes: ['id']
        });

        for (const admin of admins) {
          await notificationService.createNotification({
            userId: admin.id,
            type: 'pending_user',
            title: 'New User Registration',
            message: `New ${role} user registered: ${firstname} ${lastname} (${email})`,
            relatedUserId: user.id
          });
        }
      } catch (notificationError) {
        console.error('Error creating registration notification:', notificationError);
        // Don't fail the registration if notification fails
      }
    }

    // Generate token with shorter expiry for more accurate active tracking
    const token = jwt.sign(
      { id: user.id },
      getJwtSecret(),
      { expiresIn: '8h' } // Reduced from 24h to 8h for more accuracy
    );

    // Return user data (excluding password) and token
    const userData = userWithDepartment.toJSON();
    delete userData.password;
    
    // Add department name to response
    let departmentName = null;
    if (userWithDepartment.Department && userWithDepartment.Department.name) {
      departmentName = userWithDepartment.Department.name;
    }
    
    const responseData = {
      ...userData,
      department: departmentName
    };
    
    res.status(201).json({ user: responseData, token });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user with department information
    const user = await User.findOne({ 
      where: { email },
      include: [{
        model: Department,
        attributes: ['id', 'name']
      }]
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password using model method
    const isMatch = await user.validatePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Block login if not approved
    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Your account is pending approval. Please contact your administrator to approve your account before you can log in.' });
    }

    // Generate token with shorter expiry for more accurate active tracking
    const token = jwt.sign(
      { id: user.id },
      getJwtSecret(),
      { expiresIn: '8h' } // Reduced from 24h to 8h for more accuracy
    );

    // Update last login timestamp
    await user.update({ lastLogin: new Date() });
    
    // Create a session in UserSession table with shorter expiry
    await UserSession.create({
      userId: user.id,
      token,
      isActive: true,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8h expiry (8 * 60 * 60 * 1000)
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Return user data (excluding password) and token
    const userData = user.toJSON();
    delete userData.password;
    
    // Add department name to response
    let departmentName = null;
    if (user.Department && user.Department.name) {
      departmentName = user.Department.name;
    }
    
    const responseData = {
      ...userData,
      department: departmentName
    };
    
    res.json({ user: responseData, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Logout user
const logout = async (req, res) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    // Find the session and mark as inactive
    const session = await UserSession.findOne({ where: { token, isActive: true } });
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    session.isActive = false;
    await session.save();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    // Fetch user with department information
    const user = await User.findOne({
      where: { id: req.user.id },
      include: [{
        model: Department,
        attributes: ['id', 'name']
      }]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user.toJSON();
    delete userData.password;
    
    // Add department name if available
    let departmentName = null;
    if (user.Department && user.Department.name) {
      departmentName = user.Department.name;
    }
    
    res.json({
      id: userData.id,
      firstname: userData.firstname,
      lastname: userData.lastname,
      email: userData.email,
      role: userData.role,
      departmentId: userData.departmentId,
      department: departmentName,
      status: userData.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to user
    await user.update({
      resetToken,
      resetTokenExpiry
    });

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, resetToken);
      res.json({ message: 'Password reset email sent' });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      
      // In development, still return the token for testing
      if (process.env.NODE_ENV === 'development') {
    res.json({
          message: 'Password reset email sent (development mode)',
          resetToken // Only include this in development
    });
      } else {
        res.status(500).json({ error: 'Failed to send reset email' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Find user with valid reset token
    const user = await User.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update password and clear reset token
    await user.update({
      password,
      resetToken: null,
      resetTokenExpiry: null
    });

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verify reset token
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    res.json({ message: 'Valid reset token' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Change password for authenticated user
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isMatch = await user.validatePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Test email endpoint (for development only)
const testEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Test email configuration
    const config = {
      host: process.env.EMAIL_HOST || 'smtp.example.com',
      port: process.env.EMAIL_PORT || 587,
      user: process.env.EMAIL_USER || 'user@example.com',
      hasPassword: !!process.env.EMAIL_PASSWORD,
      hasPass: !!process.env.EMAIL_PASS,
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      frontendUrl: process.env.FRONTEND_URL_WEB || 'http://localhost:5173'
    };
    
    // Try to verify email configuration
    try {
      await transporter.verify();
      res.json({ 
        message: 'Email configuration verified successfully',
        config: {
          host: config.host,
          port: config.port,
          user: config.user,
          hasPassword: config.hasPassword,
          hasPass: config.hasPass,
          from: config.from,
          frontendUrl: config.frontendUrl
        }
      });
    } catch (verifyError) {
      res.status(500).json({ 
        error: 'Email configuration verification failed',
        details: verifyError.message,
        config: {
          host: config.host,
          port: config.port,
          user: config.user,
          hasPassword: config.hasPassword,
          hasPass: config.hasPass,
          from: config.from,
          frontendUrl: config.frontendUrl
        }
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  forgotPassword,
  resetPassword,
  verifyResetToken,
  changePassword,
  testEmail
}; 