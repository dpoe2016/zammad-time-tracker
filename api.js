// Zammad API Service for Time Tracking Extension
// This file handles all communication with the Zammad REST API
//
// IMPORTANT: When making changes to this file, always reference:
// 1. The API Reference Guide: docs/zammad/API_REFERENCE.md
// 2. The official Zammad documentation: docs/zammad/docs.zammad.org/en/latest/api/
//
// Different Zammad versions may support different API endpoints.
// Always use feature detection and fallback mechanisms for maximum compatibility.

class ZammadAPI {
  constructor() {
    this.baseUrl = null;
    this.token = null;
    this.initialized = false;
    this.validated = false;
    this.currentUserId = null;
    this.userProfile = null;
    this.apiVersion = null;
    this.apiFeatures = {
      supportsMe: null,         // Whether /api/v1/users/me is supported
      supportsTimeAccounting: null, // Whether direct time_accountings endpoint is supported
      supportsTicketSearch: null // Whether ticket search API is supported
    };

    // Cache for successful endpoints
    this.successfulEndpoints = {
      ticket: null,
      timeEntries: null,
      timeSubmission: null,
      assignedTickets: null,
      timeHistory: null,
      userProfile: null,
      allUsers: null
    };

    // Load cached data from storage
    this.loadCachedEndpoints();
    this.loadCachedUserProfile();
    this.loadCachedApiFeatures();
  }

  /**
   * Load cached API features from storage
   */
  async loadCachedApiFeatures() {
    try {
      const result = await chrome.storage.local.get(['zammadApiFeatures']);
      if (result.zammadApiFeatures) {
        this.apiFeatures = result.zammadApiFeatures;
        this.apiVersion = result.zammadApiFeatures.apiVersion;
        console.log('Loaded cached API features:', this.apiFeatures);
      }
    } catch (error) {
      console.error('Error loading cached API features:', error);
    }
  }

  /**
   * Save cached API features to storage
   */
  async saveCachedApiFeatures() {
    try {
      await chrome.storage.local.set({ zammadApiFeatures: this.apiFeatures });
      console.log('Saved API features to cache:', this.apiFeatures);
    } catch (error) {
      console.error('Error saving cached API features:', error);
    }
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
        userProfile: null,
        allUsers: null
      };
      this.saveCachedEndpoints();

      // Clear user profile and API features
      this.userProfile = null;
      this.currentUserId = null;
      this.apiVersion = null;
      this.apiFeatures = {
        supportsMe: null,
        supportsTimeAccounting: null,
        supportsTicketSearch: null
      };

