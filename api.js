// Zammad API Service for Time Tracking Extension
// This file handles all communication with the Zammad REST API

class ZammadAPI {
  constructor() {
    this.baseUrl = null;
    this.token = null;
    this.initialized = false;
    this.validated = false;
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

    if (!token) {
      throw new Error('API Token is required');
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
    this.validated = false; // Reset validation when reinitializing

    // CHANGE: Make validation non-blocking and don't wait for it
    console.log('Zammad API initialized - validation will run in background');

    // Start background validation (but don't wait for it)
    this.validateTokenInBackground();

    return true;
  }

  /**
   * Start token validation in background without blocking
   */
  validateTokenInBackground() {
    // Don't wait for this - let it run in background
    setTimeout(async () => {
      try {
        console.log('Starting background token validation...');
        await this.validateToken();
        console.log('Background token validation completed successfully');
      } catch (error) {
        console.warn('Background token validation failed:', error.message);
        // Don't throw - just log the warning
      }
    }, 100); // Small delay to ensure UI loads first
  }

  /**
   * Check if the API is initialized (allow usage even without validation)
   */
  isInitialized() {
    // Allow usage if initialized, even if not yet validated
    return this.initialized && this.baseUrl && this.token;
  }

  /**
   * Check if the API is initialized but not yet validated
   */
  isInitializedButNotValidated() {
    return this.initialized && this.baseUrl && this.token && !this.validated;
  }


  /**
   * Check if there's a session conflict by testing authentication method
   */
  async detectSessionConflict() {
    if (!this.initialized) return false;

    try {
      console.log('Detecting session conflicts...');

      // Make a simple request to check authentication
      const testUrl = `${this.baseUrl}/api/v1/users/me`;

      // Test with credentials: 'include' (session-based)
      const sessionResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      // Test with token-only
      const tokenResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token token=${this.token}`
        },
        credentials: 'omit'
      });

      const sessionWorks = sessionResponse.ok;
      const tokenWorks = tokenResponse.ok;

      console.log('Session auth works:', sessionWorks);
      console.log('Token auth works:', tokenWorks);

      if (sessionWorks && tokenWorks) {
        // Both work - potential conflict
        const sessionUser = sessionWorks ? await sessionResponse.json() : null;
        const tokenUser = tokenWorks ? await tokenResponse.json() : null;

        if (sessionUser && tokenUser && sessionUser.id !== tokenUser.id) {
          console.warn('SESSION CONFLICT DETECTED!');
          console.warn('Session user:', sessionUser.login || sessionUser.email);
          console.warn('Token user:', tokenUser.login || tokenUser.email);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error detecting session conflict:', error);
      return false;
    }
  }
  /**
   * Make an API request to Zammad - FORCE TOKEN ONLY
   */
  async request(endpoint, method = 'GET', data = null) {
    // Check basic initialization (not validation) for requests
    if (!this.initialized || !this.baseUrl || !this.token) {
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
        'Authorization': `Token token=${this.token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        // CRITICAL: Override any session-based authentication
        'X-Requested-With': 'XMLHttpRequest'
      },
      // CRITICAL: Prevent session cookies from being sent
      credentials: 'omit',
      // CRITICAL: Ensure fresh request
      cache: 'no-cache'
    };

    // For POST/PUT requests, add the data
    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && data) {
      options.body = JSON.stringify(data);
    }

    console.log(`Making ${method} request to: ${url}`);
    console.log('Headers:', options.headers);
    console.log('Credentials:', options.credentials);

    try {
      const response = await fetch(url, options);

      console.log(`Response status: ${response.status}`);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorText = await response.text();
          console.error('Error response body:', errorText);

          // Try to parse as JSON for more details
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error || errorJson.message) {
              errorMessage += ` - ${errorJson.error || errorJson.message}`;
            }
          } catch (parseError) {
            // Not JSON, use raw text
            if (errorText.length < 200) {
              errorMessage += ` - ${errorText}`;
            }
          }
        } catch (textError) {
          console.error('Could not read error response:', textError);
        }

        throw new Error(errorMessage);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log('API Response:', result);
        return result;
      } else {
        // For DELETE requests or other non-JSON responses
        const text = await response.text();
        console.log('API Response (text):', text);
        return text || true; // Return true for successful operations without content
      }

    } catch (error) {
      console.error(`API request failed:`, error);

      // Provide more context for common errors
      if (error.message.includes('Failed to fetch')) {
        throw new Error(`Network error: Could not connect to ${this.baseUrl}. Check URL and network connection.`);
      } else if (error.message.includes('401')) {
        throw new Error(`Authentication failed: Invalid API token or token expired.`);
      } else if (error.message.includes('403')) {
        throw new Error(`Permission denied: API token doesn't have sufficient permissions for this operation.`);
      } else if (error.message.includes('404')) {
        throw new Error(`Not found: The requested resource doesn't exist at ${url}.`);
      }

      throw error;
    }
  }  /**
   * Validate the API token by making a test request
   */
  async validateToken() {
    if (!this.initialized) {
      console.log('API not initialized, cannot validate token');
      return false;
    }

    if (!this.baseUrl || !this.token) {
      console.log('Missing baseUrl or token, cannot validate');
      return false;
    }

    try {
      console.log('Validating API token with token-only authentication...');
      console.log('Base URL:', this.baseUrl);
      console.log('Token length:', this.token ? this.token.length : 0);

      // Add timeout for validation
      const validationPromise = this.fetchCurrentUser();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Token validation timeout after 10 seconds')), 10000);
      });

      await Promise.race([validationPromise, timeoutPromise]);

      this.validated = true;
      console.log('API token validated successfully');
      return true;
    } catch (error) {
      console.error('API token validation failed:', error);
      this.validated = false;

      // Provide more specific error information
      if (error.message.includes('timeout')) {
        console.error('Token validation timed out - check network connection and API endpoint');
      } else if (error.message.includes('401') || error.message.includes('403')) {
        console.error('Token validation failed - invalid token or insufficient permissions');
      } else if (error.message.includes('fetch')) {
        console.error('Network error during token validation - check URL and connectivity');
      }

      return false;
    }
  }

  /**
   * Fetch current user profile with better error handling
   */

  async fetchCurrentUser() {
    // Try cached endpoint first
    if (this.successfulEndpoints.userProfile) {
      try {
        console.log('Trying cached user profile endpoint:', this.successfulEndpoints.userProfile);
        const profile = await this.request(this.successfulEndpoints.userProfile);
        this.userProfile = profile;
        this.currentUserId = profile.id;
        this.saveCachedUserProfile();
        console.log('User profile fetched from cache successfully:', profile.id);
        return profile;
      } catch (error) {
        console.error('Cached user profile endpoint failed:', error);
        this.successfulEndpoints.userProfile = null;
      }
    }

    // Official Zammad API endpoint
    const primaryEndpoint = '/api/v1/users/me';

    try {
      console.log(`Trying official user profile endpoint: ${primaryEndpoint}`);
      const profile = await this.request(primaryEndpoint);

      if (profile && (profile.id || profile.login)) {
        this.userProfile = profile;
        this.currentUserId = profile.id;
        this.successfulEndpoints.userProfile = primaryEndpoint;
        this.saveCachedEndpoints();
        this.saveCachedUserProfile();
        console.log('User profile fetched successfully:', profile.id || profile.login);
        return profile;
      } else {
        throw new Error('Invalid profile data received');
      }
    } catch (error) {
      console.error(`Error with official endpoint ${primaryEndpoint}:`, error.message);

      // Provide specific guidance based on the error
      if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error(`Authentication failed: Invalid API token or insufficient permissions. Error: ${error.message}`);
      } else if (error.message.includes('404')) {
        throw new Error(`API endpoint not found: Your Zammad version may not support this endpoint. Error: ${error.message}`);
      } else {
        throw new Error(`Failed to fetch user profile: ${error.message}`);
      }
    }
  }
  /**
   * Force refresh after login to clear any session conflicts
   */
  async forceRefreshAfterLogin() {
    console.log('Forcing API refresh after login...');

    // Clear all cached data
    this.validated = false;
    this.userProfile = null;
    this.currentUserId = null;
    this.successfulEndpoints = {
      ticket: null,
      timeEntries: null,
      timeSubmission: null,
      assignedTickets: null,
      timeHistory: null,
      userProfile: null
    };

    // Clear storage cache
    await this.saveCachedEndpoints();
    await chrome.storage.local.remove(['zammadUserProfile']);

    // Detect session conflicts
    const hasConflict = await this.detectSessionConflict();
    if (hasConflict) {
      console.warn('Session conflict detected - requests will use token-only authentication');
    }

    // Re-validate with token-only
    await this.validateToken();

    console.log('API refreshed after login - using token-only authentication');
  }  /**
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
  async submitTimeEntry(ticketId, timeSpent, comment = '') {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    // Allow negative values for time corrections (when reducing time)
    // Only reject if the value is exactly 0 or very close to 0, or not a valid number
    if (isNaN(timeSpent)) {
      throw new Error('Time spent must be a valid number');
    }

    // Use a small epsilon to allow values very close to 0 but not exactly 0
    const epsilon = 0.001;
    if (Math.abs(timeSpent) < epsilon) {
      console.log('Time spent is too close to zero, skipping submission');
      // Return a successful response instead of throwing an error
      return { success: true, message: 'No adjustment needed (value too small)' };
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
   * Delete a time tracking entry
   */
  async deleteTimeEntry(entryId) {
    if (!entryId) {
      throw new Error('Entry ID is required');
    }

    console.log(`Attempting to delete time entry ${entryId} (token-only authentication)`);

    // First, try to get the time entry details to understand its structure
    let timeEntryDetails = null;
    try {
      timeEntryDetails = await this.getTimeEntryDetails(entryId);
      console.log('Time entry details:', timeEntryDetails);
    } catch (detailsError) {
      console.warn('Could not get time entry details, proceeding with deletion attempts:', detailsError.message);
    }

    // Array of endpoints to try for deletion
    const deleteEndpoints = [
      `/api/v1/time_accountings/${entryId}`,
    ];

    // If we have ticket ID from details, add ticket-specific endpoint
    if (timeEntryDetails && timeEntryDetails.ticket_id) {
      deleteEndpoints.unshift(`/api/v1/tickets/${timeEntryDetails.ticket_id}/time_accountings/${entryId}`);
    }

    let lastError = null;

    // Try each endpoint
    for (const endpoint of deleteEndpoints) {
      try {
        console.log(`Trying delete endpoint: ${endpoint}`);
        // Pass null as data for DELETE requests
        const result = await this.request(endpoint, 'DELETE', null);
        console.log(`Successfully deleted time entry ${entryId} using endpoint: ${endpoint}`);

        // Clear time history cache after successful deletion
        this.clearTimeHistoryCache();

        return result;
      } catch (deleteError) {
        console.error(`Delete failed for endpoint ${endpoint}:`, deleteError.message);
        lastError = deleteError;

        // If it's a 404, the entry might already be deleted
        if (deleteError.message.includes('404')) {
          console.log('Entry might already be deleted (404 error)');
          this.clearTimeHistoryCache();
          return { success: true, message: 'Entry already deleted or not found' };
        }

        // Continue to next endpoint
        continue;
      }
    }

    // If all endpoints failed, provide detailed error information
    if (lastError) {
      if (lastError.message.includes('403') || lastError.message.includes('401')) {
        throw new Error('Permission denied: You need admin.time_accounting permission to delete time entries. Please check your API token permissions or contact your Zammad administrator.');
      }

      if (lastError.message.includes('404')) {
        throw new Error(`Time entry ${entryId} not found. It may have already been deleted.`);
      }

      throw new Error(`Failed to delete time entry ${entryId}. Last error: ${lastError.message}`);
    }

    throw new Error(`Failed to delete time entry ${entryId}. No valid endpoint found.`);
  }
  /**
   * Clear time history cache to force fresh data retrieval
   */
  clearTimeHistoryCache() {
    console.log('Clearing time history cache');
    this.successfulEndpoints.timeHistory = null;
    this.saveCachedEndpoints();
  }

  /**
   * Get time tracking history for the current user
   */
  async getTimeHistory() {
    console.log('Getting time tracking history for current user');

    // Try cached endpoint first, but be careful with admin endpoints
    if (this.successfulEndpoints.timeHistory && this.successfulEndpoints.timeHistory !== 'fallback_via_tickets') {
      try {
        const result = await this.request(this.successfulEndpoints.timeHistory);

        // IMPORTANT: Always filter admin endpoint results by current user
        if (Array.isArray(result) && this.currentUserId) {
          const filteredResult = result.filter(entry =>
            entry.created_by_id === this.currentUserId ||
            entry.user_id === this.currentUserId
          );
          console.log(`Filtered ${result.length} entries to ${filteredResult.length} for current user`);
          return filteredResult;
        }

        return result;
      } catch (error) {
        console.error('Cached time history endpoint failed:', error);
        this.successfulEndpoints.timeHistory = null;
      }
    }

    // Method 1: Try direct time_accountings endpoints (requires admin permissions)
    // Only try these if we have a user ID
    if (this.currentUserId) {
      const adminEndpoints = [
        `/api/v1/time_accountings?created_by_id=${this.currentUserId}`,
        '/api/v1/time_accountings'
      ];

      for (const endpoint of adminEndpoints) {
        try {
          console.log(`Trying time history endpoint: ${endpoint}`);
          const result = await this.request(endpoint);

          // ALWAYS filter by current user, regardless of endpoint
          const filteredResult = Array.isArray(result)
            ? result.filter(entry =>
              entry.created_by_id == this.currentUserId ||
              entry.user_id == this.currentUserId
            )
            : result;

          console.log(`Got ${Array.isArray(result) ? result.length : 0} total entries, filtered to ${Array.isArray(filteredResult) ? filteredResult.length : 0} for current user`);

          // Only cache endpoints that properly filter by user
          if (endpoint.includes('created_by_id')) {
            this.successfulEndpoints.timeHistory = endpoint;
            this.saveCachedEndpoints();
          }

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
              !this.currentUserId ||
              entry.created_by_id == this.currentUserId ||
              entry.user_id == this.currentUserId
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
  /**
   * Get time entry details - enhanced version
   */
  async getTimeEntryDetails(entryId) {
    const endpoints = [
      `/api/v1/time_accountings/${entryId}`,
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying to get time entry details from: ${endpoint}`);
        const result = await this.request(endpoint);
        console.log(`Successfully got time entry details from: ${endpoint}`, result);
        return result;
      } catch (error) {
        console.error(`Failed to get time entry details from ${endpoint}:`, error.message);
        lastError = error;
      }
    }

    throw new Error(`Could not retrieve time entry details. Last error: ${lastError?.message || 'Unknown error'}`);
  }
}

// Create and export a singleton instance
const zammadApi = new ZammadAPI();

// Make it available globally
window.zammadApi = zammadApi;
console.log('Zammad API singleton instance created and available globally');
