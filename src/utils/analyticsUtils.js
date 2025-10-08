// Utility functions for analytics services

function safeParseDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? null : date;
}

function getDateString(dateValue) {
  const date = safeParseDate(dateValue);
  return date ? date.toISOString().split('T')[0] : null;
}

function getWeek(date) {
  if (!date || isNaN(date.getTime())) return 0;
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

module.exports = {
  safeParseDate,
  getDateString,
  getWeek
}; 