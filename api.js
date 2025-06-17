
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

    // Load cached data from storage
    this.loadCachedEndpoints();
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
   */
  init(baseUrl, token) {
    if (!baseUrl) {
      throw new Error('Base URL is required');
    }

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
      this.saveCachedEndpoints();

      // Clear user profile
      this.userProfile = null;
      this.currentUserId = null;
      chrome.storage.local.remove(['zammadUserProfile']);
    }

    this.baseUrl = normalizedBaseUrl;
    this.token = token;
    this.initialized = true;

    // Fetch CSRF token and user profile
    this.fetchCsrfToken();
    setTimeout(() => {
      this.fetchCurrentUser().catch(error => {
        console.warn('Could not fetch user profile during initialization:', error.message);
      });
    }, 1000);

    console.log('Zammad API initialized with base URL:', this.baseUrl);
    return true;
  }

  /**
   * Fetch CSRF token from cookies or server
   */
  async fetchCsrfToken() {
    try {
      console.log('Fetching CSRF token...');

      // Try to get CSRF token from cookies
      if (typeof chrome !== 'undefined' && chrome.cookies?.getAll) {
        try {
          const cookies = await chrome.cookies.getAll({ url: this.baseUrl });
          const csrfCookie = cookies.find(cookie =>
            cookie.name === '_csrf_token' ||
            cookie.name === 'CSRF-Token' ||
            cookie.name.toLowerCase().includes('csrf')
          );

          if (csrfCookie) {
            this.csrfToken = csrfCookie.value;
            console.log('CSRF token found in cookies');
            return this.csrfToken;
          }
        } catch (cookieError) {
          console.warn('Error accessing cookies API:', cookieError);
        }
      }

      // Try to fetch from server
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        credentials: 'include'
      });

      const csrfHeader = response.headers.get('X-CSRF-Token') ||
        response.headers.get('X-CSRF-TOKEN') ||
        response.headers.get('CSRF-Token');

      if (csrfHeader) {
        this.csrfToken = csrfHeader;
        console.log('CSRF token found in response headers');
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
   */
  isInitialized() {
    return this.initialized && this.baseUrl && this.token;
  }

  /**
   * Extract base URL from current tab URL
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
      },
      credentials: 'include'
    };

    // Add CSRF token for POST and PUT requests
    if (method === 'POST' || method === 'PUT') {
      if (!this.csrfToken) {
        await this.fetchCsrfToken();
      }

      if (this.csrfToken) {
        options.headers['X-CSRF-Token'] = this.csrfToken;
      }

      if (data) {
        options.body = JSON.stringify(data);
      }
    }

    try {
      console.log(`Making ${method} request to ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      options.signal = controller.signal;

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetails = 'No error details available';
        try {
          const errorJson = await response.json();
          errorDetails = JSON.stringify(errorJson);
        } catch (e) {
          try {
            errorDetails = await response.text();
          } catch (e2) {
            // Keep default error message
          }
        }

        let errorMessage = `API request failed: ${response.status} ${response.statusText}. Details: ${errorDetails}`;

        if (response.status === 401 || response.status === 403) {
          errorMessage += '\n\nPermission issue. Please check your API token permissions.';
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
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
   */
  async getTicket(ticketId) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    // Try cached endpoint first
    if (this.successfulEndpoints.ticket) {
      try {
        const endpoint = this.successfulEndpoints.ticket.replace('{ticketId}', ticketId);
        return await this.request(endpoint);
      } catch (error) {
        console.error('Cached endpoint failed:', error);
        this.successfulEndpoints.ticket = null;
      }
    }

    const endpoints = [
      `/api/v1/tickets/${ticketId}`,
      `/api/v1/tickets/search?number=${ticketId}`,
      `/api/v1/tickets/by_number/${ticketId}`,
      `/api/v1/tickets?number=${ticketId}`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const result = await this.request(endpoint);

        // Cache successful endpoint
        this.successfulEndpoints.ticket = endpoint.replace(ticketId, '{ticketId}');
        this.saveCachedEndpoints();

        return result;
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error);
      }
    }

    throw new Error('Failed to get ticket information');
  }

  /**
   * Get time tracking entries for a ticket
   */
  async getTimeEntries(ticketId) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    // Try cached endpoint first
    if (this.successfulEndpoints.timeEntries) {
      try {
        const endpoint = this.successfulEndpoints.timeEntries.replace('{ticketId}', ticketId);
        return await this.request(endpoint);
      } catch (error) {
        console.error('Cached time entries endpoint failed:', error);
        this.successfulEndpoints.timeEntries = null;
      }
    }

    const endpoint = `/api/v1/tickets/${ticketId}/time_accountings`;
    try {
      const result = await this.request(endpoint);
      this.successfulEndpoints.timeEntries = endpoint.replace(ticketId, '{ticketId}');
      this.saveCachedEndpoints();
      return result;
    } catch (error) {
      console.error('Failed to get time entries:', error);
      throw new Error('Failed to get time entries');
    }
  }

  /**
   * Submit time tracking entry
   */
  /**
   * Submit time tracking entry
   */
  async submitTimeEntry(ticketId, timeSpent, comment = '') {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    // Allow negative values for time corrections (when reducing time)
    // Only reject if the value is exactly 0 or not a valid number
    if (timeSpent === 0 || isNaN(timeSpent)) {
      throw new Error('Time spent must be a valid number and not zero');
    }

    const data = {
      time_unit: timeSpent,
      ticket_id: ticketId
    };

    if (comment) {
      data.comment = comment;
    }

    // Try cached endpoint first
    if (this.successfulEndpoints.timeSubmission) {
      try {
        const endpoint = this.successfulEndpoints.timeSubmission.includes('{ticketId}')
          ? this.successfulEndpoints.timeSubmission.replace('{ticketId}', ticketId)
          : this.successfulEndpoints.timeSubmission;
        return await this.request(endpoint, 'POST', data);
      } catch (error) {
        console.error('Cached time submission endpoint failed:', error);
        this.successfulEndpoints.timeSubmission = null;
      }
    }


    const endpoint = `/api/v1/tickets/${ticketId}/time_accountings`;
    try {
      const result = await this.request(endpoint, 'POST', data);
      this.successfulEndpoints.timeSubmission = endpoint.replace(ticketId, '{ticketId}');
      this.saveCachedEndpoints();
      return result;
    } catch (error) {
      console.error('Failed to submit time entry:', error);
      throw new Error('Failed to submit time entry');
    }
  }

  /**
   * Get tickets assigned to the current user
   */
  async getAssignedTickets() {
    console.log('Getting tickets assigned to the current user');

    // Try to fetch user ID if not available
    if (!this.currentUserId) {
      try {
        await this.fetchCurrentUser();
      } catch (error) {
        console.warn('Could not fetch current user profile:', error.message);
      }
    }

    // Try cached endpoint first
    if (this.successfulEndpoints.assignedTickets) {
      try {
        return await this.request(this.successfulEndpoints.assignedTickets);
      } catch (error) {
        console.error('Cached assigned tickets endpoint failed:', error);
        this.successfulEndpoints.assignedTickets = null;
      }
    }

    const endpoints = [
      '/api/v1/tickets/search?query=owner.id:me',
      '/api/v1/tickets?filter[owner_id]=me',
      '/api/v1/tickets?owner_id=me'
    ];

    // Add endpoints with explicit user ID if available
    if (this.currentUserId) {
      endpoints.unshift(
        `/api/v1/tickets/search?query=owner.id:${this.currentUserId}`,
        `/api/v1/tickets?filter[owner_id]=${this.currentUserId}`,
        `/api/v1/tickets?owner_id=${this.currentUserId}`
      );
    }

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying assigned tickets endpoint: ${endpoint}`);
        const result = await this.request(endpoint);

        this.successfulEndpoints.assignedTickets = endpoint;
        this.saveCachedEndpoints();

        return result;
      } catch (error) {
        console.error(`Error with assigned tickets endpoint ${endpoint}:`, error);
      }
    }

    throw new Error('Failed to get assigned tickets');
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
   * Fetch current user profile
   */
  async fetchCurrentUser() {
    if (this.successfulEndpoints.userProfile) {
      try {
        const profile = await this.request(this.successfulEndpoints.userProfile);
        this.userProfile = profile;
        this.currentUserId = profile.id;
        this.saveCachedUserProfile();
        return profile;
      } catch (error) {
        console.error('Cached user profile endpoint failed:', error);
        this.successfulEndpoints.userProfile = null;
      }
    }

    // Correct Zammad API endpoints - v1 not v1.0
    const endpoints = [
      '/api/v1/users/me',
      '/api/v1/users/current',
      '/api/v1/user/me'
    ];

    for (const endpoint of endpoints) {
      try {
        const profile = await this.request(endpoint);
        this.userProfile = profile;
        this.currentUserId = profile.id;
        this.successfulEndpoints.userProfile = endpoint;
        this.saveCachedEndpoints();
        this.saveCachedUserProfile();
        return profile;
      } catch (error) {
        console.error(`Error with user profile endpoint ${endpoint}:`, error);
      }
    }

    throw new Error('Failed to fetch current user profile');
  }

  /**
   * Get time tracking history for the current user
   * Note: Direct access to /api/v1/time_accountings requires admin.time_accounting permission
   * For regular users, we need to get time entries from individual tickets
   */
  async getTimeHistory() {
    console.log('Getting time tracking history for current user');

    // Try cached endpoint first
    if (this.successfulEndpoints.timeHistory) {
      try {
        return await this.request(this.successfulEndpoints.timeHistory);
      } catch (error) {
        console.error('Cached time history endpoint failed:', error);
        this.successfulEndpoints.timeHistory = null;
      }
    }

    // Method 1: Try direct time_accountings endpoints (requires admin permissions)
    // Only try these if we have a user ID
    if (this.currentUserId) {
      const adminEndpoints = [
        '/api/v1/time_accountings',
        `/api/v1/time_accountings?created_by_id=${this.currentUserId}`
      ];

      for (const endpoint of adminEndpoints) {
        try {
          console.log(`Trying time history endpoint: ${endpoint}`);
          const result = await this.request(endpoint);

          // Filter by current user if the endpoint doesn't support it natively
          const filteredResult = Array.isArray(result)
            ? result.filter(entry => !this.currentUserId || entry.created_by_id == this.currentUserId)
            : result;

          this.successfulEndpoints.timeHistory = endpoint;
          this.saveCachedEndpoints();
          return filteredResult;
        } catch (error) {
          console.warn(`Admin endpoint ${endpoint} failed (likely permission issue):`, error.message);
        }
      }
    }

    // Method 2: Fallback - Get assigned tickets and collect time entries from each
    console.log('Admin endpoints failed, trying fallback method via assigned tickets');

    try {
      // Get assigned tickets first
      const tickets = await this.getAssignedTickets();
      console.log(`Found ${tickets.length || 0} assigned tickets for time history collection`);

      if (!tickets || tickets.length === 0) {
        return [];
      }

      // Collect time entries from each ticket
      const allTimeEntries = [];
      const maxTicketsToCheck = 20; // Reduced limit to avoid too many API calls
      const ticketsToCheck = Array.isArray(tickets) ? tickets.slice(0, maxTicketsToCheck) : [];

      for (const ticket of ticketsToCheck) {
        try {
          const ticketId = ticket.id || ticket.ticket_id;
          if (!ticketId) continue;

          console.log(`Getting time entries for ticket ${ticketId}`);
          const timeEntries = await this.getTimeEntries(ticketId);
          if (Array.isArray(timeEntries)) {
            // Filter entries by current user
            const userEntries = timeEntries.filter(entry =>
              !this.currentUserId || entry.created_by_id == this.currentUserId
            );
            allTimeEntries.push(...userEntries);
          }
        } catch (error) {
          console.warn(`Failed to get time entries for ticket ${ticket.id}:`, error.message);
          // Continue with other tickets
        }
      }

      // Sort by date (newest first)
      allTimeEntries.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA;
      });

      console.log(`Collected ${allTimeEntries.length} time entries from ${ticketsToCheck.length} tickets`);

      // Cache this method as successful
      this.successfulEndpoints.timeHistory = 'fallback_via_tickets';
      this.saveCachedEndpoints();

      return allTimeEntries;

    } catch (error) {
      console.error('Fallback method also failed:', error);
      throw new Error('Failed to get time tracking history. This may be due to insufficient API permissions or no assigned tickets.');
    }
  }
}

// Create and export a singleton instance
const zammadApi = new ZammadAPI();

// Make it available globally
window.zammadApi = zammadApi;
console.log('Zammad API singleton instance created and available globally');
