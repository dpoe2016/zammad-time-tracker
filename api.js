// Zammad API Service for Time Tracking Extension
// This file handles all communication with the Zammad REST API

class ZammadAPI {
  constructor() {
    this.baseUrl = null;
    this.token = null;
    this.initialized = false;
    this.csrfToken = null;

    // Cache for successful endpoints
    this.successfulEndpoints = {
      ticket: null,
      timeEntries: null,
      timeSubmission: null
    };

    // Load cached endpoints from storage
    this.loadCachedEndpoints();
  }

  /**
   * Load cached endpoints from storage
   */
  async loadCachedEndpoints() {
    try {
      const result = await chrome.storage.local.get(['zammadApiEndpoints']);
      if (result.zammadApiEndpoints) {
        this.successfulEndpoints = result.zammadApiEndpoints;
        console.log('Loaded cached API endpoints:', this.successfulEndpoints);
      }
    } catch (error) {
      console.error('Error loading cached endpoints:', error);
    }
  }

  /**
   * Save cached endpoints to storage
   */
  async saveCachedEndpoints() {
    try {
      await chrome.storage.local.set({ zammadApiEndpoints: this.successfulEndpoints });
      console.log('Saved API endpoints to cache:', this.successfulEndpoints);
    } catch (error) {
      console.error('Error saving cached endpoints:', error);
    }
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
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // If the base URL has changed, clear cached endpoints
    if (this.baseUrl !== normalizedBaseUrl) {
      console.log('Base URL changed, clearing cached endpoints');
      this.successfulEndpoints = {
        ticket: null,
        timeEntries: null,
        timeSubmission: null
      };
      // Save the cleared cache
      this.saveCachedEndpoints();
    }

    this.baseUrl = normalizedBaseUrl;
    this.token = token;
    this.initialized = true;

    // Fetch CSRF token
    this.fetchCsrfToken();

    console.log('Zammad API initialized with base URL:', this.baseUrl);
    return true;
  }

  /**
   * Fetch CSRF token from cookies
   * @returns {Promise<string|null>} - The CSRF token or null if not found
   */
  async fetchCsrfToken() {
    try {
      console.log('Fetching CSRF token...');

      // Try to get CSRF token from cookies
      const cookies = await chrome.cookies.getAll({ url: this.baseUrl });
      const csrfCookie = cookies.find(cookie => 
        cookie.name === '_csrf_token' || 
        cookie.name === 'CSRF-Token' || 
        cookie.name.toLowerCase().includes('csrf')
      );

      if (csrfCookie) {
        this.csrfToken = csrfCookie.value;
        console.log('CSRF token found in cookies:', this.csrfToken);
        return this.csrfToken;
      }

      // If not found in cookies, try to fetch it from the server
      console.log('CSRF token not found in cookies, trying to fetch from server...');

      // Make a GET request to the base URL to get the CSRF token from response headers
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        credentials: 'include'
      });

      // Check response headers for CSRF token
      const csrfHeader = response.headers.get('X-CSRF-Token') || 
                         response.headers.get('X-CSRF-TOKEN') || 
                         response.headers.get('CSRF-Token');

      if (csrfHeader) {
        this.csrfToken = csrfHeader;
        console.log('CSRF token found in response headers:', this.csrfToken);
        return this.csrfToken;
      }

