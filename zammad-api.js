// Zammad API Service for Time Tracking Extension
// This file handles all communication with the Zammad REST API

class ZammadAPI {
  constructor() {
    this.baseUrl = null;
    this.token = null;
    this.initialized = false;
  }

  /**
   * Initialize the API with base URL and token
   * @param {string} baseUrl - The base URL of the Zammad instance (e.g., https://zammad.example.com)
   * @param {string} token - The API token for authentication
   */
  init(baseUrl, token) {
    if (!baseUrl) {
      throw new Error('Base URL is required');
    }
    
    // Remove trailing slash if present
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.token = token;
    this.initialized = true;
    
    console.log('Zammad API initialized with base URL:', this.baseUrl);
    return true;
  }

  /**
   * Check if the API is initialized
   * @returns {boolean} - True if initialized, false otherwise
   */
  isInitialized() {
    return this.initialized && this.baseUrl && this.token;
  }

  /**
   * Extract base URL from current tab URL
   * @param {string} url - The current tab URL
   * @returns {string|null} - The extracted base URL or null if not found
   */
  extractBaseUrlFromTabUrl(url) {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}`;
    } catch (e) {
      console.error('Error extracting base URL:', e);
      return null;
    }
  }

  /**
   * Get API settings from storage
   * @returns {Promise<Object>} - The API settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get(['zammadApiSettings']);
      return result.zammadApiSettings || {};
    } catch (error) {
      console.error('Error getting API settings:', error);
      return {};
    }
  }

  /**
   * Save API settings to storage
   * @param {Object} settings - The API settings to save
   * @returns {Promise<boolean>} - True if saved successfully, false otherwise
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({ zammadApiSettings: settings });
      return true;
    } catch (error) {
      console.error('Error saving API settings:', error);
      return false;
    }
  }

  /**
   * Make an API request to Zammad
   * @param {string} endpoint - The API endpoint (e.g., /api/v1/tickets/1)
   * @param {string} method - The HTTP method (GET, POST, PUT, DELETE)
   * @param {Object} data - The data to send with the request
   * @returns {Promise<Object>} - The response data
   */
  async request(endpoint, method = 'GET', data = null) {
    if (!this.isInitialized()) {
      throw new Error('API not initialized. Call init() first.');
    }

    // Ensure endpoint starts with /
    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token token=${this.token}`
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      console.log(`Making ${method} request to ${url}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  /**
   * Get ticket information
   * @param {string|number} ticketId - The ticket ID
   * @returns {Promise<Object>} - The ticket data
   */
  async getTicket(ticketId) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }
    
    return this.request(`/api/v1/tickets/${ticketId}`);
  }

  /**
   * Get time tracking entries for a ticket
   * @param {string|number} ticketId - The ticket ID
   * @returns {Promise<Array>} - The time tracking entries
   */
  async getTimeEntries(ticketId) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }
    
    return this.request(`/api/v1/tickets/${ticketId}/time_accounting`);
  }

  /**
   * Submit time tracking entry
   * @param {string|number} ticketId - The ticket ID
   * @param {number} timeSpent - The time spent in minutes
   * @param {string} comment - Optional comment for the time entry
   * @returns {Promise<Object>} - The response data
   */
  async submitTimeEntry(ticketId, timeSpent, comment = '') {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }
    
    if (!timeSpent || timeSpent <= 0) {
      throw new Error('Time spent must be greater than 0');
    }

    const data = {
      time_unit: timeSpent,
      ticket_id: ticketId
    };
    
    if (comment) {
      data.comment = comment;
    }
    
    return this.request(`/api/v1/time_accountings`, 'POST', data);
  }
}

// Create and export a singleton instance
const zammadApi = new ZammadAPI();

// Make it available globally
window.zammadApi = zammadApi;