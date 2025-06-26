/**
 * Storage utilities for Zammad Timetracking Extension
 * Provides a consistent interface for chrome.storage operations
 */

const storage = {
    /**
     * Save data to chrome.storage.local
     * @param {string} key - Storage key
     * @param {any} data - Data to store
     * @returns {Promise} Promise that resolves when data is saved
     */
    async save(key, data) {
        try {
            const saveObj = {};
            saveObj[key] = data;
            await chrome.storage.local.set(saveObj);
            return true;
        } catch (error) {
            console.error(`Error saving data for key ${key}:`, error);
            throw error;
        }
    },

    /**
     * Load data from chrome.storage.local
     * @param {string} key - Storage key
     * @param {any} defaultValue - Default value if key doesn't exist
     * @returns {Promise<any>} Promise that resolves with the loaded data
     */
    async load(key, defaultValue = null) {
        try {
            const result = await chrome.storage.local.get([key]);
            return result[key] !== undefined ? result[key] : defaultValue;
        } catch (error) {
            console.error(`Error loading data for key ${key}:`, error);
            return defaultValue;
        }
    },

    /**
     * Remove data from chrome.storage.local
     * @param {string} key - Storage key
     * @returns {Promise} Promise that resolves when data is removed
     */
    async remove(key) {
        try {
            await chrome.storage.local.remove([key]);
            return true;
        } catch (error) {
            console.error(`Error removing data for key ${key}:`, error);
            throw error;
        }
    },

    /**
     * Load multiple keys from chrome.storage.local
     * @param {string[]} keys - Array of storage keys
     * @returns {Promise<object>} Promise that resolves with an object containing all requested keys
     */
    async loadMultiple(keys) {
        try {
            return await chrome.storage.local.get(keys);
        } catch (error) {
            console.error(`Error loading multiple keys:`, error);
            return {};
        }
    }
};

// Export storage object for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = storage;
}