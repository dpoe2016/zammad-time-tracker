// Zammad API Service for Time Tracking Extension
// This file handles all communication with the Zammad REST API

class ZammadAPI {
  constructor() {
    this.baseUrl = null;
    this.token = null;
    this.initialized = false;

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
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
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

        // Simple paths (less likely to work)
        `/tickets/${ticketId}`,                      // Simple path
        `/ticket/${ticketId}`,                       // Simple path without 's'

        // Helpdesk variations (least likely to work)
        `/helpdesk/ticket/${ticketId}`,              // Helpdesk path
        `/helpdesk/tickets/${ticketId}`,             // Helpdesk with 's'
        `/helpdesk/api/ticket/${ticketId}`,          // Helpdesk with api
        `/helpdesk/api/tickets/${ticketId}`,         // Helpdesk with api and 's'
        `/api/helpdesk/ticket/${ticketId}`,          // API with helpdesk
        `/api/helpdesk/tickets/${ticketId}`          // API with helpdesk and 's'
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

        // Zammad prefix variations (less likely to work)
        `/zammad/api/tickets/${ticketId}`,         // With zammad prefix
        `/zammad/api/ticket/${ticketId}`,          // With zammad prefix, no 's'

        // Helpdesk variations (least likely to work)
        `/helpdesk/tickets/${ticketId}`,           // Helpdesk prefix
        `/helpdesk/ticket/${ticketId}`,            // Helpdesk prefix, no 's'
        `/helpdesk/api/tickets/${ticketId}`,       // Helpdesk with api path
        `/helpdesk/api/ticket/${ticketId}`,        // Helpdesk with api path, no 's'
        `/api/helpdesk/tickets/${ticketId}`,       // API with helpdesk path
        `/api/helpdesk/ticket/${ticketId}`         // API with helpdesk path, no 's'
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
        // Official Zammad API endpoints for ticket numbers
        `/api/v1/tickets/search?number=${ticketId}&expand=true`,   // Official: Search by number with expand
        `/api/v1/tickets/search?number=${ticketId}`,               // Official: Search by number

        // Time accounting endpoints with ticket number
        `/api/v1/tickets/by_number/${ticketId}/time_accounting`,   // Official: By number endpoint

        // Alternative official endpoints
        `/api/v1/time_accounting?ticket_number=${ticketId}`,       // Query with number

        // Legacy and alternative endpoints
        `/api/v1/ticket/by_number/${ticketId}/time_accounting`,    // By number without 's'
        `/api/v1/time_accountings?ticket_number=${ticketId}`,      // Query with number and 's'
        `/api/v1/time_accounting?number=${ticketId}`,              // Simple query with number
        `/api/v1/time_accountings?number=${ticketId}`,             // Simple query with number and 's'
        `/api/v1/time_accounting?ticket_id=${ticketId}`,           // Try standard query anyway

        // Standard endpoints
        `/api/v1/tickets/${ticketId}/time_accounting`,             // Try standard anyway
        `/api/v1/ticket/${ticketId}/time_accounting`,              // Standard without 's'

        // Simple paths (less likely to work)
        `/tickets/${ticketId}/time_accounting`,                    // Simple path
        `/ticket/${ticketId}/time_accounting`,                     // Simple path without 's'

        // Alternative naming
        `/api/v1/ticket_time_accounting?ticket_number=${ticketId}`, // Alternative naming with query
        `/api/v1/ticket_time_accountings?ticket_number=${ticketId}`, // Alternative naming with 's' and query

        // Without version
        `/api/ticket/${ticketId}/time_accounting`,                 // Without version
        `/api/tickets/${ticketId}/time_accounting`,                // Without version with 's'

        // Helpdesk variations (least likely to work)
        `/helpdesk/ticket/${ticketId}/time_accounting`,            // Helpdesk path
        `/helpdesk/tickets/${ticketId}/time_accounting`,           // Helpdesk with 's'
        `/helpdesk/api/ticket/${ticketId}/time_accounting`,        // Helpdesk with api
        `/helpdesk/api/tickets/${ticketId}/time_accounting`,       // Helpdesk with api and 's'
        `/api/helpdesk/ticket/${ticketId}/time_accounting`,        // API with helpdesk
        `/api/helpdesk/tickets/${ticketId}/time_accounting`        // API with helpdesk and 's'
      ];
    } else {
      // Standard endpoints for ticket IDs
      endpoints = [
        // Official Zammad API endpoints for ticket IDs
        `/api/v1/tickets/${ticketId}/time_accounting`,             // Official: Standard endpoint

        // Alternative official endpoints
        `/api/v1/time_accounting?ticket_id=${ticketId}`,           // Official: Query parameter

        // Legacy and alternative endpoints
        `/api/v1/ticket/${ticketId}/time_accounting`,              // Without 's' in 'tickets'
        `/api/v1/time_accountings?ticket_id=${ticketId}`,          // With 's' and query

        // Version variations
        `/api/v1.0/tickets/${ticketId}/time_accounting`,           // Explicit v1.0 version
        `/api/v1.0/ticket/${ticketId}/time_accounting`,            // v1.0 without 's'
        `/api/v1.0/time_accounting?ticket_id=${ticketId}`,         // v1.0 with query

        // Simple paths (less likely to work)
        `/tickets/${ticketId}/time_accounting`,                    // Different base path
        `/ticket/${ticketId}/time_accounting`,                     // Simple path
        `/api/tickets/${ticketId}/time_accounting`,                // Without version
        `/time_accounting?ticket_id=${ticketId}`,                  // Simple with query

        // Alternative naming
        `/api/v1/ticket_time_accounting?ticket_id=${ticketId}`,    // Alternative naming with query
        `/api/v1/ticket_time_accountings?ticket_id=${ticketId}`,   // Alternative naming with 's' and query
        `/api/v1/ticket_time_accounting/${ticketId}`,              // Alternative naming
        `/api/v1/ticket_time_accountings/${ticketId}`,             // Alternative naming with 's'

        // Without version
        `/api/ticket_time_accounting/${ticketId}`,                 // Without version
        `/api/ticket_time_accountings/${ticketId}`,                // Without version with 's'
        `/api/time_accounting/ticket/${ticketId}`,                 // Alternative path structure
        `/api/time_accounting/tickets/${ticketId}`,                // Alternative with 's'

        // Simple alternatives
        `/ticket_time_accounting/${ticketId}`,                     // Simple alternative
        `/ticket_time_accountings/${ticketId}`,                    // Simple alternative with 's'

        // Zammad prefix variations (less likely to work)
        `/zammad/api/tickets/${ticketId}/time_accounting`,         // With zammad prefix
        `/zammad/api/ticket/${ticketId}/time_accounting`,          // With zammad prefix, no 's'

        // Helpdesk variations (least likely to work)
        `/helpdesk/tickets/${ticketId}/time_accounting`,           // Helpdesk prefix
        `/helpdesk/ticket/${ticketId}/time_accounting`,            // Helpdesk prefix, no 's'
        `/helpdesk/api/tickets/${ticketId}/time_accounting`,       // Helpdesk with api path
        `/helpdesk/api/ticket/${ticketId}/time_accounting`,        // Helpdesk with api path, no 's'
        `/api/helpdesk/tickets/${ticketId}/time_accounting`,       // API with helpdesk path
        `/api/helpdesk/ticket/${ticketId}/time_accounting`         // API with helpdesk path, no 's'
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
        `/api/v1/time_accounting`,                               // Official: Standard endpoint

        // Alternative official endpoints
        `/api/v1/tickets/by_number/${ticketId}/time_accounting`, // Official: By number endpoint

        // Legacy and alternative endpoints
        `/api/v1/time_accountings`,                              // With 's'
        `/api/v1/ticket/by_number/${ticketId}/time_accounting`,  // By number without 's'

        // Standard ticket-specific endpoints
        `/api/v1/tickets/${ticketId}/time_accounting`,           // Standard ticket-specific
        `/api/v1/ticket/${ticketId}/time_accounting`,            // Without 's'

        // Simple paths (less likely to work)
        `/time_accounting`,                                      // Simple path
        `/time_accountings`,                                     // Simple with 's'
        `/tickets/${ticketId}/time_accounting`,                  // Simple ticket-specific
        `/ticket/${ticketId}/time_accounting`,                   // Simple without 's'

        // Alternative naming
        `/api/v1/ticket_time_accounting`,                        // Alternative naming
        `/api/v1/ticket_time_accountings`,                       // Alternative naming with 's'

        // Without version
        `/api/time_accounting`,                                  // Without version
        `/api/time_accountings`,                                 // Without version with 's'
        `/api/ticket/${ticketId}/time_accounting`,               // Without version
        `/api/tickets/${ticketId}/time_accounting`,              // Without version with 's'

        // Zammad prefix variations (less likely to work)
        `/zammad/api/time_accounting`,                           // Zammad prefix
        `/zammad/api/time_accountings`,                          // Zammad with 's'
        `/zammad/api/ticket/${ticketId}/time_accounting`,        // Zammad ticket-specific
        `/zammad/api/tickets/${ticketId}/time_accounting`,       // Zammad ticket-specific with 's'

        // Alternative path structures
        `/api/time_accounting/ticket/${ticketId}`,               // Alternative path structure
        `/api/time_accounting/tickets/${ticketId}`,              // Alternative with 's'
        `/api/v1/ticket_time_accounting/${ticketId}`,            // Alternative naming with ID
        `/api/v1/ticket_time_accountings/${ticketId}`,           // Alternative naming with 's' and ID
        `/api/ticket_time_accounting/${ticketId}`,               // Without version with ID
        `/api/ticket_time_accountings/${ticketId}`,              // Without version with 's' and ID
        `/ticket_time_accounting/${ticketId}`,                   // Simple alternative with ID
        `/ticket_time_accountings/${ticketId}`,                  // Simple alternative with 's' and ID

        // Helpdesk variations (least likely to work)
        `/helpdesk/time_accounting`,                             // Helpdesk prefix
        `/helpdesk/time_accountings`,                            // Helpdesk with 's'
        `/helpdesk/ticket/${ticketId}/time_accounting`,          // Helpdesk path
        `/helpdesk/tickets/${ticketId}/time_accounting`,         // Helpdesk with 's'
        `/helpdesk/api/ticket/${ticketId}/time_accounting`,      // Helpdesk with api
        `/helpdesk/api/tickets/${ticketId}/time_accounting`,     // Helpdesk with api and 's'
        `/api/helpdesk/ticket/${ticketId}/time_accounting`,      // API with helpdesk
        `/api/helpdesk/tickets/${ticketId}/time_accounting`      // API with helpdesk and 's'
      ];
    } else {
      // Standard endpoints for ticket IDs
      endpoints = [
        // Official Zammad API endpoints for time accounting
        `/api/v1/time_accounting`,                               // Official: Standard endpoint

        // Alternative official endpoints
        `/api/v1/tickets/${ticketId}/time_accounting`,           // Official: Ticket-specific endpoint

        // Legacy and alternative endpoints
        `/api/v1/time_accountings`,                              // With 's'
        `/api/v1/ticket/${ticketId}/time_accounting`,            // Without 's'

        // Version variations
        `/api/v1.0/time_accounting`,                             // Explicit v1.0 version
        `/api/v1.0/time_accountings`,                            // v1.0 with 's'
        `/api/v1.0/tickets/${ticketId}/time_accounting`,         // v1.0 ticket-specific
        `/api/v1.0/ticket/${ticketId}/time_accounting`,          // v1.0 without 's'

        // Simple paths (less likely to work)
        `/time_accounting`,                                      // Simple path
        `/time_accountings`,                                     // Different base path
        `/tickets/${ticketId}/time_accounting`,                  // Simple ticket-specific
        `/ticket/${ticketId}/time_accounting`,                   // Simple without 's'

        // Without version
        `/api/time_accounting`,                                  // Without version
        `/api/time_accountings`,                                 // Without version with 's'
        `/api/tickets/${ticketId}/time_accounting`,              // Without version with 's'

        // Alternative naming
        `/api/v1/ticket_time_accounting`,                        // Alternative naming
        `/api/v1/ticket_time_accountings`,                       // Alternative naming with 's'

        // Alternative path structures
        `/api/time_accounting/ticket/${ticketId}`,               // Alternative path structure
        `/api/time_accounting/tickets/${ticketId}`,              // Alternative with 's'
        `/api/v1/ticket_time_accounting/${ticketId}`,            // Alternative naming with ID
        `/api/v1/ticket_time_accountings/${ticketId}`,           // Alternative naming with 's' and ID
        `/api/ticket_time_accounting/${ticketId}`,               // Without version with ID
        `/api/ticket_time_accountings/${ticketId}`,              // Without version with 's' and ID
        `/ticket_time_accounting/${ticketId}`,                   // Simple alternative with ID
        `/ticket_time_accountings/${ticketId}`,                  // Simple alternative with 's' and ID

        // Zammad prefix variations (less likely to work)
        `/zammad/api/time_accountings`,                          // With zammad prefix
        `/zammad/api/time_accounting`,                           // With zammad prefix, no 's'
        `/zammad/api/tickets/${ticketId}/time_accounting`,       // Zammad prefix ticket-specific
        `/zammad/api/ticket/${ticketId}/time_accounting`,        // Zammad prefix ticket-specific, no 's'

        // Helpdesk variations (least likely to work)
        `/helpdesk/time_accountings`,                            // Helpdesk prefix
        `/helpdesk/time_accounting`,                             // Helpdesk prefix, no 's'
        `/helpdesk/tickets/${ticketId}/time_accounting`,         // Helpdesk ticket-specific
        `/helpdesk/ticket/${ticketId}/time_accounting`,          // Helpdesk ticket-specific, no 's'
        `/helpdesk/api/tickets/${ticketId}/time_accounting`,     // Helpdesk with api path
        `/helpdesk/api/ticket/${ticketId}/time_accounting`,      // Helpdesk with api path, no 's'
        `/api/helpdesk/tickets/${ticketId}/time_accounting`,     // API with helpdesk path
        `/api/helpdesk/ticket/${ticketId}/time_accounting`       // API with helpdesk path, no 's'
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
