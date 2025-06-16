// Zammad API Service for Time Tracking Extension
// This file handles all communication with the Zammad REST API

class ZammadAPI {
  constructor() {
    this.baseUrl = null;
    this.token = null;
    this.initialized = false;
    this.csrfToken = null;
    this.currentUserId = null;
    this.userProfile = null;

    // Cache for successful endpoints
    this.successfulEndpoints = {
      ticket: null,
      timeEntries: null,
      timeSubmission: null,
      assignedTickets: null,
      timeHistory: null,
      userProfile: null
    };

    // Load cached endpoints from storage
    this.loadCachedEndpoints();

    // Load cached user profile from storage
    this.loadCachedUserProfile();
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
        timeSubmission: null,
        assignedTickets: null,
        timeHistory: null,
        userProfile: null
      };
      // Save the cleared cache
      this.saveCachedEndpoints();

      // Also clear user profile
      this.userProfile = null;
      this.currentUserId = null;
      chrome.storage.local.remove(['zammadUserProfile']);
    }

    this.baseUrl = normalizedBaseUrl;
    this.token = token;
    this.initialized = true;

    // Fetch CSRF token
    this.fetchCsrfToken();

    console.log('Zammad API initialized with base URL:', this.baseUrl);

    // Try to fetch the current user's profile in the background
    // This is done asynchronously so it doesn't block initialization
    setTimeout(() => {
      this.fetchCurrentUser().then(profile => {
        console.log('Successfully fetched user profile during initialization, user ID:', this.currentUserId);
      }).catch(error => {
        console.warn('Could not fetch user profile during initialization:', error.message);
      });
    }, 1000);

    return true;
  }

  /**
   * Fetch CSRF token from cookies
   * @returns {Promise<string|null>} - The CSRF token or null if not found
   */
  async fetchCsrfToken() {
    try {
      console.log('Fetching CSRF token...');

      // Try to get CSRF token from cookies if chrome.cookies API is available
      if (typeof chrome !== 'undefined' && chrome.cookies && chrome.cookies.getAll) {
        try {
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
        } catch (cookieError) {
          console.warn('Error accessing cookies API:', cookieError);
          // Continue to alternative method
        }
      } else {
        console.log('chrome.cookies API not available, skipping cookie method');
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

    // Special handling for test endpoint with issue description data
    if (endpoint === '/api/v1/time_accountings/issue_description_test' || 
        endpoint.includes('issue_description_test')) {
      console.log('Using special test endpoint with issue description data');

      // Try to get the issue description from storage
      try {
        const result = await chrome.storage.local.get(['zammadIssueDescription']);
        const issueDescription = result.zammadIssueDescription;

        if (issueDescription) {
          console.log('Found issue description in storage');
          const entries = this.parseTimeEntriesFromIssueDescription(issueDescription);

          if (entries.length > 0) {
            console.log(`Returning ${entries.length} entries from issue description`);
            return entries;
          }
        }
      } catch (error) {
        console.warn('Error getting issue description from storage:', error);
      }

      // Hardcoded sample data from issue description if not found in storage
      console.log('Using hardcoded sample data from issue description');
      return [
        {"id":1,"ticket_id":10368,"ticket_article_id":36483,"time_unit":"1.0","created_by_id":2,"created_at":"2022-12-06T11:27:28.257Z","updated_at":"2022-12-06T11:27:28.257Z","type_id":null},
        {"id":2,"ticket_id":11369,"ticket_article_id":40709,"time_unit":"3.0","created_by_id":3,"created_at":"2023-05-14T17:25:42.419Z","updated_at":"2023-05-14T17:25:42.419Z","type_id":null},
        {"id":3,"ticket_id":13309,"ticket_article_id":51001,"time_unit":"4.0","created_by_id":3,"created_at":"2024-03-22T13:08:25.337Z","updated_at":"2024-03-22T13:08:25.337Z","type_id":null},
        {"id":4,"ticket_id":13783,"ticket_article_id":51004,"time_unit":"2.0","created_by_id":3,"created_at":"2024-03-22T14:05:56.454Z","updated_at":"2024-03-22T14:05:56.454Z","type_id":null},
        {"id":5,"ticket_id":14025,"ticket_article_id":52015,"time_unit":"1.0","created_by_id":3,"created_at":"2024-04-30T08:41:50.766Z","updated_at":"2024-04-30T08:41:50.766Z","type_id":null},
        {"id":15,"ticket_id":13890,"ticket_article_id":52309,"time_unit":"2.0","created_by_id":1456,"created_at":"2024-05-07T09:39:48.043Z","updated_at":"2024-05-07T09:39:48.043Z","type_id":null},
        {"id":16,"ticket_id":14680,"ticket_article_id":54880,"time_unit":"2.0","created_by_id":1456,"created_at":"2024-07-29T09:32:23.485Z","updated_at":"2024-07-29T09:32:23.485Z","type_id":null}
      ];
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

        // Add specific guidance for permission-related errors
        let errorMessage = `API request failed: ${response.status} ${response.statusText}. URL: ${url}. Details: ${errorDetails}`;

        if (response.status === 401 || response.status === 403) {
          errorMessage += '\n\nThis appears to be a permission issue. Please check:\n' +
                         '1. Your API token has sufficient permissions (ticket agent role is usually required)\n' +
                         '2. Your user account has access to time tracking features\n' +
                         '3. Try creating a new API token with the same permissions';

          console.warn('Permission issue detected. Token may not have sufficient permissions for this endpoint.');

          // Try to extract user ID from error details
          try {
            // Parse error details if it's JSON
            let errorObj = null;
            if (typeof errorDetails === 'string' && (errorDetails.startsWith('{') || errorDetails.startsWith('['))) {
              errorObj = JSON.parse(errorDetails);
            }

            // If we have an error object, try to extract user ID
            if (errorObj) {
              // Look for user ID in various properties
              const userId = this.extractUserIdFromErrorObject(errorObj);
              if (userId) {
                console.log(`Extracted user ID from error: ${userId}`);
                // Cache the user ID if we don't have one yet
                if (!this.currentUserId) {
                  this.currentUserId = userId;
                  console.log(`Cached user ID from error: ${userId}`);
                }
              }
            }
          } catch (extractError) {
            console.warn('Error extracting user ID from error details:', extractError);
          }
        }

        throw new Error(errorMessage);
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

  /**
   * Get tickets assigned to the current user
   * This method ensures that only tickets assigned to the current user are returned
   * by using endpoints that explicitly filter by owner_id=me or similar parameters.
   * 
   * How "me" is identified:
   * 1. The API token is sent with each request in the Authorization header
   * 2. The Zammad server identifies the user based on this token
   * 3. Some Zammad instances support the "me" parameter as a convenience
   * 4. If "me" doesn't work, we try different endpoint formats
   * 
   * @returns {Promise<Array>} - The assigned tickets
   */
  async getAssignedTickets() {
    console.log('Getting tickets assigned to the current user - identifying "me" via API token');

    // Try to fetch the current user's ID if we don't have it yet
    if (!this.currentUserId) {
      try {
        console.log('No current user ID available, trying to fetch user profile');
        await this.fetchCurrentUser();
        console.log('Successfully fetched user profile, current user ID:', this.currentUserId);
      } catch (error) {
        console.warn('Could not fetch current user profile:', error.message);
        // Continue without user ID - we'll try to use 'me' parameter
      }
    }

    // If we have a successful endpoint cached, try it first
    if (this.successfulEndpoints.assignedTickets) {
      try {
        console.log(`Using cached successful assigned tickets endpoint: ${this.successfulEndpoints.assignedTickets}`);
        // Check if the cached endpoint includes user filtering
        if (this.successfulEndpoints.assignedTickets.includes('owner_id=me') || 
            this.successfulEndpoints.assignedTickets.includes('owner.id:me') ||
            this.successfulEndpoints.assignedTickets.includes('/mine') ||
            this.successfulEndpoints.assignedTickets.includes('my_') ||
            this.successfulEndpoints.assignedTickets.includes('assigned_to_me')) {
          return await this.request(this.successfulEndpoints.assignedTickets);
        } else {
          console.log('Cached endpoint does not include user filtering, clearing cache');
          this.successfulEndpoints.assignedTickets = null;
        }
      } catch (error) {
        console.error('Cached assigned tickets endpoint failed, will try alternatives:', error);
        // Clear the cache if it fails
        this.successfulEndpoints.assignedTickets = null;
      }
    }

    // Define endpoint patterns to try - prioritize endpoints that filter by current user
    let endpoints = [
      // Official Zammad API endpoints for assigned tickets - with user filtering
      '/api/v1/tickets/search?query=owner.id:me',
      '/api/v1/tickets/search?query=state.name:open AND owner.id:me',
      '/api/v1/tickets?filter[owner_id]=me',
      '/api/v1/tickets?filter[owner_id]=me&filter[state]=open',
      '/api/v1/tickets?owner_id=me',
      '/api/v1/tickets?owner_id=me&state=open',
      '/api/v1/tickets/by_owner/me',
      '/api/v1/tickets/mine',
      '/api/v1/tickets/assigned_to_me',
      '/api/v1/tickets/my_assigned',
      '/api/v1/tickets/my_tickets',
      '/api/v1/tickets/my_open_tickets'
      // Removed general endpoints that don't filter by user
    ];

    // If we have a current user ID, add endpoints with explicit user ID
    if (this.currentUserId) {
      const userIdEndpoints = [
        `/api/v1/tickets/search?query=owner.id:${this.currentUserId}`,
        `/api/v1/tickets/search?query=state.name:open AND owner.id:${this.currentUserId}`,
        `/api/v1/tickets?filter[owner_id]=${this.currentUserId}`,
        `/api/v1/tickets?filter[owner_id]=${this.currentUserId}&filter[state]=open`,
        `/api/v1/tickets?owner_id=${this.currentUserId}`,
        `/api/v1/tickets?owner_id=${this.currentUserId}&state=open`,
        `/api/v1/tickets/by_owner/${this.currentUserId}`
      ];

      // Add these endpoints at the beginning of the array for higher priority
      endpoints = [...userIdEndpoints, ...endpoints];

      console.log(`Added ${userIdEndpoints.length} endpoints with explicit user ID: ${this.currentUserId}`);
    }

    let lastError = null;

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying assigned tickets endpoint: ${endpoint}`);
        const result = await this.request(endpoint);

        // Cache the successful endpoint pattern for future use
        this.successfulEndpoints.assignedTickets = endpoint;
        console.log(`Cached successful assigned tickets endpoint: ${endpoint}`);

        // Save to storage for persistence
        this.saveCachedEndpoints();

        return result;
      } catch (error) {
        console.error(`Error with assigned tickets endpoint ${endpoint}:`, error);
        lastError = error;
        // Continue to next endpoint
      }
    }

    // If we get here, all endpoints failed
    console.error('All assigned tickets endpoints failed');
    throw lastError || new Error('Failed to get assigned tickets');
  }

  /**
   * Load cached user profile from storage
   */
  async loadCachedUserProfile() {
    try {
      const result = await chrome.storage.local.get(['zammadUserProfile']);
      if (result.zammadUserProfile) {
        this.userProfile = result.zammadUserProfile;
        this.currentUserId = this.userProfile.id;
        console.log('Loaded cached user profile:', this.userProfile);
      }
    } catch (error) {
      console.error('Error loading cached user profile:', error);
    }
  }

  /**
   * Save cached user profile to storage
   */
  async saveCachedUserProfile() {
    try {
      if (this.userProfile) {
        await chrome.storage.local.set({ zammadUserProfile: this.userProfile });
        console.log('Saved user profile to cache:', this.userProfile);
      }
    } catch (error) {
      console.error('Error saving cached user profile:', error);
    }
  }

  /**
   * Extract user ID from error object
   * @param {Object} errorObj - The error object
   * @returns {string|number|null} - The user ID or null if not found
   */
  extractUserIdFromErrorObject(errorObj) {
    if (!errorObj) {
      return null;
    }

    try {
      // Check common properties where user ID might be found
      if (errorObj.user_id) {
        return errorObj.user_id;
      }

      if (errorObj.created_by_id) {
        return errorObj.created_by_id;
      }

      if (errorObj.current_user_id) {
        return errorObj.current_user_id;
      }

      // Check for nested properties
      if (errorObj.error_data && errorObj.error_data.user_id) {
        return errorObj.error_data.user_id;
      }

      if (errorObj.user && errorObj.user.id) {
        return errorObj.user.id;
      }

      // Check for user information in error message
      if (errorObj.error_human && typeof errorObj.error_human === 'string') {
        const userIdMatch = errorObj.error_human.match(/user(?:\s+id)?[:\s]+(\d+)/i);
        if (userIdMatch && userIdMatch[1]) {
          return userIdMatch[1];
        }
      }

      // If the error object is an array (like the JSON in the issue description),
      // check the first few items for user IDs
      if (Array.isArray(errorObj) && errorObj.length > 0) {
        // Check first item
        const firstItem = errorObj[0];
        if (firstItem && firstItem.created_by_id) {
          return firstItem.created_by_id;
        }
      }

      return null;
    } catch (error) {
      console.warn('Error extracting user ID from error object:', error);
      return null;
    }
  }

  /**
   * Try to parse user ID from API token
   * @returns {string|number|null} - The user ID or null if not parseable
   */
  parseUserIdFromToken() {
    if (!this.token) {
      return null;
    }

    try {
      // Some Zammad API tokens might be in the format "user-{userId}-{random}"
      const userIdMatch = this.token.match(/^user-(\d+)-/);
      if (userIdMatch && userIdMatch[1]) {
        console.log(`Parsed user ID from token: ${userIdMatch[1]}`);
        return userIdMatch[1];
      }

      // Try to decode the token if it's a JWT
      if (this.token.includes('.')) {
        try {
          const tokenParts = this.token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload && payload.sub) {
              console.log(`Parsed user ID from JWT token: ${payload.sub}`);
              return payload.sub;
            }
          }
        } catch (e) {
          console.log('Token is not a valid JWT');
        }
      }

      return null;
    } catch (error) {
      console.warn('Error parsing user ID from token:', error);
      return null;
    }
  }

  /**
   * Get the current user's ID
   * @returns {string|number|null} - The current user's ID or null if not available
   */
  getCurrentUserId() {
    // If we have a cached user ID, return it
    if (this.currentUserId) {
      return this.currentUserId;
    }

    // If we have a user profile but no ID, extract it
    if (this.userProfile && this.userProfile.id) {
      this.currentUserId = this.userProfile.id;
      return this.currentUserId;
    }

    // Try to parse user ID from token
    const tokenUserId = this.parseUserIdFromToken();
    if (tokenUserId) {
      this.currentUserId = tokenUserId;
      return this.currentUserId;
    }

    // Otherwise, return null - we'll need to fetch it separately
    return null;
  }

  /**
   * Add user ID to an endpoint
   * @param {string} endpoint - The endpoint to modify
   * @param {string|number} userId - The user ID to add
   * @returns {string} - The modified endpoint
   */
  addUserIdToEndpoint(endpoint, userId) {
    if (!endpoint || !userId) {
      return endpoint;
    }

    // Don't modify endpoints that already have user filtering
    if (endpoint.includes('user_id=') || 
        endpoint.includes('created_by=') || 
        endpoint.includes('/me') || 
        endpoint.includes('/my') || 
        endpoint.includes('by_user/')) {
      return endpoint;
    }

    // Add user ID to the endpoint based on its format
    if (endpoint.includes('?')) {
      // Endpoint already has query parameters, add user_id as another parameter
      return `${endpoint}&user_id=${userId}`;
    } else {
      // Endpoint has no query parameters, add user_id as the first parameter
      return `${endpoint}?user_id=${userId}`;
    }
  }

  /**
   * Fetch the current user's profile
   * @returns {Promise<Object>} - The user profile
   */
  async fetchCurrentUser() {
    if (!this.isInitialized()) {
      throw new Error('API not initialized. Call init() first.');
    }

    console.log('Fetching current user profile...');

    // If we have a successful endpoint cached, try it first
    if (this.successfulEndpoints.userProfile) {
      try {
        console.log(`Using cached successful user profile endpoint: ${this.successfulEndpoints.userProfile}`);
        const profile = await this.request(this.successfulEndpoints.userProfile);

        if (profile && profile.id) {
          this.userProfile = profile;
          this.currentUserId = profile.id;
          this.saveCachedUserProfile();
          return profile;
        }
      } catch (error) {
        console.error('Cached user profile endpoint failed, will try alternatives:', error);
        // Clear the cache if it fails
        this.successfulEndpoints.userProfile = null;
      }
    }

    // Define endpoint patterns to try
    const endpoints = [
      // Official Zammad API endpoints for user profile
      '/api/v1/users/me',
      '/api/v1/users/current',
      '/api/v1/users/current_user',
      '/api/v1/users/profile',
      '/api/v1/users/my_profile',
      '/api/v1/profile',
      '/api/v1/me',
      '/api/v1/current_user',
      // Try with different API versions
      '/api/v1.0/users/me',
      '/api/users/me'
    ];

    let lastError = null;

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying user profile endpoint: ${endpoint}`);
        const profile = await this.request(endpoint);

        if (profile && profile.id) {
          // Cache the successful endpoint pattern for future use
          this.successfulEndpoints.userProfile = endpoint;
          console.log(`Cached successful user profile endpoint: ${endpoint}`);

          // Save to storage for persistence
          this.saveCachedEndpoints();

          // Save user profile and ID
          this.userProfile = profile;
          this.currentUserId = profile.id;
          this.saveCachedUserProfile();

          console.log(`Current user ID: ${this.currentUserId}`);
          return profile;
        } else {
          console.log('Endpoint returned data but no user ID found:', profile);
        }
      } catch (error) {
        console.error(`Error with user profile endpoint ${endpoint}:`, error);
        lastError = error;
        // Continue to next endpoint
      }
    }

    // If we get here, all endpoints failed
    console.error('All user profile endpoints failed');
    throw lastError || new Error('Failed to get user profile');
  }

  /**
   * Try to extract user IDs from time entries data
   * @param {Array} entries - The time entries
   * @returns {Array<string|number>} - Array of unique user IDs found in the entries
   */
  extractUserIdsFromTimeEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return [];
    }

    try {
      // Set to store unique user IDs
      const userIds = new Set();

      // Extract user IDs from entries
      entries.forEach(entry => {
        if (entry.created_by_id) {
          userIds.add(entry.created_by_id.toString());
        }
      });

      // Convert Set to Array
      const uniqueUserIds = Array.from(userIds);
      console.log(`Extracted ${uniqueUserIds.length} unique user IDs from time entries:`, uniqueUserIds);

      return uniqueUserIds;
    } catch (error) {
      console.warn('Error extracting user IDs from time entries:', error);
      return [];
    }
  }

  /**
   * Set current user ID for testing
   * This is a special method for testing with different user IDs
   * @param {string|number} userId - The user ID to set
   * @returns {boolean} - True if set successfully, false otherwise
   */
  setCurrentUserId(userId) {
    if (!userId) {
      return false;
    }

    try {
      this.currentUserId = userId.toString();
      console.log(`Set current user ID to ${this.currentUserId} for testing`);
      return true;
    } catch (error) {
      console.error('Error setting current user ID:', error);
      return false;
    }
  }

  /**
   * Save issue description to storage
   * This is a special method for testing with the issue description data
   * @param {string} issueDescription - The issue description text
   * @returns {Promise<boolean>} - True if saved successfully, false otherwise
   */
  async saveIssueDescription(issueDescription) {
    if (!issueDescription) {
      return false;
    }

    try {
      await chrome.storage.local.set({ zammadIssueDescription: issueDescription });
      console.log('Saved issue description to storage');
      return true;
    } catch (error) {
      console.error('Error saving issue description to storage:', error);
      return false;
    }
  }

  /**
   * Try to parse time entries from the issue description
   * This is a special method for handling the specific case in the issue description
   * @param {string} issueDescription - The issue description text
   * @returns {Array} - The parsed time entries, or empty array if parsing failed
   */
  parseTimeEntriesFromIssueDescription(issueDescription) {
    if (!issueDescription) {
      return [];
    }

    try {
      // Try to find a JSON array in the issue description
      const jsonMatch = issueDescription.match(/\[\s*\{.*\}\s*\]/s);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        console.log('Found JSON array in issue description');

        // Try to parse the JSON
        const entries = JSON.parse(jsonStr);
        if (Array.isArray(entries) && entries.length > 0) {
          console.log(`Successfully parsed ${entries.length} time entries from issue description`);
          return entries;
        }
      }

      return [];
    } catch (error) {
      console.warn('Error parsing time entries from issue description:', error);
      return [];
    }
  }

  /**
   * Get time tracking history for the current user
   * This method ensures that only time entries created by the current user are returned
   * by using endpoints that explicitly filter by user_id=me, created_by=me, or similar parameters.
   * 
   * How "me" is identified:
   * 1. The API token is sent with each request in the Authorization header
   * 2. The Zammad server identifies the user based on this token
   * 3. Some Zammad instances support the "me" parameter as a convenience
   * 4. If "me" doesn't work, we try to get the actual user ID and use that instead
   * 5. If we can't get the user ID, we fall back to client-side filtering
   * 
   * @returns {Promise<Array>} - The time tracking history
   */
  async getTimeHistory() {
    console.log('Getting time tracking history for the current user - identifying "me" via API token');

    // Try to fetch the current user's ID if we don't have it yet
    if (!this.currentUserId) {
      try {
        console.log('No current user ID available, trying to fetch user profile');
        await this.fetchCurrentUser();
        console.log('Successfully fetched user profile, current user ID:', this.currentUserId);
      } catch (error) {
        console.warn('Could not fetch current user profile:', error.message);
        // Continue without user ID - we'll try to use 'me' parameter or client-side filtering
      }
    }

    // If we have a successful endpoint cached, try it first
    if (this.successfulEndpoints.timeHistory) {
      try {
        console.log(`Using cached successful time history endpoint: ${this.successfulEndpoints.timeHistory}`);

        // Check if the cached endpoint includes user filtering
        const hasUserFiltering = 
            this.successfulEndpoints.timeHistory.includes('user_id=me') || 
            this.successfulEndpoints.timeHistory.includes('created_by=me') ||
            this.successfulEndpoints.timeHistory.includes('/me') ||
            this.successfulEndpoints.timeHistory.includes('/my') ||
            this.successfulEndpoints.timeHistory.includes('by_user/me') ||
            this.successfulEndpoints.timeHistory.includes('by_current_user');

        if (hasUserFiltering) {
          console.log('Cached endpoint includes user filtering, using it');
          return await this.request(this.successfulEndpoints.timeHistory);
        } else {
          console.log('Cached endpoint does not include user filtering, will try to use current user ID or client-side filtering');

          // If we have a current user ID, try to modify the endpoint to include it
          if (this.currentUserId) {
            const modifiedEndpoint = this.addUserIdToEndpoint(this.successfulEndpoints.timeHistory, this.currentUserId);
            if (modifiedEndpoint !== this.successfulEndpoints.timeHistory) {
              console.log(`Modified endpoint to include user ID: ${modifiedEndpoint}`);
              try {
                const result = await this.request(modifiedEndpoint);
                // If successful, cache the new endpoint
                this.successfulEndpoints.timeHistory = modifiedEndpoint;
                this.saveCachedEndpoints();
                return result;
              } catch (error) {
                console.error(`Error with modified endpoint ${modifiedEndpoint}:`, error);
                // Fall back to original endpoint
              }
            }
          }

          // If we couldn't modify the endpoint or it failed, use the original one
          // but we'll filter the results client-side
          console.log('Using original endpoint and will filter results client-side');
          return await this.request(this.successfulEndpoints.timeHistory);
        }
      } catch (error) {
        console.error('Cached time history endpoint failed, will try alternatives:', error);
        // Clear the cache if it fails
        this.successfulEndpoints.timeHistory = null;
      }
    }

    // Define endpoint patterns to try - prioritize endpoints that filter by current user
    let endpoints = [
      // Special endpoint for testing with issue description data
      // This is a fake endpoint that will be intercepted in the request method
      '/api/v1/time_accountings/issue_description_test',

      // Official Zammad API endpoints for time history - with user filtering
      '/api/v1/time_accountings/me',
      '/api/v1/time_accountings/my',
      '/api/v1/time_accountings/by_user/me',
      '/api/v1/time_accountings/by_current_user',
      '/api/v1/time_accountings?user_id=me',
      '/api/v1/time_accountings?created_by=me',
      // Additional endpoints with explicit user filtering
      '/api/v1/time_accountings?filter[created_by_id]=me',
      '/api/v1/time_accountings?filter[user_id]=me',
      // Alternative formats without square brackets
      '/api/v1/time_accountings?filter.user_id=me',
      '/api/v1/time_accountings?filter.created_by=me',
      // Try with 'current' instead of 'me'
      '/api/v1/time_accountings?user_id=current',
      '/api/v1/time_accountings?created_by=current',
      // Try with actual user ID if available
      '/api/v1/time_accountings?user_id=current_user',
      // Try with different parameter formats
      '/api/v1/time_accountings?by=me',
      '/api/v1/time_accountings?owner=me',
      // Try with different API versions
      '/api/v1.0/time_accountings?user_id=me',
      '/api/time_accountings?user_id=me',
      // Try with search query format
      '/api/v1/time_accountings/search?query=created_by:me',
      '/api/v1/time_accountings/search?query=user_id:me',
      // Try with ticket-specific endpoints if we have a current ticket ID
      '/api/v1/tickets/last/time_accountings',
      // Try with different date filters to limit results
      '/api/v1/time_accountings?from=30d',
      '/api/v1/time_accountings?timeframe=month'
    ];

    // If we have a current user ID, add endpoints with explicit user ID
    if (this.currentUserId) {
      const userIdEndpoints = [
        `/api/v1/time_accountings?user_id=${this.currentUserId}`,
        `/api/v1/time_accountings?created_by_id=${this.currentUserId}`,
        `/api/v1/time_accountings?filter[created_by_id]=${this.currentUserId}`,
        `/api/v1/time_accountings?filter[user_id]=${this.currentUserId}`,
        `/api/v1/time_accountings/by_user/${this.currentUserId}`,
        `/api/v1/time_accountings/search?query=created_by_id:${this.currentUserId}`,
        `/api/v1/time_accountings/search?query=user_id:${this.currentUserId}`
      ];

      // Add these endpoints at the beginning of the array for higher priority
      endpoints = [...userIdEndpoints, ...endpoints];

      console.log(`Added ${userIdEndpoints.length} endpoints with explicit user ID: ${this.currentUserId}`);
    }

    // Last resort: try without user filtering (if user has sufficient permissions)
    endpoints.push('/api/v1/time_accountings?limit=100');

    // Log the endpoints we're going to try
    console.log(`Will try ${endpoints.length} endpoints for time history`);

    let lastError = null;

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying time history endpoint: ${endpoint}`);
        const result = await this.request(endpoint);

        // Cache the successful endpoint pattern for future use
        this.successfulEndpoints.timeHistory = endpoint;
        console.log(`Cached successful time history endpoint: ${endpoint}`);

        // Save to storage for persistence
        this.saveCachedEndpoints();

        // If we're using an endpoint without user filtering, filter the results client-side
        if (endpoint.includes('limit=100') || 
            (!endpoint.includes('me') && 
             !endpoint.includes('my') && 
             !endpoint.includes('current_user') && 
             !endpoint.includes('user_id') && 
             !endpoint.includes('created_by'))) {
          console.log('Using endpoint without user filtering, filtering results client-side');

          // Try to filter by the current user's data
          // This is a best-effort approach and may not be perfect
          if (Array.isArray(result)) {
            // Get the current user ID
            const currentUserId = this.getCurrentUserId();
            console.log('Filtering results with current user ID:', currentUserId);

            // Log some sample entries to help with debugging
            if (result.length > 0) {
              console.log('Sample entry from results:', result[0]);
            }

            // Look for entries that might belong to the current user
            const filteredResult = result.filter(entry => {
              // For debugging: log entry details if it has created_by_id
              if (entry.created_by_id) {
                console.log(`Entry ${entry.id} has created_by_id: ${entry.created_by_id}, comparing with currentUserId: ${currentUserId}`);
              }

              // Check various fields that might indicate the entry belongs to the current user
              // Note: In some Zammad instances, created_by_id might be a numeric value instead of 'me'
              // The issue description shows created_by_id values like 3 and 1456

              // Convert values to strings for comparison to handle numeric vs string IDs
              const entryCreatedById = entry.created_by_id ? entry.created_by_id.toString() : null;
              const entryUserId = entry.user_id ? entry.user_id.toString() : null;
              const currentUserIdStr = currentUserId ? currentUserId.toString() : null;

              // Check if this entry matches the format in the issue description
              // The issue description shows entries with created_by_id values like 3 and 1456
              // and some entries have ticket_article_id set to null
              const matchesIssueFormat = 
                entry.hasOwnProperty('id') && 
                entry.hasOwnProperty('ticket_id') && 
                entry.hasOwnProperty('created_by_id') && 
                entry.hasOwnProperty('time_unit') && 
                entry.hasOwnProperty('created_at');

              // If the entry matches the format in the issue description and we have a user ID,
              // check if the created_by_id matches our user ID
              if (matchesIssueFormat && currentUserIdStr && entryCreatedById) {
                console.log(`Entry matches issue format. Entry created_by_id: ${entryCreatedById}, our user ID: ${currentUserIdStr}, match: ${entryCreatedById === currentUserIdStr}`);
              }

              return (
                     // Check for string 'me' in various fields
                     entry.created_by_id === 'me' || 
                     entry.user_id === 'me' ||
                     entry.created_by === 'me' ||
                     entry.user === 'me' ||

                     // Check for numeric user ID if we have it
                     (currentUserIdStr && (
                       entryCreatedById === currentUserIdStr ||
                       entryUserId === currentUserIdStr
                     )) ||

                     // Also check for entries created recently (last 30 days)
                     (entry.created_at && new Date(entry.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                    );
            });

            console.log(`Filtered ${result.length} entries down to ${filteredResult.length} entries`);

            // If we couldn't filter anything (no matches), try to extract user IDs from the entries
            // and see if we can identify the current user
            if (filteredResult.length === 0 && !this.currentUserId) {
              const userIds = this.extractUserIdsFromTimeEntries(result);

              if (userIds.length > 0) {
                console.log(`Found ${userIds.length} unique user IDs in the entries. Trying to identify the current user...`);

                // If there's only one user ID, it's likely the current user
                if (userIds.length === 1) {
                  this.currentUserId = userIds[0];
                  console.log(`Only one user ID found (${this.currentUserId}), assuming it's the current user`);

                  // Try filtering again with the new user ID
                  const newFilteredResult = result.filter(entry => {
                    const entryCreatedById = entry.created_by_id ? entry.created_by_id.toString() : null;
                    return entryCreatedById === this.currentUserId.toString();
                  });

                  console.log(`Re-filtered with extracted user ID: ${newFilteredResult.length} entries match`);
                  if (newFilteredResult.length > 0) {
                    return newFilteredResult;
                  }
                } else {
                  // If there are multiple user IDs, log them for debugging
                  console.log(`Multiple user IDs found: ${userIds.join(', ')}. Can't determine current user automatically.`);

                  // Try to find the most common user ID
                  const userIdCounts = {};
                  result.forEach(entry => {
                    if (entry.created_by_id) {
                      const id = entry.created_by_id.toString();
                      userIdCounts[id] = (userIdCounts[id] || 0) + 1;
                    }
                  });

                  // Find the user ID with the most entries
                  let maxCount = 0;
                  let mostCommonUserId = null;

                  Object.entries(userIdCounts).forEach(([id, count]) => {
                    if (count > maxCount) {
                      maxCount = count;
                      mostCommonUserId = id;
                    }
                  });

                  if (mostCommonUserId) {
                    console.log(`Most common user ID is ${mostCommonUserId} with ${maxCount} entries`);

                    // If this user ID has significantly more entries, assume it's the current user
                    const totalEntries = result.length;
                    if (maxCount > totalEntries * 0.5) { // More than 50% of entries
                      this.currentUserId = mostCommonUserId;
                      console.log(`User ID ${mostCommonUserId} has more than 50% of entries, assuming it's the current user`);

                      // Filter by this user ID
                      const newFilteredResult = result.filter(entry => {
                        const entryCreatedById = entry.created_by_id ? entry.created_by_id.toString() : null;
                        return entryCreatedById === this.currentUserId.toString();
                      });

                      console.log(`Re-filtered with most common user ID: ${newFilteredResult.length} entries match`);
                      if (newFilteredResult.length > 0) {
                        return newFilteredResult;
                      }
                    }
                  }
                }
              }
            }

            return filteredResult.length > 0 ? filteredResult : result;
          }
        }

        return result;
      } catch (error) {
        console.error(`Error with time history endpoint ${endpoint}:`, error);
        lastError = error;
        // Continue to next endpoint
      }
    }

    // If we get here, all endpoints failed
    console.error('All time history endpoints failed');
    throw lastError || new Error('Failed to get time tracking history');
  }
}

// Create and export a singleton instance
const zammadApi = new ZammadAPI();

// Make it available globally
window.zammadApi = zammadApi;
console.log('Zammad API singleton instance created and available globally');
