class IDGenerator {
  constructor(sequelize, IDSequencesModel) {
    this.sequelize = sequelize;
    this.IDSequences = IDSequencesModel;
  }

  /**
   * Generate a standardized ID in the format XXX-YYYYMMDD-XXXXX
   * @param {string} prefix - The 3-letter prefix (e.g., 'USR', 'TKT', 'TSK')
   * @returns {Promise<string>} The generated ID
   */
  async generateID(prefix) {
    if (!prefix || prefix.length !== 3) {
      throw new Error('Prefix must be exactly 3 characters');
    }

    // Convert prefix to uppercase for consistency
    prefix = prefix.toUpperCase();

    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    try {
      // Get or create sequence for today
      const [sequence, created] = await this.IDSequences.findOrCreate({
        where: {
          prefix,
          date: dateString
        },
        defaults: {
          prefix,
          date: dateString,
          sequence: 1
        }
      });

      if (!created) {
        // Increment existing sequence
        sequence.sequence += 1;
        await sequence.save();
      }

      // Format sequence number to 5 digits with leading zeros
      const sequenceStr = sequence.sequence.toString().padStart(5, '0');

      // Check for overflow (99999)
      if (sequence.sequence > 99999) {
        throw new Error(`Sequence overflow for prefix ${prefix} on date ${dateString}`);
      }

      return `${prefix}-${dateString}-${sequenceStr}`;
    } catch (error) {
      throw new Error(`Failed to generate ID: ${error.message}`);
    }
  }

  /**
   * Validate if an ID matches the expected format
   * @param {string} id - The ID to validate
   * @param {string} expectedPrefix - The expected prefix (optional)
   * @returns {boolean} True if valid, false otherwise
   */
  static validateID(id, expectedPrefix = null) {
    if (!id || typeof id !== 'string') {
      return false;
    }

    const pattern = /^[A-Z]{3}-\d{8}-\d{5}$/;
    if (!pattern.test(id)) {
      return false;
    }

    if (expectedPrefix) {
      const prefix = id.split('-')[0];
      return prefix === expectedPrefix.toUpperCase();
    }

    return true;
  }

  /**
   * Extract components from an ID
   * @param {string} id - The ID to parse
   * @returns {Object} Object with prefix, date, and sequence
   */
  static parseID(id) {
    if (!this.validateID(id)) {
      throw new Error('Invalid ID format');
    }

    const [prefix, date, sequence] = id.split('-');
    return {
      prefix: prefix.toUpperCase(),
      date,
      sequence: parseInt(sequence, 10)
    };
  }

  /**
   * Get the prefix from an ID
   * @param {string} id - The ID to extract prefix from
   * @returns {string} The prefix
   */
  static getPrefix(id) {
    if (!id || typeof id !== 'string') {
      return null;
    }
    const parts = id.split('-');
    return parts.length === 3 ? parts[0].toUpperCase() : null;
  }

  /**
   * Get the date from an ID
   * @param {string} id - The ID to extract date from
   * @returns {string} The date in YYYYMMDD format
   */
  static getDate(id) {
    if (!id || typeof id !== 'string') {
      return null;
    }
    const parts = id.split('-');
    return parts.length === 3 ? parts[1] : null;
  }

  /**
   * Get the sequence number from an ID
   * @param {string} id - The ID to extract sequence from
   * @returns {number} The sequence number
   */
  static getSequence(id) {
    if (!id || typeof id !== 'string') {
      return null;
    }
    const parts = id.split('-');
    return parts.length === 3 ? parseInt(parts[2], 10) : null;
  }
}

module.exports = IDGenerator; 