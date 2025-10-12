const rateLimit = require('express-rate-limit');

// General authentication rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  // Skip successful requests
  skipSuccessfulRequests: true,
  // Skip failed requests (4xx, 5xx)
  skipFailedRequests: false,
  // Custom key generator for better tracking
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body?.email || 'unknown');
  },
  // Add logging when rate limit is reached
  onLimitReached: (req, res, options) => {
    console.warn(`Rate limit reached for ${req.ip} on ${req.path} - Email: ${req.body?.email || 'unknown'}`);
  }
});

// Stricter rate limiter for sensitive endpoints
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 attempts per window
  message: {
    error: 'Too many attempts, account temporarily locked',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body?.email || 'unknown');
  },
  onLimitReached: (req, res, options) => {
    console.warn(`Strict rate limit reached for ${req.ip} on ${req.path} - Email: ${req.body?.email || 'unknown'}`);
  }
});

// Password reset rate limiter (more restrictive)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    error: 'Too many password reset attempts, please try again in an hour',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body?.email || 'unknown');
  },
  onLimitReached: (req, res, options) => {
    console.warn(`Password reset rate limit reached for ${req.ip} on ${req.path} - Email: ${req.body?.email || 'unknown'}`);
  }
});

// General API rate limiter (for non-auth endpoints)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.user?.id || 'anonymous');
  },
  onLimitReached: (req, res, options) => {
    console.warn(`General rate limit reached for ${req.ip} on ${req.path} - User: ${req.user?.id || 'anonymous'}`);
  }
});

module.exports = {
  authLimiter,
  strictAuthLimiter,
  passwordResetLimiter,
  generalLimiter
};
