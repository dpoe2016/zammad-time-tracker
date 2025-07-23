/**
 * Logging utilities for Zammad Timetracking Extension
 * Provides a consistent interface for logging across all files
 */

// Centralized logging utility
const logger = {
    // Set to true to enable debug logging
    debugMode: false,

    // Log levels
    levels: {
        DEBUG: 'DEBUG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR'
    },

    /**
     * Log a message with specified level
     * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
     * @param {string} message - Message to log
     * @param {any} data - Optional data to log
     */
    log(level, message, data) {
        const timestamp = new Date().toISOString();
        const prefix = `[Zammad-TT][${level}][${timestamp}]`;

        if (level === this.levels.DEBUG && !this.debugMode) {
            return; // Skip debug messages when not in debug mode
        }

        if (data !== undefined) {
            console.log(prefix, message, data);
        } else {
            console.log(prefix, message);
        }
    },

    /**
     * Log a debug message
     * @param {string} message - Message to log
     * @param {any} data - Optional data to log
     */
    debug(message, data) {
        this.log(this.levels.DEBUG, message, data);
    },

    /**
     * Log an info message
     * @param {string} message - Message to log
     * @param {any} data - Optional data to log
     */
    info(message, data) {
        this.log(this.levels.INFO, message, data);
    },

    /**
     * Log a warning message
     * @param {string} message - Message to log
     * @param {any} data - Optional data to log
     */
    warn(message, data) {
        this.log(this.levels.WARN, message, data);
    },

    /**
     * Log an error message
     * @param {string} message - Message to log
     * @param {any} data - Optional data to log
     */
    error(message, data) {
        this.log(this.levels.ERROR, message, data);
    },

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        this.debug('Debug mode enabled');
    },

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debug('Debug mode disabled');
        this.debugMode = false;
    }
};

// Export logger object for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = logger;
}