      // Clear storage
      chrome.storage.local.remove(['zammadUserProfile', 'zammadApiFeatures']);
    }

    this.baseUrl = normalizedBaseUrl;
    this.token = token;
    this.initialized = true;
    this.validated = false; // Reset validation when reinitializing

    // CHANGE: Make validation non-blocking and don't wait for it
    console.log('Zammad API initialized - validation will run in background');

    // Start background validation (but don't wait for it)
    this.validateTokenInBackground();

    // Start API feature detection in background
    this.detectApiFeatures();

    return true;
  }

  /**
   * Detect API version and features
   * This helps determine which endpoints to use based on the Zammad version
   */
  async detectApiFeatures() {
    if (!this.initialized || !this.baseUrl || !this.token) {
      console.log('API not initialized, cannot detect features');
      return;
    }

    console.log('Detecting Zammad API features...');

    // Initialize features object
    const features = {
      apiVersion: null,
      supportsMe: false,
      supportsTimeAccounting: false,
      supportsTicketSearch: false
    };

    // Try to get API version info
    try {
      // First try the /api/v1/version endpoint
      try {
        const versionInfo = await this.request('/api/v1/version', 'GET', null, { retry: false });
        if (versionInfo && versionInfo.version) {
          features.apiVersion = versionInfo.version;
          console.log(`Detected Zammad version: ${features.apiVersion}`);
        }
      } catch (versionError) {
        console.log('Version endpoint not available, trying alternative methods');

        // Try to get version from the about page
        try {
          const response = await fetch(`${this.baseUrl}/api/v1/about`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });

          if (response.ok) {
            const aboutInfo = await response.json();
            if (aboutInfo && aboutInfo.version) {
              features.apiVersion = aboutInfo.version;
              console.log(`Detected Zammad version from about: ${features.apiVersion}`);
            }
          }
        } catch (aboutError) {
          console.log('About endpoint not available either');
        }
      }
    } catch (error) {
      console.warn('Could not detect Zammad version:', error.message);
    }

    // Test if /api/v1/users/me is supported
    try {
      const meResponse = await this.request('/api/v1/users/me', 'GET', null, { retry: false });
      if (meResponse && meResponse.id) {
        features.supportsMe = true;
        console.log('API supports /api/v1/users/me endpoint');
      }
    } catch (meError) {
      console.log('/api/v1/users/me endpoint not supported');
      features.supportsMe = false;
    }

    // Test if direct time_accountings endpoint is supported
    try {
      // We don't need the actual response, just to know if the endpoint exists
      await this.request('/api/v1/time_accountings', 'GET', null, { retry: false });
      features.supportsTimeAccounting = true;
      console.log('API supports direct time_accountings endpoint');
    } catch (timeError) {
      // Check if it's a permission error (403) or not found error (404)
      if (timeError.message.includes('403')) {
        // If it's a permission error, the endpoint exists but we don't have access
        features.supportsTimeAccounting = true;
        console.log('API supports time_accountings endpoint but permission denied');
      } else {
        features.supportsTimeAccounting = false;
        console.log('Direct time_accountings endpoint not supported');
      }
    }

    // Test if ticket search API is supported
    try {
      await this.request('/api/v1/tickets/search?query=*', 'GET', null, { retry: false });
      features.supportsTicketSearch = true;
      console.log('API supports ticket search endpoint');
    } catch (searchError) {
      // Check if it's a permission error (403) or not found error (404)
      if (searchError.message.includes('403')) {
        // If it's a permission error, the endpoint exists but we don't have access
        features.supportsTicketSearch = true;
        console.log('API supports ticket search endpoint but permission denied');
      } else {
        features.supportsTicketSearch = false;
        console.log('Ticket search endpoint not supported');
      }
    }

    // Update and save features
    this.apiFeatures = features;
    this.apiVersion = features.apiVersion;
    await this.saveCachedApiFeatures();

    console.log('API feature detection completed:', features);
    return features;
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
   * Check if the API token is valid
   * @returns {Promise<boolean>} True if token is valid, false otherwise
   */
  async isTokenValid() {
    console.log('Checking if API token is valid');

    if (!this.initialized || !this.baseUrl || !this.token) {
      console.log('API not initialized, token cannot be valid');
      return false;
    }

    try {
      // Make a lightweight request to check token validity
      // We use the /api/v1/users/me endpoint as it's typically available
      // and requires authentication
      const response = await fetch(`${this.baseUrl}/api/v1/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Token token=${this.token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'omit'
      });

      // Check if response is OK (status 200-299)
      if (response.ok) {
        console.log('API token is valid');
        return true;
      }

      // If we get a 401 or 403, the token is invalid or expired
      if (response.status === 401 || response.status === 403) {
        console.log('API token is invalid or expired');
        return false;
      }

      // For other status codes, log the issue but consider the token valid
      // as the issue might be with the specific endpoint, not the token
      console.warn(`Unexpected status code ${response.status} when checking token validity`);
      return true;
    } catch (error) {
      console.error('Error checking token validity:', error);

      // Network errors don't necessarily mean the token is invalid
      if (error.message.includes('Failed to fetch')) {
        console.warn('Network error when checking token validity, assuming token is still valid');
        return true;
      }

      return false;
    }
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
      } else if (error.message.includes('fetch') || error.message.includes('Network error')) {
        console.error('Network error during token validation - check URL and connectivity');
        // Add a more descriptive message for network errors
        console.error(`Could not connect to ${this.baseUrl}. Please check your network connection and URL settings.`);
      }

      return false;
    }
  }

  /**
   * Fetch current user profile with better error handling
   * Tries multiple endpoints to handle different Zammad API implementations
   * Uses detected API features to prioritize endpoints
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

    // Define multiple endpoints to try
    let endpoints = [
      '/api/v1/users/me',              // Official Zammad API endpoint
    ];

    // Prioritize endpoints based on detected API features
    if (this.apiFeatures) {
      // If we know the /me endpoint is supported, prioritize it
      if (this.apiFeatures.supportsMe === true) {
        console.log('API is known to support /api/v1/users/me, prioritizing this endpoint');
        endpoints = [
          '/api/v1/users/me',
          ...endpoints.filter(e => e !== '/api/v1/users/me')
        ];
      } else if (this.apiFeatures.supportsMe === false) {
        // If we know the /me endpoint is NOT supported, remove it
        console.log('API is known to NOT support /api/v1/users/me, removing this endpoint');
        endpoints = endpoints.filter(e => e !== '/api/v1/users/me');
      }
    }

    // Try each endpoint
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying user profile endpoint: ${endpoint}`);
        const profile = await this.request(endpoint);

        // Validate profile data
        if (profile && (profile.id || profile.login)) {
          this.userProfile = profile;
          this.currentUserId = profile.id;
          this.successfulEndpoints.userProfile = endpoint;
          this.saveCachedEndpoints();
          this.saveCachedUserProfile();

          // Update API features if this was the /me endpoint
          if (endpoint === '/api/v1/users/me' && this.apiFeatures) {
            this.apiFeatures.supportsMe = true;
            this.saveCachedApiFeatures();
          }

          console.log('User profile fetched successfully:', profile.id || profile.login);
          return profile;
        } else {
          console.warn(`Endpoint ${endpoint} returned invalid profile data`);
          // Continue to next endpoint
        }
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error.message);
        lastError = error;

        // Update API features if this was the /me endpoint and it returned 404
        if (endpoint === '/api/v1/users/me' && error.message.includes('404') && this.apiFeatures) {
          this.apiFeatures.supportsMe = false;
          this.saveCachedApiFeatures();
        }

        // Continue to next endpoint
      }
    }

    // If we get here, all endpoints failed
    console.error('All user profile endpoints failed');

    // Try to get user ID from token if possible
    try {
      // Some Zammad instances encode user info in the token
      // This is a last resort attempt to extract user ID
      if (this.token && this.token.includes(':')) {
        const tokenParts = this.token.split(':');
        if (tokenParts.length > 1 && !isNaN(parseInt(tokenParts[0]))) {
          const possibleUserId = parseInt(tokenParts[0]);
          console.log(`Extracted possible user ID from token: ${possibleUserId}`);
          this.currentUserId = possibleUserId;
          return { id: possibleUserId, source: 'token_extraction' };
        }
      }
    } catch (tokenError) {
      console.error('Error extracting user ID from token:', tokenError);
    }

    // Provide specific guidance based on the last error
    if (lastError) {
      if (lastError.message.includes('401') || lastError.message.includes('403')) {
        throw new Error(`Authentication failed: Invalid API token or insufficient permissions. Error: ${lastError.message}`);
      } else if (lastError.message.includes('404')) {
        throw new Error(`API endpoint not found: Your Zammad version may not support these endpoints. Error: ${lastError.message}`);
      } else if (lastError.message.includes('Failed to fetch') || lastError.message.includes('Network error')) {
        // Handle network connectivity issues more gracefully
        throw new Error(`Network error: Could not connect to ${this.baseUrl}. Please check your network connection and URL settings.`);
      } else {
        throw new Error(`Failed to fetch user profile: ${lastError.message}`);
      }
    } else {
      throw new Error('Failed to fetch user profile: Unknown error');
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
      userProfile: null,
      allUsers: null
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
  }

  /**
   * Force refresh settings with new token and base URL
   * This is used when settings are updated in the options page
   */
  async forceRefreshSettings() {
    console.log('Forcing API refresh with new settings...');

    try {
      // Load settings from storage
      const settings = await this.getSettings();

      if (!settings.baseUrl || !settings.token) {
        console.error('Missing baseUrl or token in settings');
        return false;
      }

      // Re-initialize with new settings
      this.init(settings.baseUrl, settings.token);

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
        userProfile: null,
        allUsers: null
      };

      // Clear storage cache
      await this.saveCachedEndpoints();
      await chrome.storage.local.remove(['zammadUserProfile']);

      // Re-validate with token-only
      await this.validateToken();

      console.log('API refreshed with new settings - using token-only authentication');
      return true;
    } catch (error) {
      console.error('Error refreshing API settings:', error);
      return false;
    }
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
   * Get API settings from storage with better error handling
   */
  /**
   * Enhanced method to get and validate API settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get(['zammadApiSettings']);
      const settings = result.zammadApiSettings || {};

      console.log('Loaded API settings:', {
        baseUrl: settings.baseUrl,
        hasToken: !!settings.token,
        tokenLength: settings.token ? settings.token.length : 0,
        tokenStart: settings.token ? settings.token.substring(0, 10) + '...' : 'No token'
      });

      // Validate settings
      if (!settings.baseUrl) {
        console.error('Base URL is missing from settings');
      }
      if (!settings.token) {
        console.error('API token is missing from settings');
      }

      return settings;
    } catch (error) {
      console.error('Error loading API settings:', error);
      return {};
    }
  }

  /**
   * Enhanced request method with better token handling
   */
  async request(endpoint, method = 'GET', data = null, options = {}) {
    // Set default options
    const requestOptions = {
      retry: true,
      maxRetries: 1,
      retryCount: 0,
      ...options
    };

    // Check basic initialization
    if (!this.initialized || !this.baseUrl || !this.token) {
      throw new Error('API not initialized. Call init() first.');
    }

    // Clean and validate token
    const cleanToken = this.token.trim();
    if (!cleanToken) {
      throw new Error('API token is empty or invalid');
    }

    // Ensure endpoint starts with /
    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }

    const url = `${this.baseUrl}${endpoint}`;

    const fetchOptions = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token token=${cleanToken}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'omit',
      cache: 'no-cache'
    };

    // Add body for POST/PUT requests
    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && data) {
      fetchOptions.body = JSON.stringify(data);
    }

    console.log(`Making ${method} request to: ${url}`);
    console.log('Request headers:', {
      'Content-Type': fetchOptions.headers['Content-Type'],
      'Authorization': `Token token=${cleanToken.substring(0, 10)}...`, // Log only first 10 chars
      'Accept': fetchOptions.headers['Accept']
    });

    try {
      const response = await fetch(url, fetchOptions);

      console.log(`Response status: ${response.status}`);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      // Enhanced error handling for 401/403
      if (response.status === 401 || response.status === 403) {
        let errorDetails = '';
        try {
          const errorText = await response.text();
          console.error('Authentication error details:', errorText);

          // Try to parse JSON error
          try {
            const errorJson = JSON.parse(errorText);
            errorDetails = errorJson.error || errorJson.error_human || errorJson.message || errorText;
          } catch (parseError) {
            errorDetails = errorText;
          }
        } catch (textError) {
          errorDetails = 'Unable to read error response';
        }

        // Provide specific guidance based on error
        if (response.status === 401) {
          throw new Error(`Authentication failed (401): ${errorDetails}. Please check your API token - it may be invalid or expired.`);
        } else {
          throw new Error(`Access denied (403): ${errorDetails}. Please check your user permissions - you may need Agent role or higher.`);
        }
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorText = await response.text();
          console.error('Error response body:', errorText);

          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error || errorJson.error_human || errorJson.message) {
              errorMessage += ` - ${errorJson.error || errorJson.error_human || errorJson.message}`;
            }
          } catch (parseError) {
            if (errorText.length < 200) {
              errorMessage += ` - ${errorText}`;
            }
          }
        } catch (textError) {
          console.error('Could not read error response:', textError);
        }

        throw new Error(errorMessage);
      }

      // Handle response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log('API Response received successfully');
        return result;
      } else {
        const text = await response.text();
        console.log('API Response (text):', text);
        return text || true;
      }

    } catch (error) {
      console.error(`API request failed:`, error);

      // Provide helpful error messages
      if (error.message.includes('Failed to fetch')) {
        throw new Error(`Network error: Could not connect to ${this.baseUrl}. Please check your URL and network connection.`);
      }

      throw error;
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
   * 
   * Uses the official Zammad API endpoint:
   * GET /api/v1/tickets/{ticket_id}
   * 
   * Documentation: docs/zammad/docs.zammad.org/en/latest/api/ticket/index.html#show
   * Required permission: ticket.agent or ticket.customer
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

    // Primary endpoint is the official one, followed by alternative endpoints for compatibility
    const endpoints = [
      `/api/v1/tickets/${ticketId}`, // Official API endpoint
      `/api/v1/tickets/search?number=${ticketId}`, // Alternative using search
      `/api/v1/tickets?number=${ticketId}` // Alternative using query parameter
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
   * 
   * Uses the official Zammad API endpoint:
   * GET /api/v1/tickets/{ticket_id}/time_accountings
   * 
   * Documentation: docs/zammad/docs.zammad.org/en/latest/api/ticket/timeaccounting.html#list
   * Required permission: ticket.agent or admin.time_accounting
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

    // Official API endpoint for time accounting entries
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
   * 
   * Uses the official Zammad API endpoint:
   * POST /api/v1/tickets/{ticket_id}/time_accountings
   * 
   * Documentation: docs/zammad/docs.zammad.org/en/latest/api/ticket/timeaccounting.html#create
   * Required permission: ticket.agent or admin.time_accounting
   * 
   * @param {number|string} ticketId - The ID of the ticket to add time to
   * @param {number} timeSpent - The amount of time spent (can be negative for corrections)
   * @param {string} comment - Optional comment for the time entry
   * @returns {Promise<object>} The created time entry
   */
  async submitTimeEntry(ticketId, timeSpent, comment = '', date = '') {
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

    // Prepare data according to the API documentation
    const data = {
      time_unit: timeSpent,
      ticket_id: ticketId
    };

    if (comment) {
      data.comment = comment;
    }

    // Add date if provided
    if (date) {
      data.created_at = date;
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


    // Official API endpoint for creating time accounting entries
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
   * Uses detected API features to optimize the approach
   * 
   * Uses multiple Zammad API endpoints with fallbacks:
   * 1. GET /api/v1/tickets/search?query=owner.id:{user_id} (if search is supported)
   * 2. GET /api/v1/tickets?filter[owner_id]={user_id}
   * 3. GET /api/v1/tickets?owner_id={user_id}
   * 
   * Documentation: docs/zammad/docs.zammad.org/en/latest/api/ticket/index.html#list
   * Required permission: ticket.agent
   * 
   * @returns {Promise<Array>} List of tickets assigned to the current user
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
        console.log('Trying cached assigned tickets endpoint:', this.successfulEndpoints.assignedTickets);
        return await this.request(this.successfulEndpoints.assignedTickets);
      } catch (error) {
        console.error('Cached assigned tickets endpoint failed:', error);
        this.successfulEndpoints.assignedTickets = null;
      }
    }

    // Define endpoints to try
    let endpoints = [];

    // Prioritize endpoints based on detected API features
    if (this.apiFeatures && this.apiFeatures.supportsTicketSearch === false) {
      console.log('API is known to NOT support ticket search, using only filter endpoints');
      // If search is not supported, only use filter endpoints
      if (this.currentUserId) {
        endpoints = [
          `/api/v1/tickets?filter[owner_id]=${this.currentUserId}`,
          `/api/v1/tickets?owner_id=${this.currentUserId}`,
          '/api/v1/tickets?filter[owner_id]=me',
          '/api/v1/tickets?owner_id=me'
        ];
      } else {
        endpoints = [
          '/api/v1/tickets?filter[owner_id]=me',
          '/api/v1/tickets?owner_id=me'
        ];
      }
    } else {
      // Use all endpoints, with search endpoints first if search is known to be supported
      if (this.apiFeatures && this.apiFeatures.supportsTicketSearch === true) {
        console.log('API is known to support ticket search, prioritizing search endpoints');
        if (this.currentUserId) {
          endpoints = [
            `/api/v1/tickets/search?query=owner.id:${this.currentUserId}`,
            `/api/v1/tickets?filter[owner_id]=${this.currentUserId}`,
            `/api/v1/tickets?owner_id=${this.currentUserId}`,
            '/api/v1/tickets/search?query=owner.id:me',
            '/api/v1/tickets?filter[owner_id]=me',
            '/api/v1/tickets?owner_id=me'
          ];
        } else {
          endpoints = [
            '/api/v1/tickets/search?query=owner.id:me',
            '/api/v1/tickets?filter[owner_id]=me',
            '/api/v1/tickets?owner_id=me'
          ];
        }
      } else {
        // We don't know if search is supported, try all endpoints
        // but prioritize explicit user ID endpoints
        if (this.currentUserId) {
          endpoints = [
            `/api/v1/tickets/search?query=owner.id:${this.currentUserId}`,
            `/api/v1/tickets?filter[owner_id]=${this.currentUserId}`,
            `/api/v1/tickets?owner_id=${this.currentUserId}`,
            '/api/v1/tickets/search?query=owner.id:me',
            '/api/v1/tickets?filter[owner_id]=me',
            '/api/v1/tickets?owner_id=me'
          ];
        } else {
          endpoints = [
            '/api/v1/tickets/search?query=owner.id:me',
            '/api/v1/tickets?filter[owner_id]=me',
            '/api/v1/tickets?owner_id=me'
          ];
        }
      }
    }

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying assigned tickets endpoint: ${endpoint}`);
        const result = await this.request(endpoint);

        // Update API features based on the successful endpoint
        if (this.apiFeatures) {
          if (endpoint.includes('/search')) {
            this.apiFeatures.supportsTicketSearch = true;
            this.saveCachedApiFeatures();
            console.log('API supports ticket search endpoint');
          }
        }

        this.successfulEndpoints.assignedTickets = endpoint;
        this.saveCachedEndpoints();

        return result;
      } catch (error) {
        console.error(`Error with assigned tickets endpoint ${endpoint}:`, error);

        // Update API features based on error
        if (endpoint.includes('/search') && error.message.includes('404') && this.apiFeatures) {
          this.apiFeatures.supportsTicketSearch = false;
          this.saveCachedApiFeatures();
          console.log('API does not support ticket search endpoint (404 error)');
        }
      }
    }

    throw new Error('Failed to get assigned tickets');
  }

  /**
   * Get all tickets, optionally filtered by user ID
   * @param {string|number} userId - Optional user ID to filter by
   * @returns {Array} Array of tickets
   */
  async getAllTickets(userId = null) {
    console.log(`Getting all tickets${userId ? ' for user ID: ' + userId : ''}`);

    // If no specific user ID is provided, check if we should use the configured user IDs
    if (!userId) {
      try {
        const settings = await this.getSettings();
        if (settings.userIds) {
          // If we have multiple user IDs, we'll need to make multiple requests and combine the results
          const userIdList = settings.userIds.split(',').map(id => id.trim()).filter(id => id);
          userIdList.push('1'); // Always include user ID 1 (unassigned) for compatibility
          if (userIdList.length > 0) {
            console.log(`Using configured user IDs from settings: ${userIdList.join(', ')}`);

            // Get tickets for each user ID and combine them
            const allTickets = [];
            for (const id of userIdList) {
              try {
                const userTickets = await this.getTicketsForUser(id);
                if (Array.isArray(userTickets)) {
                  allTickets.push(...userTickets);
                }
              } catch (error) {
                console.error(`Error getting tickets for user ID ${id}:`, error);
                // Continue with other user IDs
              }
            }

            // Return the combined tickets
            return allTickets;
          }
        }
      } catch (error) {
        console.error('Error checking for configured user IDs:', error);
        // Continue with default behavior
      }
    }

    // If a specific user ID is provided or no configured user IDs, get tickets for that user
    if (userId) {
      return this.getTicketsForUser(userId);
    }

    // If no user ID is provided and no configured user IDs, get all tickets
    return this.getAllTicketsUnfiltered();
  }

  /**
   * Get tickets for a specific user
   * @param {string|number} userId - User ID to get tickets for
   * @returns {Array} Array of tickets
   */
  async getTicketsForUser(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Getting tickets for user ID: ${userId}`);

    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const formattedDate = threeYearsAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    const query = `owner.id:${userId} AND created_at:>${formattedDate} AND !state.id:2 AND !state.id 3`;
    const perPage = 1000;
    const totalPages = 2;
    const allTickets = [];

    for (let page = 1; page <= totalPages; page++) {
      const endpoint = `/api/v1/tickets/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;
      try {
        console.log(`Fetching page ${page} from endpoint: ${endpoint}`);
        const result = await this.request(endpoint);

        if (Array.isArray(result)) {
          allTickets.push(...result);
          console.log(`Fetched ${result.length} tickets from page ${page}`);
        } else {
          console.log(`No tickets found on page ${page}`);
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error);
        // Optional: Weiter mit der nächsten Seite
      }
    }

    console.log(`Total tickets fetched: ${allTickets.length}`);
    return allTickets;
  }  /**
   * Get all tickets without filtering
   * @returns {Array} Array of tickets
   */
  async getAllTicketsUnfiltered() {
    console.log('Getting all tickets (unfiltered)');

    const endpoints = [
      '/api/v1/tickets',
      '/api/v1/tickets/search?query=*',
      '/api/v1/tickets/search'
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint for all tickets: ${endpoint}`);
        const result = await this.request(endpoint);
        console.log(`Successfully got ${result ? result.length : 0} tickets`);
        return result;
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error);
        // Continue with next endpoint
      }
    }

    throw new Error('Failed to get all tickets');
  }

  /**
   * Get all users from the API
   * @returns {Array} Array of users
   */
  async getAllUsers() {
    console.log('Getting all users from API');

    // Try cached endpoint first
    if (this.successfulEndpoints.allUsers) {
      try {
        console.log('Trying cached all users endpoint:', this.successfulEndpoints.allUsers);
        const users = await this.request(this.successfulEndpoints.allUsers);
        console.log(`Successfully got ${users ? users.length : 0} users from cached endpoint`);
        return users;
      } catch (error) {
        console.error('Cached all users endpoint failed:', error);
        this.successfulEndpoints.allUsers = null;
      }
    }

    // Try different endpoints for getting users
    const endpoints = [
      '/api/v1/users',
      '/api/v1/users/search?query=*',
      '/api/v1/users?expand=true',
      '/api/v1/users?per_page=100'
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying all users endpoint: ${endpoint}`);
        const users = await this.request(endpoint);

        if (Array.isArray(users) && users.length > 0) {
          console.log(`Successfully got ${users.length} users from endpoint: ${endpoint}`);

          // Cache the successful endpoint
          this.successfulEndpoints.allUsers = endpoint;
          this.saveCachedEndpoints();

          return users;
        } else {
          console.warn(`Endpoint ${endpoint} returned no users or invalid format`);
        }
      } catch (error) {
        console.error(`Error with all users endpoint ${endpoint}:`, error);
      }
    }

    // If all endpoints failed, try to use the current user as a fallback
    console.warn('All user endpoints failed, using current user as fallback');
    try {
      const currentUser = await this.fetchCurrentUser();
      if (currentUser) {
        return [currentUser];
      }
    } catch (error) {
      console.error('Failed to get current user as fallback:', error);
    }

    // If everything failed, return an empty array
    console.error('Failed to get users from any endpoint');
    return [];
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
   * 
   * Uses the official Zammad API endpoint:
   * DELETE /api/v1/tickets/{ticket_id}/time_accountings/{timeaccounting_id}
   * 
   * Documentation: docs/zammad/docs.zammad.org/en/latest/api/ticket/timeaccounting.html#remove
   * Required permission: admin.time_accounting
   * 
   * @param {number|string} entryId - The ID of the time entry to delete
   * @param {number|string} ticketId - Optional ticket ID if known
   * @returns {Promise<object>} Success response
   */
  async deleteTimeEntry(entryId, ticketId = null) {
    if (!entryId) {
      throw new Error('Entry ID is required');
    }

    console.log(`Attempting to delete time entry ${entryId} (token-only authentication)`);

    // Array of endpoints to try for deletion
    const deleteEndpoints = [];

    // If ticket ID is provided, try the ticket-specific endpoint first (official API)
    if (ticketId) {
      deleteEndpoints.push(`/api/v1/tickets/${ticketId}/time_accountings/${entryId}`);
    } else {
      // If no ticket ID provided, try to get the time entry details to determine the ticket ID
      try {
        const timeEntryDetails = await this.getTimeEntryDetails(entryId);
        console.log('Time entry details:', timeEntryDetails);

        if (timeEntryDetails && timeEntryDetails.ticket_id) {
          deleteEndpoints.push(`/api/v1/tickets/${timeEntryDetails.ticket_id}/time_accountings/${entryId}`);
        }
      } catch (detailsError) {
        console.warn('Could not get time entry details, proceeding with direct deletion:', detailsError.message);
      }
    }

    // Always include the direct endpoint as a fallback
    deleteEndpoints.push(`/api/v1/time_accountings/${entryId}`);

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
   * Uses detected API features to optimize the approach
   */
  async getTimeHistory() {
    console.log('Getting time tracking history for current user');

    // Try cached endpoint first, but be careful with admin endpoints
    if (this.successfulEndpoints.timeHistory && this.successfulEndpoints.timeHistory !== 'fallback_via_tickets') {
      try {
        console.log('Trying cached time history endpoint:', this.successfulEndpoints.timeHistory);
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

    // Determine which method to try first based on API features
    let tryDirectEndpointsFirst = true;

    // If we know the API doesn't support direct time_accountings, skip to fallback
    if (this.apiFeatures && this.apiFeatures.supportsTimeAccounting === false) {
      console.log('API is known to NOT support direct time_accountings, skipping to fallback method');
      tryDirectEndpointsFirst = false;
    }

    // Method 1: Try direct time_accountings endpoints (requires admin permissions)
    // Only try these if we have a user ID and either we don't know if the API supports it
    // or we know it does support it
    if (tryDirectEndpointsFirst && this.currentUserId) {
      const adminEndpoints = [
        `/api/v1/time_accountings?created_by_id=${this.currentUserId}`,
        '/api/v1/time_accountings'
      ];

      for (const endpoint of adminEndpoints) {
        try {
          console.log(`Trying time history endpoint: ${endpoint}`);
          const result = await this.request(endpoint);

          // Update API features - we now know time_accountings is supported
          if (this.apiFeatures) {
            this.apiFeatures.supportsTimeAccounting = true;
            this.saveCachedApiFeatures();
          }

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
          console.warn(`Admin endpoint ${endpoint} failed:`, error.message);

          // Update API features based on error
          if (error.message.includes('404')) {
            // If it's a 404, the endpoint doesn't exist
            if (this.apiFeatures) {
              this.apiFeatures.supportsTimeAccounting = false;
              this.saveCachedApiFeatures();
            }
            console.log('API does not support direct time_accountings endpoint (404 error)');
            break; // No need to try other admin endpoints
          } else if (error.message.includes('403')) {
            // If it's a 403, the endpoint exists but we don't have permission
            if (this.apiFeatures) {
              this.apiFeatures.supportsTimeAccounting = true;
              this.saveCachedApiFeatures();
            }
            console.log('API supports time_accountings endpoint but permission denied (403 error)');
          }
          // Continue with next endpoint or fallback
        }
      }
    }

    // Method 2: Fallback - Get assigned tickets and collect time entries from each
    console.log('Using fallback method via assigned tickets');

    try {
      // Get assigned tickets first
      const tickets = await this.getAssignedTickets();
      console.log(`Found ${tickets ? tickets.length : 0} assigned tickets for time history collection`);

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
   * Get time entry details
   * 
   * Uses the official Zammad API endpoint:
   * GET /api/v1/tickets/{ticket_id}/time_accountings/{timeaccounting_id}
   * 
   * Documentation: docs/zammad/docs.zammad.org/en/latest/api/ticket/timeaccounting.html#show
   * Required permission: ticket.agent or admin.time_accounting
   * 
   * @param {number|string} entryId - The ID of the time entry to get details for
   * @param {number|string} ticketId - Optional ticket ID if known
   * @returns {Promise<object>} The time entry details
   */
  async getTimeEntryDetails(entryId, ticketId = null) {
    if (!entryId) {
      throw new Error('Time entry ID is required');
    }

    // Array of endpoints to try
    const endpoints = [];

    // If ticket ID is provided, try the ticket-specific endpoint first (official API)
    if (ticketId) {
      endpoints.push(`/api/v1/tickets/${ticketId}/time_accountings/${entryId}`);
    }

    // Also try the direct endpoint as a fallback
    endpoints.push(`/api/v1/time_accountings/${entryId}`);

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

  /**
   * Update a time entry
   * 
   * Uses the official Zammad API endpoint:
   * PUT /api/v1/tickets/{ticket_id}/time_accountings/{timeaccounting_id}
   * 
   * Documentation: docs/zammad/docs.zammad.org/en/latest/api/ticket/timeaccounting.html#update
   * Required permission: admin.time_accounting
   * 
   * @param {number|string} entryId - The ID of the time entry to update
   * @param {number|string} ticketId - The ID of the ticket the time entry belongs to
   * @param {object} data - The data to update (time_unit, type_id, etc.)
   * @returns {Promise<object>} The updated time entry
   */
  async updateTimeEntry(entryId, ticketId, data) {
    if (!entryId) {
      throw new Error('Time entry ID is required');
    }

    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Update data is required and must be an object');
    }

    // Ensure the entry ID is included in the data
    const updateData = {
      ...data,
      id: entryId
    };

    console.log(`Updating time entry ${entryId} for ticket ${ticketId}`, updateData);

    try {
      // Use the official API endpoint
      const endpoint = `/api/v1/tickets/${ticketId}/time_accountings/${entryId}`;
      const result = await this.request(endpoint, 'PUT', updateData);
      console.log(`Successfully updated time entry ${entryId}`, result);

      // Clear time history cache after successful update
      this.clearTimeHistoryCache();

      return result;
    } catch (error) {
      console.error(`Failed to update time entry ${entryId}:`, error);

      // Provide more specific error messages
      if (error.message.includes('403')) {
        throw new Error('Permission denied: You need admin.time_accounting permission to update time entries. Please check your API token permissions or contact your Zammad administrator.');
      }

      throw new Error(`Failed to update time entry: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
const zammadApi = new ZammadAPI();

// Make it available globally
window.zammadApi = zammadApi;
console.log('Zammad API singleton instance created and available globally');
