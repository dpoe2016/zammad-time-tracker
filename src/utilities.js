/**
 * Utilities for Zammad Timetracking Extension
 * Contains shared functions used across multiple files
 */

/**
 * Format duration in seconds to HH:MM:SS format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string (HH:MM:SS)
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Round minutes up to the next 15-minute interval
 * @param {number} minutes - Time in minutes
 * @returns {number} Rounded minutes (to the next 15-minute interval)
 * @example
 * roundUpToNext15Minutes(0) => 0
 * roundUpToNext15Minutes(1) => 15
 * roundUpToNext15Minutes(15) => 15
 * roundUpToNext15Minutes(16) => 30
 * roundUpToNext15Minutes(47) => 60
 */
function roundUpToNext15Minutes(minutes) {
  if (minutes <= 0) {
    return 0;
  }
  return Math.ceil(minutes / 15) * 15;
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatDuration,
    roundUpToNext15Minutes,
  };
}
