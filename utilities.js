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

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDuration
    };
}