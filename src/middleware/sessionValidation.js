const { UserSession } = require('../models');

const validateSession = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const session = await UserSession.findOne({ where: { token, isActive: true } });
    if (!session) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }
    req.session = session;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = validateSession; 