/**
 * Password validation utility
 * Implements standard password requirements for security
 */

class PasswordValidator {
  constructor() {
    this.minLength = 8;
    this.maxLength = 128;
    this.requireUppercase = true;
    this.requireLowercase = true;
    this.requireNumbers = true;
    this.requireSpecialChars = true;
    this.forbiddenPatterns = [
      /(.)\1{2,}/, // No 3+ consecutive identical characters
      /123|234|345|456|567|678|789|890/, // No sequential numbers
      /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i, // No sequential letters
      /qwerty|asdfgh|zxcvbn/i, // No common keyboard patterns
    ];
    this.commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
      'qwerty123', 'dragon', 'master', 'hello', 'freedom', 'whatever',
      'qazwsx', 'trustno1', 'jordan23', 'harley', 'ranger', 'hunter',
      'buster', 'soccer', 'hockey', 'killer', 'george', 'sexy', 'andrew',
      'charlie', 'superman', 'asshole', 'fuckyou', 'dallas', 'jessica',
      'panties', 'pepper', '1234', '6969', 'killer', 'trust', 'jordan',
      'jennifer', 'zxcvbn', 'asdf', 'dead', 'pass', 'fuck', '6969',
      'mustang', 'letmein', 'amanda', 'access', 'yankees', '987654321',
      'dallas', 'austin', 'thunder', 'taylor', 'matrix', 'mobilemail',
      'mom', 'monitor', 'monitoring', 'montana', 'moon', 'moscow'
    ];
  }

  /**
   * Validate password against all requirements
   * @param {string} password - Password to validate
   * @returns {Object} - Validation result with isValid boolean and errors array
   */
  validate(password) {
    const errors = [];
    
    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    // Length validation
    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters long`);
    }
    
    if (password.length > this.maxLength) {
      errors.push(`Password must be no more than ${this.maxLength} characters long`);
    }

    // Character type validation
    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    }

    // Pattern validation
    for (const pattern of this.forbiddenPatterns) {
      if (pattern.test(password)) {
        if (pattern.source.includes('\\1')) {
          errors.push('Password cannot contain 3 or more consecutive identical characters');
        } else if (pattern.source.includes('123|234')) {
          errors.push('Password cannot contain sequential numbers (123, 234, etc.)');
        } else if (pattern.source.includes('abc|bcd')) {
          errors.push('Password cannot contain sequential letters (abc, bcd, etc.)');
        } else if (pattern.source.includes('qwerty')) {
          errors.push('Password cannot contain common keyboard patterns');
        }
        break; // Only show one pattern error at a time
      }
    }

    // Common password check
    if (this.commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a more unique password');
    }

    // Check for repeated character sequences
    if (this.hasRepeatedSequence(password)) {
      errors.push('Password contains repeated character sequences');
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: this.calculateStrength(password)
    };
  }

  /**
   * Check for repeated character sequences
   * @param {string} password - Password to check
   * @returns {boolean} - True if repeated sequences found
   */
  hasRepeatedSequence(password) {
    for (let i = 0; i < password.length - 2; i++) {
      const sequence = password.substring(i, i + 3);
      const remaining = password.substring(i + 3);
      if (remaining.includes(sequence)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate password strength score (0-100)
   * @param {string} password - Password to analyze
   * @returns {number} - Strength score
   */
  calculateStrength(password) {
    let score = 0;
    
    // Length score (0-25 points)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 5;

    // Character variety score (0-40 points)
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) score += 10;

    // Complexity score (0-35 points)
    const uniqueChars = new Set(password).size;
    score += Math.min(uniqueChars * 2, 20);
    
    if (password.length >= 8 && uniqueChars >= 6) score += 15;

    return Math.min(score, 100);
  }

  /**
   * Get password strength description
   * @param {number} strength - Strength score
   * @returns {string} - Strength description
   */
  getStrengthDescription(strength) {
    if (strength < 30) return 'Very Weak';
    if (strength < 50) return 'Weak';
    if (strength < 70) return 'Fair';
    if (strength < 90) return 'Good';
    return 'Strong';
  }

  /**
   * Get password strength color for UI
   * @param {number} strength - Strength score
   * @returns {string} - Color name
   */
  getStrengthColor(strength) {
    if (strength < 30) return 'error';
    if (strength < 50) return 'warning';
    if (strength < 70) return 'info';
    if (strength < 90) return 'primary';
    return 'success';
  }

  /**
   * Generate password suggestions based on validation errors
   * @param {Array} errors - Validation errors
   * @returns {Array} - Array of suggestions
   */
  getSuggestions(errors) {
    const suggestions = [];
    
    if (errors.some(e => e.includes('at least'))) {
      suggestions.push('Use a longer password with at least 8 characters');
    }
    
    if (errors.some(e => e.includes('uppercase'))) {
      suggestions.push('Add uppercase letters (A-Z)');
    }
    
    if (errors.some(e => e.includes('lowercase'))) {
      suggestions.push('Add lowercase letters (a-z)');
    }
    
    if (errors.some(e => e.includes('number'))) {
      suggestions.push('Add numbers (0-9)');
    }
    
    if (errors.some(e => e.includes('special character'))) {
      suggestions.push('Add special characters (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    }
    
    if (errors.some(e => e.includes('consecutive'))) {
      suggestions.push('Avoid repeating characters (aaa, 111, etc.)');
    }
    
    if (errors.some(e => e.includes('sequential'))) {
      suggestions.push('Avoid sequential patterns (123, abc, etc.)');
    }
    
    if (errors.some(e => e.includes('common'))) {
      suggestions.push('Choose a more unique password');
    }

    return suggestions;
  }
}

// Create singleton instance
const passwordValidator = new PasswordValidator();

module.exports = passwordValidator;
