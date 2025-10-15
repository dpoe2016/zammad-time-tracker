/**
 * IndexedDB wrapper for Zammad Time Tracking Extension
 * Provides efficient storage and retrieval for cache data
 */

class ZammadIndexedDB {
  constructor() {
    this.dbName = 'ZammadTimeTracker';
    this.version = 1;
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Initialize the IndexedDB database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return existing database if already initialized
    if (this.db) {
      return Promise.resolve(this.db);
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB initialization failed:', request.error);
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('IndexedDB upgrade needed, creating object stores...');

        // Customer cache store
        if (!db.objectStoreNames.contains('customerCache')) {
          const customerStore = db.createObjectStore('customerCache', { keyPath: 'id' });
          customerStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('Created customerCache object store');
        }

        // Ticket cache store
        if (!db.objectStoreNames.contains('ticketCache')) {
          const ticketStore = db.createObjectStore('ticketCache', { keyPath: 'cacheKey' });
          ticketStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('Created ticketCache object store');
        }

        // API endpoints cache store
        if (!db.objectStoreNames.contains('apiEndpoints')) {
          db.createObjectStore('apiEndpoints', { keyPath: 'id' });
          console.log('Created apiEndpoints object store');
        }

        // API features cache store
        if (!db.objectStoreNames.contains('apiFeatures')) {
          db.createObjectStore('apiFeatures', { keyPath: 'id' });
          console.log('Created apiFeatures object store');
        }

        // User profile cache store
        if (!db.objectStoreNames.contains('userProfile')) {
          db.createObjectStore('userProfile', { keyPath: 'id' });
          console.log('Created userProfile object store');
        }

        // Time entry cache store
        if (!db.objectStoreNames.contains('timeEntryCache')) {
          const timeEntryStore = db.createObjectStore('timeEntryCache', { keyPath: 'cacheKey' });
          timeEntryStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('Created timeEntryCache object store');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get a transaction for the specified store
   * @param {string} storeName - Name of the object store
   * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
   * @returns {Promise<IDBObjectStore>}
   */
  async getStore(storeName, mode = 'readonly') {
    await this.init();
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  /**
   * Save customer data to cache
   * @param {Map} customerMap - Map of customer data
   * @param {number} timestamp - Cache timestamp
   * @returns {Promise<void>}
   */
  async saveCustomerCache(customerMap, timestamp) {
    try {
      const store = await this.getStore('customerCache', 'readwrite');

      // Clear existing data first
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      // Add new customer data
      const promises = [];
      for (const [id, data] of customerMap.entries()) {
        const promise = new Promise((resolve, reject) => {
          const request = store.put({
            id: id,
            data: data,
            timestamp: timestamp
          });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        promises.push(promise);
      }

      await Promise.all(promises);
      console.log(`Saved ${customerMap.size} customers to IndexedDB cache`);
    } catch (error) {
      console.error('Error saving customer cache to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Load customer data from cache
   * @param {number} expiryMs - Cache expiry time in milliseconds
   * @returns {Promise<{customerMap: Map, timestamp: number}|null>}
   */
  async loadCustomerCache(expiryMs) {
    try {
      const store = await this.getStore('customerCache', 'readonly');

      const customers = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (customers.length === 0) {
        return null;
      }

      // Check if cache is expired
      const timestamp = customers[0].timestamp;
      const now = Date.now();
      if (now - timestamp >= expiryMs) {
        console.log('Customer cache expired');
        await this.clearCustomerCache();
        return null;
      }

      // Convert to Map
      const customerMap = new Map();
      for (const customer of customers) {
        customerMap.set(customer.id, customer.data);
      }

      console.log(`Loaded ${customerMap.size} customers from IndexedDB cache`);
      return { customerMap, timestamp };
    } catch (error) {
      console.error('Error loading customer cache from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Clear customer cache
   * @returns {Promise<void>}
   */
  async clearCustomerCache() {
    try {
      const store = await this.getStore('customerCache', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log('Cleared customer cache from IndexedDB');
    } catch (error) {
      console.error('Error clearing customer cache from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Save ticket cache
   * @param {string} cacheKey - Cache key identifier
   * @param {Array} tickets - Ticket data array
   * @param {number} timestamp - Cache timestamp
   * @returns {Promise<void>}
   */
  async saveTicketCache(cacheKey, tickets, timestamp) {
    try {
      const store = await this.getStore('ticketCache', 'readwrite');

      await new Promise((resolve, reject) => {
        const request = store.put({
          cacheKey: cacheKey,
          tickets: tickets,
          timestamp: timestamp
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log(`Saved ${tickets.length} tickets to IndexedDB with key: ${cacheKey}`);
    } catch (error) {
      console.error('Error saving ticket cache to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Load ticket cache
   * @param {string} cacheKey - Cache key identifier
   * @param {number} expiryMs - Cache expiry time in milliseconds
   * @returns {Promise<Array|null>}
   */
  async loadTicketCache(cacheKey, expiryMs) {
    try {
      const store = await this.getStore('ticketCache', 'readonly');

      const result = await new Promise((resolve, reject) => {
        const request = store.get(cacheKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!result) {
        return null;
      }

      // Check if cache is expired
      const now = Date.now();
      if (now - result.timestamp >= expiryMs) {
        console.log(`Ticket cache expired for key: ${cacheKey}`);
        await this.deleteTicketCache(cacheKey);
        return null;
      }

      console.log(`Loaded ${result.tickets.length} tickets from IndexedDB for key: ${cacheKey}`);
      return result.tickets;
    } catch (error) {
      console.error('Error loading ticket cache from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Get all ticket cache keys
   * @returns {Promise<Array<string>>}
   */
  async getAllTicketCacheKeys() {
    try {
      const store = await this.getStore('ticketCache', 'readonly');

      const keys = await new Promise((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      return keys;
    } catch (error) {
      console.error('Error getting ticket cache keys from IndexedDB:', error);
      return [];
    }
  }

  /**
   * Delete specific ticket cache
   * @param {string} cacheKey - Cache key identifier
   * @returns {Promise<void>}
   */
  async deleteTicketCache(cacheKey) {
    try {
      const store = await this.getStore('ticketCache', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = store.delete(cacheKey);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log(`Deleted ticket cache for key: ${cacheKey}`);
    } catch (error) {
      console.error('Error deleting ticket cache from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Clear all ticket cache
   * @returns {Promise<void>}
   */
  async clearTicketCache() {
    try {
      const store = await this.getStore('ticketCache', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log('Cleared all ticket cache from IndexedDB');
    } catch (error) {
      console.error('Error clearing ticket cache from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Save API endpoints
   * @param {Object} endpoints - API endpoints object
   * @returns {Promise<void>}
   */
  async saveApiEndpoints(endpoints) {
    try {
      const store = await this.getStore('apiEndpoints', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = store.put({
          id: 'endpoints',
          data: endpoints
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log('Saved API endpoints to IndexedDB');
    } catch (error) {
      console.error('Error saving API endpoints to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Load API endpoints
   * @returns {Promise<Object|null>}
   */
  async loadApiEndpoints() {
    try {
      const store = await this.getStore('apiEndpoints', 'readonly');
      const result = await new Promise((resolve, reject) => {
        const request = store.get('endpoints');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (result) {
        console.log('Loaded API endpoints from IndexedDB');
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('Error loading API endpoints from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Save API features
   * @param {Object} features - API features object
   * @returns {Promise<void>}
   */
  async saveApiFeatures(features) {
    try {
      const store = await this.getStore('apiFeatures', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = store.put({
          id: 'features',
          data: features
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log('Saved API features to IndexedDB');
    } catch (error) {
      console.error('Error saving API features to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Load API features
   * @returns {Promise<Object|null>}
   */
  async loadApiFeatures() {
    try {
      const store = await this.getStore('apiFeatures', 'readonly');
      const result = await new Promise((resolve, reject) => {
        const request = store.get('features');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (result) {
        console.log('Loaded API features from IndexedDB');
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('Error loading API features from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Save user profile
   * @param {Object} profile - User profile object
   * @returns {Promise<void>}
   */
  async saveUserProfile(profile) {
    try {
      const store = await this.getStore('userProfile', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = store.put({
          id: 'profile',
          data: profile
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log('Saved user profile to IndexedDB');
    } catch (error) {
      console.error('Error saving user profile to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Load user profile
   * @returns {Promise<Object|null>}
   */
  async loadUserProfile() {
    try {
      const store = await this.getStore('userProfile', 'readonly');
      const result = await new Promise((resolve, reject) => {
        const request = store.get('profile');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (result) {
        console.log('Loaded user profile from IndexedDB');
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('Error loading user profile from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Delete user profile
   * @returns {Promise<void>}
   */
  async deleteUserProfile() {
    try {
      const store = await this.getStore('userProfile', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = store.delete('profile');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log('Deleted user profile from IndexedDB');
    } catch (error) {
      console.error('Error deleting user profile from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Save time entry cache
   * @param {string} cacheKey - Cache key identifier
   * @param {Object} data - Time entry data
   * @param {number} timestamp - Cache timestamp
   * @returns {Promise<void>}
   */
  async saveTimeEntryCache(cacheKey, data, timestamp) {
    try {
      const store = await this.getStore('timeEntryCache', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = store.put({
          cacheKey: cacheKey,
          data: data,
          timestamp: timestamp
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log(`Saved time entry cache to IndexedDB with key: ${cacheKey}`);
    } catch (error) {
      console.error('Error saving time entry cache to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Load time entry cache
   * @param {string} cacheKey - Cache key identifier
   * @param {number} expiryMs - Cache expiry time in milliseconds
   * @returns {Promise<Object|null>}
   */
  async loadTimeEntryCache(cacheKey, expiryMs) {
    try {
      const store = await this.getStore('timeEntryCache', 'readonly');
      const result = await new Promise((resolve, reject) => {
        const request = store.get(cacheKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!result) {
        return null;
      }

      // Check if cache is expired
      const now = Date.now();
      if (now - result.timestamp >= expiryMs) {
        console.log(`Time entry cache expired for key: ${cacheKey}`);
        await this.deleteTimeEntryCache(cacheKey);
        return null;
      }

      console.log(`Loaded time entry cache from IndexedDB for key: ${cacheKey}`);
      return result.data;
    } catch (error) {
      console.error('Error loading time entry cache from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Delete time entry cache
   * @param {string} cacheKey - Cache key identifier
   * @returns {Promise<void>}
   */
  async deleteTimeEntryCache(cacheKey) {
    try {
      const store = await this.getStore('timeEntryCache', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = store.delete(cacheKey);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log(`Deleted time entry cache for key: ${cacheKey}`);
    } catch (error) {
      console.error('Error deleting time entry cache from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Clear all data from IndexedDB
   * @returns {Promise<void>}
   */
  async clearAll() {
    try {
      await this.clearCustomerCache();
      await this.clearTicketCache();

      const stores = ['apiEndpoints', 'apiFeatures', 'userProfile', 'timeEntryCache'];
      for (const storeName of stores) {
        const store = await this.getStore(storeName, 'readwrite');
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      console.log('Cleared all data from IndexedDB');
    } catch (error) {
      console.error('Error clearing all data from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
      console.log('IndexedDB connection closed');
    }
  }
}

// Create singleton instance
const zammadIndexedDB = new ZammadIndexedDB();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = zammadIndexedDB;
}

// Make available globally for browser extension
if (typeof window !== 'undefined') {
  window.zammadIndexedDB = zammadIndexedDB;
}