      console.warn('Could not find CSRF token');
      return null;
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      return null;
    }
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

      // Check if URL contains /helpdesk/ path which might indicate a specific Zammad instance setup
      if (url.includes('/helpdesk/')) {
        console.log('Detected /helpdesk/ in URL, this might be a specialized Zammad instance');
      }

      // Always return just the protocol and hostname as the base URL
      // The specific paths will be handled by the endpoint patterns
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

    // Special handling for helpdesk URLs
    // If the endpoint contains /helpdesk/ and the base URL doesn't already include it
    if (endpoint.includes('/helpdesk/') && !this.baseUrl.includes('/helpdesk')) {
      console.log('Endpoint contains /helpdesk/ path, adjusting request URL');
      // We'll keep the /helpdesk/ in the endpoint and use it as is
    }

    const url = `${this.baseUrl}${endpoint}`;

    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token token=${this.token}`
      },
      credentials: 'include' // Include cookies in the request
    };

    // Add CSRF token to headers for POST and PUT requests
    if ((method === 'POST' || method === 'PUT')) {
      // If we don't have a CSRF token yet, try to fetch it
      if (!this.csrfToken) {
        await this.fetchCsrfToken();
      }

      // Add CSRF token to headers if available
      if (this.csrfToken) {
        options.headers['X-CSRF-Token'] = this.csrfToken;
      } else {
        console.warn('Making POST/PUT request without CSRF token, this might fail');
      }

      // Add body data if provided
      if (data) {
        options.body = JSON.stringify(data);
      }
    }

    try {
      console.log(`Making ${method} request to ${url}`);

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      options.signal = controller.signal;

      const response = await fetch(url, options);

      // Clear timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to get more detailed error information
        let errorDetails = '';
        try {
          const errorJson = await response.json();
          errorDetails = JSON.stringify(errorJson);
        } catch (e) {
          // If we can't parse JSON, try to get text
          try {
            errorDetails = await response.text();
          } catch (e2) {
            errorDetails = 'No error details available';
          }
        }

        throw new Error(`API request failed: ${response.status} ${response.statusText}. URL: ${url}. Details: ${errorDetails}`);
      }

      return await response.json();
    } catch (error) {
      // Enhance error with URL information
      const enhancedError = new Error(`${error.message} (URL: ${url})`);
      enhancedError.originalError = error;
      enhancedError.url = url;
      enhancedError.method = method;

      console.error('API request error:', enhancedError);
      throw enhancedError;
    }
  }

  /**
   * Get ticket information
   * @param {string|number} ticketId - The ticket ID or number
   * @returns {Promise<Object>} - The ticket data
   */
  async getTicket(ticketId) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    // Check if this is a ticket number (usually longer) or a ticket ID (usually shorter)
    const isLikelyTicketNumber = ticketId.toString().length > 10;
    console.log(`Ticket identifier ${ticketId} is likely a ${isLikelyTicketNumber ? 'ticket number' : 'ticket ID'}`);

    // If we have a successful endpoint cached, try it first
    if (this.successfulEndpoints.ticket) {
      try {
        console.log(`Using cached successful endpoint: ${this.successfulEndpoints.ticket}`);
        const endpoint = this.successfulEndpoints.ticket.replace('{ticketId}', ticketId);
        return await this.request(endpoint);
      } catch (error) {
        console.error('Cached endpoint failed, will try alternatives:', error);
        // Clear the cache if it fails
        this.successfulEndpoints.ticket = null;
      }
    }

    // Define endpoint patterns based on whether this is likely a ticket number or ID
    let endpoints = [];

    if (isLikelyTicketNumber) {
      // Prioritize endpoints that work well with ticket numbers
      endpoints = [
        // Official Zammad API endpoints for ticket numbers
        `/api/v1/tickets/search?number=${ticketId}`, // Official: Search by number
        `/api/v1/tickets/by_number/${ticketId}`,     // Official: By number endpoint

        // Alternative official endpoints
        `/api/v1/tickets?number=${ticketId}`,        // Query parameter

        // Legacy and alternative endpoints
        `/api/v1/ticket/by_number/${ticketId}`,      // by_number without 's'
        `/api/v1/tickets/number/${ticketId}`,        // Alternative number endpoint
        `/api/v1/ticket/number/${ticketId}`,         // Alternative without 's'
        `/api/v1/tickets/${ticketId}`,               // Try standard anyway
        `/api/v1/ticket/${ticketId}`,                // Standard without 's'

      ];
    } else {
      // Standard endpoints for ticket IDs
      endpoints = [
        // Official Zammad API endpoints for ticket IDs
        `/api/v1/tickets/${ticketId}`,             // Official: Standard endpoint

        // Alternative official endpoints
        `/api/v1/ticket_articles?ticket_id=${ticketId}`, // Official: Get ticket articles

        // Legacy and alternative endpoints
        `/api/v1/ticket/${ticketId}`,              // Without 's' in 'tickets'
        `/api/tickets/${ticketId}`,                // Without version
        `/api/v1.0/tickets/${ticketId}`,           // Explicit v1.0 version
        `/api/v1.0/ticket/${ticketId}`,            // v1.0 without 's'

        // Related resources
        `/api/v1/ticket_articles/${ticketId}`,     // Try ticket_articles

        // Simple paths (less likely to work)
        `/tickets/${ticketId}`,                    // Different base path
        `/ticket/${ticketId}`,                     // Simple path
        `/ticket_articles/${ticketId}`,            // Simple ticket_articles path

      ];
    }

    let lastError = null;

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const result = await this.request(endpoint);

        // Cache the successful endpoint pattern for future use
        const pattern = endpoint.replace(ticketId, '{ticketId}');
        this.successfulEndpoints.ticket = pattern;
        console.log(`Cached successful ticket endpoint: ${pattern}`);

        // Save to storage for persistence
        this.saveCachedEndpoints();

        return result;
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error);
        lastError = error;
        // Continue to next endpoint
      }
    }

    // If we get here, all endpoints failed
    console.error('All ticket endpoints failed');
    throw lastError || new Error('Failed to get ticket information');
  }

  /**
   * Get time tracking entries for a ticket
   * @param {string|number} ticketId - The ticket ID or number
   * @returns {Promise<Array>} - The time tracking entries
   */
  async getTimeEntries(ticketId) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    // Check if this is a ticket number (usually longer) or a ticket ID (usually shorter)
    const isLikelyTicketNumber = ticketId.toString().length > 10;
    console.log(`Time entries for ${ticketId} (${isLikelyTicketNumber ? 'ticket number' : 'ticket ID'})`);

    // If we have a successful endpoint cached, try it first
    if (this.successfulEndpoints.timeEntries) {
      try {
        console.log(`Using cached successful time entries endpoint: ${this.successfulEndpoints.timeEntries}`);
        const endpoint = this.successfulEndpoints.timeEntries.replace('{ticketId}', ticketId);
        return await this.request(endpoint);
      } catch (error) {
        console.error('Cached time entries endpoint failed, will try alternatives:', error);
        // Clear the cache if it fails
        this.successfulEndpoints.timeEntries = null;
      }
    }

    // Define endpoint patterns based on whether this is likely a ticket number or ID
    let endpoints = [];

    if (isLikelyTicketNumber) {
      // Prioritize endpoints that work well with ticket numbers
      endpoints = [
        // Standard endpoints
        `/api/v1/tickets/${ticketId}/time_accountings`,             // Try standard anyway
      ];
    } else {
      // Standard endpoints for ticket IDs
      endpoints = [
        // Official Zammad API endpoints for ticket IDs
        `/api/v1/tickets/${ticketId}/time_accountings`,             // Official: Standard endpoint


      ];
    }

    let lastError = null;

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying time entries endpoint: ${endpoint}`);
        const result = await this.request(endpoint);

        // Cache the successful endpoint pattern for future use
        const pattern = endpoint.includes('?') 
          ? endpoint.replace(ticketId, '{ticketId}')
          : endpoint.replace(ticketId, '{ticketId}');
        this.successfulEndpoints.timeEntries = pattern;
        console.log(`Cached successful time entries endpoint: ${pattern}`);

        // Save to storage for persistence
        this.saveCachedEndpoints();

        return result;
      } catch (error) {
        console.error(`Error with time entries endpoint ${endpoint}:`, error);
        lastError = error;
        // Continue to next endpoint
      }
    }

    // If we get here, all endpoints failed
    console.error('All time entries endpoints failed');
    throw lastError || new Error('Failed to get time entries');
  }

  /**
   * Submit time tracking entry
   * @param {string|number} ticketId - The ticket ID or number
   * @param {number} timeSpent - The time spent in minutes
   * @param {string} comment - Optional comment for the time entry
   * @returns {Promise<Object>} - The response data
   */
  async submitTimeEntry(ticketId, timeSpent, comment = '') {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    // Check if this is a ticket number (usually longer) or a ticket ID (usually shorter)
    const isLikelyTicketNumber = ticketId.toString().length > 10;
    console.log(`Submitting time for ${ticketId} (${isLikelyTicketNumber ? 'ticket number' : 'ticket ID'})`);

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

    // If we have a successful endpoint for time entries, try to use the same pattern for submission
    if (this.successfulEndpoints.timeEntries) {
      try {
        console.log(`Using time entries endpoint pattern for submission: ${this.successfulEndpoints.timeEntries}`);
        const endpoint = this.successfulEndpoints.timeEntries.replace('{ticketId}', ticketId);
        return await this.request(endpoint, 'POST', data);
      } catch (error) {
        console.error('Time entries endpoint pattern failed for submission:', error);
        // Continue to other methods
      }
    }

    // If we have a successful endpoint cached, try it next
    if (this.successfulEndpoints.timeSubmission) {
      try {
        console.log(`Using cached successful time submission endpoint: ${this.successfulEndpoints.timeSubmission}`);
        const endpoint = this.successfulEndpoints.timeSubmission.includes('{ticketId}')
          ? this.successfulEndpoints.timeSubmission.replace('{ticketId}', ticketId)
          : this.successfulEndpoints.timeSubmission;
        return await this.request(endpoint, 'POST', data);
      } catch (error) {
        console.error('Cached time submission endpoint failed, will try alternatives:', error);
        // Clear the cache if it fails
        this.successfulEndpoints.timeSubmission = null;
      }
    }

    // Define endpoint patterns based on whether this is likely a ticket number or ID
    let endpoints = [];

    if (isLikelyTicketNumber) {
      // For ticket numbers, we might need to use different endpoints
      // or include the ticket number in a different way
      endpoints = [
        // Official Zammad API endpoints for time accounting
        `/api/tickets/${ticketId}/time_accountings`,

      ];
    } else {
      // Standard endpoints for ticket IDs
      endpoints = [
        // Official Zammad API endpoints for time accounting

        // Alternative official endpoints
        `/api/v1/tickets/${ticketId}/time_accountings`,           // Official: Ticket-specific endpoint

      ];
    }

    let lastError = null;

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying time entry submission endpoint: ${endpoint}`);
        const result = await this.request(endpoint, 'POST', data);

        // Cache the successful endpoint pattern for future use
        const pattern = endpoint.includes(ticketId) 
          ? endpoint.replace(ticketId, '{ticketId}')
          : endpoint;
        this.successfulEndpoints.timeSubmission = pattern;
        console.log(`Cached successful time submission endpoint: ${pattern}`);

        // Save to storage for persistence
        this.saveCachedEndpoints();

        return result;
      } catch (error) {
        console.error(`Error with time entry endpoint ${endpoint}:`, error);
        lastError = error;
        // Continue to next endpoint
      }
    }

    // If we get here, all endpoints failed
    console.error('All time entry submission endpoints failed');
    throw lastError || new Error('Failed to submit time entry');
  }
}

// Create and export a singleton instance
const zammadApi = new ZammadAPI();

// Make it available globally
window.zammadApi = zammadApi;
console.log('Zammad API singleton instance created and available globally');
