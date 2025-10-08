const jwt = require('jsonwebtoken');
const { User, Department, UserSession } = require('../models');
const testConfig = require('../config/test.config');

// Get JWT secret based on environment
const getJwtSecret = () => {
  return process.env.NODE_ENV === 'test' ? testConfig.jwt.secret : process.env.JWT_SECRET;
};

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  console.log('DEBUG: Auth middleware entry', {
    authorization: req.headers.authorization
  });
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('DEBUG: No token provided');
      return res.status(401).json({ error: 'Access token is required' });
    }

    // Verify session is active
    const session = await UserSession.findOne({ where: { token, isActive: true } });
    console.log('DEBUG: Session lookup', session ? { userId: session.userId, isActive: session.isActive } : 'No session found');
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Update session activity timestamp for more accurate active tracking
    // This helps track when users were last active (within 30 minutes, 2 hours, etc.)
    await session.update({ updatedAt: new Date() });

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findByPk(decoded.id, {
      include: [
        { model: Department, attributes: ['id', 'name'] }
      ]
    });

    console.log('DEBUG: User lookup', user ? {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      status: user.status,
      firstname: user.firstname,
      lastname: user.lastname
    } : 'User not found');

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Account not approved by admin' });
    }

    // req.user should be the source of truth from the database
    // // Preserve both the role and department ID from the token
    // if (decoded.role) {
    //   user.role = decoded.role;
    // }
    // if (decoded.departmentId) {
    //   user.departmentId = decoded.departmentId;
    // }

    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    console.log('DEBUG: Auth error', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Check if user has required role (alias for backward compatibility)
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Check if user has required role (new implementation)
const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Not authorized to perform this action' 
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  checkRole // Keeping for backward compatibility
}; 