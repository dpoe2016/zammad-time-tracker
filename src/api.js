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
      supportsMe: null, // Whether /api/v1/users/me is supported
      supportsTimeAccounting: null, // Whether direct time_accountings endpoint is supported
      supportsTicketSearch: null, // Whether ticket search API is supported
    };

    // Cache for successful endpoints
    this.successfulEndpoints = {
      ticket: null,
      timeEntries: null,
      timeSubmission: null,
      assignedTickets: null,
      timeHistory: null,
      userProfile: null,
      allUsers: null,
    };

    // Enhanced caching system for customer data
    this.customerCache = new Map();
    this.cacheTimestamp = null;
    this.cacheExpiryMs = 30 * 60 * 1000; // 30 minutes - customer data changes infrequently

    // Ticket caching system
    this.ticketCache = new Map();
    this.ticketCacheTimestamp = null;
    this.ticketCacheExpiryMs = 5 * 60 * 1000; // 5 minutes - tickets change more frequently

    // Time entry caching system
    this.timeEntryCache = new Map(); // Stores { data, timestamp } objects
    this.timeEntryCacheExpiryMs = 10 * 60 * 1000; // 10 minutes - time entries change moderately

    // Request deduplication for ongoing API calls
    this.ongoingRequests = new Map();

    // Persistent cache keys
    this.CUSTOMER_CACHE_KEY = 'zammadCustomerCache';
    this.CUSTOMER_CACHE_TIMESTAMP_KEY = 'zammadCustomerCacheTimestamp';
    this.TICKET_CACHE_KEY = 'zammadTicketCache';
    this.TICKET_CACHE_TIMESTAMP_KEY = 'zammadTicketCacheTimestamp';

    // Load cached data from storage
    this.loadCachedEndpoints();
    this.loadCachedUserProfile();
    this.loadCachedApiFeatures();
    this.loadCachedCustomerData();
    this.loadCachedTicketData();
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
   * Load cached customer data from persistent storage
   */
  async loadCachedCustomerData() {
    try {
      const result = await chrome.storage.local.get([
        this.CUSTOMER_CACHE_KEY,
        this.CUSTOMER_CACHE_TIMESTAMP_KEY,
      ]);
      if (
        result[this.CUSTOMER_CACHE_KEY] &&
        result[this.CUSTOMER_CACHE_TIMESTAMP_KEY]
      ) {
        const cachedData = result[this.CUSTOMER_CACHE_KEY];
        const timestamp = result[this.CUSTOMER_CACHE_TIMESTAMP_KEY];

        // Check if cache is still valid
        const now = Date.now();
        if (now - timestamp < this.cacheExpiryMs) {
          this.customerCache = new Map(Object.entries(cachedData));
          this.cacheTimestamp = timestamp;
          console.log(
            `Loaded ${this.customerCache.size} customers from persistent cache`
          );
        } else {
          console.log('Persistent customer cache expired, clearing...');
          await this.clearPersistedCustomerCache();
        }
      }
    } catch (error) {
      console.error('Error loading cached customer data:', error);
    }
  }

  /**
   * Save customer cache to persistent storage
   */
  async saveCustomerCacheToStorage() {
    try {
      if (this.customerCache.size > 0 && this.cacheTimestamp) {
        const cacheObject = Object.fromEntries(this.customerCache);
        await chrome.storage.local.set({
          [this.CUSTOMER_CACHE_KEY]: cacheObject,
          [this.CUSTOMER_CACHE_TIMESTAMP_KEY]: this.cacheTimestamp,
        });
        console.log(
          `Saved ${this.customerCache.size} customers to persistent cache`
        );
      }
    } catch (error) {
      console.error('Error saving customer cache to storage:', error);
    }
  }

  /**
   * Clear persisted customer cache
   */
  async clearPersistedCustomerCache() {
    try {
      await chrome.storage.local.remove([
        this.CUSTOMER_CACHE_KEY,
        this.CUSTOMER_CACHE_TIMESTAMP_KEY,
      ]);
      console.log('Cleared persistent customer cache');
    } catch (error) {
      console.error('Error clearing persistent customer cache:', error);
    }
  }

  /**
   * Load cached ticket data from persistent storage
   */
  async loadCachedTicketData() {
    try {
      const result = await chrome.storage.local.get([
        this.TICKET_CACHE_KEY,
        this.TICKET_CACHE_TIMESTAMP_KEY,
      ]);
      if (
        result[this.TICKET_CACHE_KEY] &&
        result[this.TICKET_CACHE_TIMESTAMP_KEY]
      ) {
        const cachedData = result[this.TICKET_CACHE_KEY];
        const timestamp = result[this.TICKET_CACHE_TIMESTAMP_KEY];

        // Check if cache is still valid
        const now = Date.now();
        if (now - timestamp < this.ticketCacheExpiryMs) {
          this.ticketCache = new Map(Object.entries(cachedData));
          this.ticketCacheTimestamp = timestamp;
          console.log(
            `Loaded ${this.ticketCache.size} tickets from persistent cache`
          );
        } else {
          console.log('Persistent ticket cache expired, clearing...');
          await this.clearPersistedTicketCache();
        }
      }
    } catch (error) {
      console.error('Error loading cached ticket data:', error);
    }
  }

  /**
   * Save ticket cache to persistent storage
   */
  async saveTicketCacheToStorage() {
    try {
      if (this.ticketCache.size > 0 && this.ticketCacheTimestamp) {
        const cacheObject = Object.fromEntries(this.ticketCache);
        await chrome.storage.local.set({
          [this.TICKET_CACHE_KEY]: cacheObject,
          [this.TICKET_CACHE_TIMESTAMP_KEY]: this.ticketCacheTimestamp,
        });
        console.log(
          `Saved ${this.ticketCache.size} tickets to persistent cache`
        );
      }
    } catch (error) {
      console.error('Error saving ticket cache to storage:', error);
    }
  }

  /**
   * Clear persisted ticket cache
   */
  async clearPersistedTicketCache() {
    try {
      await chrome.storage.local.remove([
        this.TICKET_CACHE_KEY,
        this.TICKET_CACHE_TIMESTAMP_KEY,
      ]);
      console.log('Cleared persistent ticket cache');
    } catch (error) {
      console.error('Error clearing persistent ticket cache:', error);
    }
  }

  /**
   * Get tickets from cache if available and valid
   * @param {string} cacheKey - The cache key to look for
   * @returns {Array|null} Cached tickets or null if not found/expired
   */
  getCachedTickets(cacheKey = 'default') {
    if (!this.ticketCacheTimestamp) {
      return null;
    }

    const now = Date.now();
    const isCacheValid =
      now - this.ticketCacheTimestamp < this.ticketCacheExpiryMs;

    if (!isCacheValid) {
      console.log('Ticket cache expired');
      this.ticketCache.clear();
      this.ticketCacheTimestamp = null;
      return null;
    }

    const cachedTickets = this.ticketCache.get(cacheKey);
    if (cachedTickets) {
      console.log(
        `Found ${cachedTickets.length} tickets in cache for key: ${cacheKey}`
      );
      return cachedTickets;
    }

    return null;
  }

  /**
   * Cache tickets with a specific key
   * @param {string} cacheKey - The cache key to use
   * @param {Array} tickets - The tickets to cache
   */
  async cacheTickets(cacheKey = 'default', tickets) {
    if (!Array.isArray(tickets)) {
      console.warn('Cannot cache tickets: invalid data format');
      return;
    }

    this.ticketCache.set(cacheKey, tickets);
    this.ticketCacheTimestamp = Date.now();

    console.log(`Cached ${tickets.length} tickets with key: ${cacheKey}`);

    // Save to persistent storage
    await this.saveTicketCacheToStorage();
  }

  /**
   * Refresh ticket cache in the background
   * @param {string} cacheKey - The cache key to refresh
   * @param {Function} refreshFunction - Function to call to get fresh data
   * @param {Array} refreshArgs - Arguments to pass to the refresh function
   */
  async refreshTicketCache(cacheKey, refreshFunction, refreshArgs = []) {
    try {
      console.log(`Background refresh starting for cache key: ${cacheKey}`);

      // Call the refresh function with force refresh flag
      const freshTickets = await refreshFunction.apply(this, [
        ...refreshArgs,
        true,
      ]);

      console.log(
        `Background refresh completed for cache key: ${cacheKey}, got ${freshTickets.length} tickets`
      );

      // Notify any listeners that the cache has been updated
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const event = new CustomEvent('ticketCacheRefreshed', {
          detail: { cacheKey, tickets: freshTickets },
        });
        window.dispatchEvent(event);
      }

      return freshTickets;
    } catch (error) {
      console.error(
        `Background refresh failed for cache key: ${cacheKey}`,
        error
      );
      return null;
    }
  }

  /**
   * Start automatic cache refresh for tickets
   * @param {number} intervalMs - Refresh interval in milliseconds (default: 2 minutes)
   */
  startTicketCacheAutoRefresh(intervalMs = 2 * 60 * 1000) {
    // Clear any existing interval
    if (this.ticketCacheRefreshInterval) {
      clearInterval(this.ticketCacheRefreshInterval);
    }

    this.ticketCacheRefreshInterval = setInterval(async () => {
      console.log('Starting automatic ticket cache refresh');

      // Get existing cache keys
      const existingCacheKeys = Array.from(this.ticketCache.keys());

      // Always include default cache keys to ensure new tickets are detected
      // even when no cache exists yet
      const defaultCacheKeys = ['assigned_tickets', 'all_tickets'];

      // Combine existing keys with default keys (remove duplicates)
      const allCacheKeys = [
        ...new Set([...existingCacheKeys, ...defaultCacheKeys]),
      ];

      console.log(`Refreshing cache keys: ${allCacheKeys.join(', ')}`);

      for (const cacheKey of allCacheKeys) {
        try {
          if (cacheKey === 'assigned_tickets') {
            await this.refreshTicketCache(cacheKey, this.getAssignedTickets);
          } else if (cacheKey.startsWith('user_tickets_')) {
            const userId = cacheKey.replace('user_tickets_', '');
            await this.refreshTicketCache(cacheKey, this.getAllTickets, [
              userId,
            ]);
          } else if (cacheKey === 'all_tickets') {
            await this.refreshTicketCache(cacheKey, this.getAllTickets);
          }
        } catch (error) {
          console.error(`Error refreshing cache key ${cacheKey}:`, error);
        }

        // Add small delay between refreshes to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }, intervalMs);

    console.log(
      `Ticket cache auto-refresh started with ${intervalMs / 1000}s interval`
    );
  }

  /**
   * Stop automatic cache refresh
   */
  stopTicketCacheAutoRefresh() {
    if (this.ticketCacheRefreshInterval) {
      clearInterval(this.ticketCacheRefreshInterval);
      this.ticketCacheRefreshInterval = null;
      console.log('Ticket cache auto-refresh stopped');
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
      await chrome.storage.local.set({
        zammadApiEndpoints: this.successfulEndpoints,
      });
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

    const normalizedBaseUrl = baseUrl.endsWith('/')
      ? baseUrl.slice(0, -1)
      : baseUrl;

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
        allUsers: null,
      };
      this.saveCachedEndpoints();

      // Clear user profile and API features
      this.userProfile = null;
      this.currentUserId = null;
      this.apiVersion = null;
      this.apiFeatures = {
        supportsMe: null,
        supportsTimeAccounting: null,
        supportsTicketSearch: null,
      };

      // Clear storage
      chrome.storage.local.remove(['zammadUserProfile', 'zammadApiFeatures']);

      // Clear our new time entry cache as well
      this.timeEntryCache.clear();
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
      supportsTicketSearch: false,
    };

    // Try to get API version info
    try {
      // First try the /api/v1/version endpoint
      try {
        const versionInfo = await this.request('/api/v1/version', 'GET', null, {
          retry: false,
        });
        if (versionInfo && versionInfo.version) {
          features.apiVersion = versionInfo.version;
          console.log(`Detected Zammad version: ${features.apiVersion}`);
        }
      } catch (versionError) {
        console.log(
          'Version endpoint not available, trying alternative methods'
        );

        // Try to get version from the about page
        try {
          const response = await fetch(`${this.baseUrl}/api/v1/about`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });

          if (response.ok) {
            const aboutInfo = await response.json();
            if (aboutInfo && aboutInfo.version) {
              features.apiVersion = aboutInfo.version;
              console.log(
                `Detected Zammad version from about: ${features.apiVersion}`
              );
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
      const meResponse = await this.request('/api/v1/users/me', 'GET', null, {
        retry: false,
      });
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
      await this.request('/api/v1/time_accountings', 'GET', null, {
        retry: false,
      });
      features.supportsTimeAccounting = true;
      console.log('API supports direct time_accountings endpoint');
    } catch (timeError) {
      // Check if it's a permission error (403) or not found error (404)
      if (timeError.message.includes('403')) {
        // If it's a permission error, the endpoint exists but we don't have access
        features.supportsTimeAccounting = true;
        console.log(
          'API supports time_accountings endpoint but permission denied'
        );
      } else {
        features.supportsTimeAccounting = false;
        console.log('Direct time_accountings endpoint not supported');
      }
    }

    // Test if ticket search API is supported
    try {
      await this.request('/api/v1/tickets/search?query=*', 'GET', null, {
        retry: false,
      });
      features.supportsTicketSearch = true;
      console.log('API supports ticket search endpoint');
    } catch (searchError) {
      // Check if it's a permission error (403) or not found error (404)
      if (searchError.message.includes('403')) {
        // If it's a permission error, the endpoint exists but we don't have access
        features.supportsTicketSearch = true;
        console.log(
          'API supports ticket search endpoint but permission denied'
        );
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
          Authorization: `Token token=${this.token}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'omit',
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
      console.warn(
        `Unexpected status code ${response.status} when checking token validity`
      );
      return true;
    } catch (error) {
      console.error('Error checking token validity:', error);

      // Network errors don't necessarily mean the token is invalid
      if (error.message.includes('Failed to fetch')) {
        console.warn(
          'Network error when checking token validity, assuming token is still valid'
        );
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
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Test with token-only
      const tokenResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token token=${this.token}`,
        },
        credentials: 'omit',
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
        setTimeout(
          () => reject(new Error('Token validation timeout after 10 seconds')),
          10000
        );
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
        console.error(
          'Token validation timed out - check network connection and API endpoint'
        );
      } else if (
        error.message.includes('401') ||
        error.message.includes('403')
      ) {
        console.error(
          'Token validation failed - invalid token or insufficient permissions'
        );
      } else if (
        error.message.includes('fetch') ||
        error.message.includes('Network error')
      ) {
        console.error(
          'Network error during token validation - check URL and connectivity'
        );
        // Add a more descriptive message for network errors
        console.error(
          `Could not connect to ${this.baseUrl}. Please check your network connection and URL settings.`
        );
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
        console.log(
          'Trying cached user profile endpoint:',
          this.successfulEndpoints.userProfile
        );
        const profile = await this.request(
          this.successfulEndpoints.userProfile
        );
        this.userProfile = profile;
        this.currentUserId = profile.id;
        this.saveCachedUserProfile();
        console.log(
          'User profile fetched from cache successfully:',
          profile.id
        );
        return profile;
      } catch (error) {
        console.error('Cached user profile endpoint failed:', error);
        this.successfulEndpoints.userProfile = null;
      }
    }

    // Define multiple endpoints to try
    let endpoints = [
      '/api/v1/users/me', // Official Zammad API endpoint
    ];

    // Prioritize endpoints based on detected API features
    if (this.apiFeatures) {
      // If we know the /me endpoint is supported, prioritize it
      if (this.apiFeatures.supportsMe === true) {
        console.log(
          'API is known to support /api/v1/users/me, prioritizing this endpoint'
        );
        endpoints = [
          '/api/v1/users/me',
          ...endpoints.filter((e) => e !== '/api/v1/users/me'),
        ];
      } else if (this.apiFeatures.supportsMe === false) {
        // If we know the /me endpoint is NOT supported, remove it
        console.log(
          'API is known to NOT support /api/v1/users/me, removing this endpoint'
        );
        endpoints = endpoints.filter((e) => e !== '/api/v1/users/me');
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

          console.log(
            'User profile fetched successfully:',
            profile.id || profile.login
          );
          return profile;
        } else {
          console.warn(`Endpoint ${endpoint} returned invalid profile data`);
          // Continue to next endpoint
        }
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error.message);
        lastError = error;

        // Update API features if this was the /me endpoint and it returned 404
        if (
          endpoint === '/api/v1/users/me' &&
          error.message.includes('404') &&
          this.apiFeatures
        ) {
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
          console.log(
            `Extracted possible user ID from token: ${possibleUserId}`
          );
          this.currentUserId = possibleUserId;
          return { id: possibleUserId, source: 'token_extraction' };
        }
      }
    } catch (tokenError) {
      console.error('Error extracting user ID from token:', tokenError);
    }

    // Provide specific guidance based on the last error
    if (lastError) {
      if (
        lastError.message.includes('401') ||
        lastError.message.includes('403')
      ) {
        throw new Error(
          `Authentication failed: Invalid API token or insufficient permissions. Error: ${lastError.message}`
        );
      } else if (lastError.message.includes('404')) {
        throw new Error(
          `API endpoint not found: Your Zammad version may not support these endpoints. Error: ${lastError.message}`
        );
      } else if (
        lastError.message.includes('Failed to fetch') ||
        lastError.message.includes('Network error')
      ) {
        // Handle network connectivity issues more gracefully
        throw new Error(
          `Network error: Could not connect to ${this.baseUrl}. Please check your network connection and URL settings.`
        );
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
      allUsers: null,
    };

    // Clear storage cache
    await this.saveCachedEndpoints();
    await chrome.storage.local.remove(['zammadUserProfile']);

    // Detect session conflicts
    const hasConflict = await this.detectSessionConflict();
    if (hasConflict) {
      console.warn(
        'Session conflict detected - requests will use token-only authentication'
      );
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
        allUsers: null,
      };

      // Clear storage cache
      await this.saveCachedEndpoints();
      await chrome.storage.local.remove(['zammadUserProfile']);

      // Re-validate with token-only
      await this.validateToken();

      console.log(
        'API refreshed with new settings - using token-only authentication'
      );
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
        tokenStart: settings.token
          ? settings.token.substring(0, 10) + '...'
          : 'No token',
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
      ...options,
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
        Authorization: `Token token=${cleanToken}`,
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'omit',
      cache: 'no-cache',
    };

    // Add body for POST/PUT requests
    if (
      (method === 'POST' || method === 'PUT' || method === 'DELETE') &&
      data
    ) {
      fetchOptions.body = JSON.stringify(data);
    }

    console.log(`Making ${method} request to: ${url}`);
    console.log('Request headers:', {
      'Content-Type': fetchOptions.headers['Content-Type'],
      Authorization: `Token token=${cleanToken.substring(0, 10)}...`, // Log only first 10 chars
      Accept: fetchOptions.headers['Accept'],
    });

    try {
      const response = await fetch(url, fetchOptions);

      console.log(`Response status: ${response.status}`);
      console.log(
        'Response headers:',
        Object.fromEntries(response.headers.entries())
      );

      // Enhanced error handling for 401/403
      if (response.status === 401 || response.status === 403) {
        let errorDetails = '';
        try {
          const errorText = await response.text();
          console.error('Authentication error details:', errorText);

          // Try to parse JSON error
          try {
            const errorJson = JSON.parse(errorText);
            errorDetails =
              errorJson.error ||
              errorJson.error_human ||
              errorJson.message ||
              errorText;
          } catch (parseError) {
            errorDetails = errorText;
          }
        } catch (textError) {
          errorDetails = 'Unable to read error response';
        }

        // Provide specific guidance based on error
        if (response.status === 401) {
          throw new Error(
            `Authentication failed (401): ${errorDetails}. Please check your API token - it may be invalid or expired.`
          );
        } else {
          throw new Error(
            `Access denied (403): ${errorDetails}. Please check your user permissions - you may need Agent role or higher.`
          );
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
        throw new Error(
          `Network error: Could not connect to ${this.baseUrl}. Please check your URL and network connection.`
        );
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
        const endpoint = this.successfulEndpoints.ticket.replace(
          '{ticketId}',
          ticketId
        );
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
      `/api/v1/tickets?number=${ticketId}`, // Alternative using query parameter
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const result = await this.request(endpoint);

        // Cache successful endpoint
        this.successfulEndpoints.ticket = endpoint.replace(
          ticketId,
          '{ticketId}'
        );
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

    // Check cache first
    const cacheKey = `timeEntries_${ticketId}`;
    const now = Date.now();

    if (this.timeEntryCache.has(cacheKey)) {
      const cachedEntry = this.timeEntryCache.get(cacheKey);
      if (cachedEntry && (now - cachedEntry.timestamp) < this.timeEntryCacheExpiryMs) {
        console.log(`Using cached time entries for ticket ${ticketId}`);
        return cachedEntry.data;
      }
    }

    // Request deduplication - check if request is already in progress
    const requestKey = `getTimeEntries_${ticketId}`;
    if (this.ongoingRequests.has(requestKey)) {
      console.log(`Returning existing promise for time entries request ${ticketId}`);
      return this.ongoingRequests.get(requestKey);
    }

    // Create and store the promise for this request
    const requestPromise = (async () => {
      try {
        // Try cached endpoint first
        if (this.successfulEndpoints.timeEntries) {
          try {
            const endpoint = this.successfulEndpoints.timeEntries.replace(
              '{ticketId}',
              ticketId
            );
            const result = await this.request(endpoint);

            // Cache the result
            this.timeEntryCache.set(cacheKey, { data: result, timestamp: now });

            return result;
          } catch (error) {
            console.error('Cached time entries endpoint failed:', error);
            this.successfulEndpoints.timeEntries = null;
          }
        }

        // Official API endpoint for time accounting entries
        const endpoint = `/api/v1/tickets/${ticketId}/time_accountings`;
        const result = await this.request(endpoint);

        // Cache the result
        this.timeEntryCache.set(cacheKey, { data: result, timestamp: now });

        this.successfulEndpoints.timeEntries = endpoint.replace(
          ticketId,
          '{ticketId}'
        );
        this.saveCachedEndpoints();
        return result;
      } catch (error) {
        console.error('Failed to get time entries:', error);
        throw new Error('Failed to get time entries');
      } finally {
        // Clean up the ongoing request
        this.ongoingRequests.delete(requestKey);
      }
    })();

    // Store the promise and return it
    this.ongoingRequests.set(requestKey, requestPromise);
    return requestPromise;
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
      return {
        success: true,
        message: 'No adjustment needed (value too small)',
      };
    }

    // Prepare data according to the API documentation
    const data = {
      time_unit: timeSpent,
      ticket_id: ticketId,
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
        const endpoint = this.successfulEndpoints.timeSubmission.includes(
          '{ticketId}'
        )
          ? this.successfulEndpoints.timeSubmission.replace(
              '{ticketId}',
              ticketId
            )
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
      this.successfulEndpoints.timeSubmission = endpoint.replace(
        ticketId,
        '{ticketId}'
      );
      this.saveCachedEndpoints();

      // Clear cached time entries for this specific ticket
      const cacheKey = `timeEntries_${ticketId}`;
      this.timeEntryCache.delete(cacheKey);

      return result;
    } catch (error) {
      console.error('Failed to submit time entry:', error);
      throw new Error('Failed to submit time entry');
    }
  }

  /**
   * Get tickets assigned to the current user
   * Uses detected API features to optimize the approach with cache-first loading
   *
   * Uses multiple Zammad API endpoints with fallbacks:
   * 1. GET /api/v1/tickets/search?query=owner.id:{user_id} (if search is supported)
   * 2. GET /api/v1/tickets?filter[owner_id]={user_id}
   * 3. GET /api/v1/tickets?owner_id={user_id}
   *
   * Documentation: docs/zammad/docs.zammad.org/en/latest/api/ticket/index.html#list
   * Required permission: ticket.agent
   *
   * @param {boolean} forceRefresh - If true, skip cache and fetch from API
   * @returns {Promise<Array>} List of tickets assigned to the current user
   */
  async getAssignedTickets(forceRefresh = false) {
    console.log('Getting tickets assigned to the current user');

    const cacheKey = 'assigned_tickets';

    // Try cache first unless force refresh is requested
    if (!forceRefresh) {
      const cachedTickets = this.getCachedTickets(cacheKey);
      if (cachedTickets) {
        console.log(
          `Returning ${cachedTickets.length} assigned tickets from cache`
        );
        return cachedTickets;
      }
    }

    // Try to fetch user ID if not available
    if (!this.currentUserId) {
      try {
        await this.fetchCurrentUser();
      } catch (error) {
        console.warn('Could not fetch current user profile:', error.message);
      }
    }

    // Check for timestamp filtering
    const lastFetchTimestamp = await storage.load('lastTicketFetchTimestamp');
    let shouldUseTimestampFilter = lastFetchTimestamp && !forceRefresh;

    // Define endpoints to try
    let endpoints = [];

    // Prioritize endpoints based on detected API features
    if (this.apiFeatures && this.apiFeatures.supportsTicketSearch === false) {
      console.log(
        'API is known to NOT support ticket search, using only filter endpoints'
      );
      shouldUseTimestampFilter = false; // Filter endpoints don't support timestamp filtering
      // If search is not supported, only use filter endpoints
      if (this.currentUserId) {
        endpoints = [
          `/api/v1/tickets?filter[owner_id]=${this.currentUserId}`,
          `/api/v1/tickets?owner_id=${this.currentUserId}`,
          '/api/v1/tickets?filter[owner_id]=me',
          '/api/v1/tickets?owner_id=me',
        ];
      } else {
        endpoints = [
          '/api/v1/tickets?filter[owner_id]=me',
          '/api/v1/tickets?owner_id=me',
        ];
      }
    } else {
      // Use search endpoints with timestamp filtering when possible
      if (shouldUseTimestampFilter) {
        console.log(`Performing incremental fetch for assigned tickets created or updated since ${lastFetchTimestamp}`);
        const query = this.currentUserId
          ? `owner.id:${this.currentUserId} AND (created_at:>'${lastFetchTimestamp}' OR updated_at:>'${lastFetchTimestamp}')`
          : `owner.id:me AND (created_at:>'${lastFetchTimestamp}' OR updated_at:>'${lastFetchTimestamp}')`;
        endpoints = [
          `/api/v1/tickets/search?query=${encodeURIComponent(query)}&expand=true&assets=true`,
        ];
      } else {
        // Use all endpoints, with search endpoints first if search is known to be supported
        if (this.apiFeatures && this.apiFeatures.supportsTicketSearch === true) {
          console.log(
            'API is known to support ticket search, prioritizing search endpoints'
          );
          if (this.currentUserId) {
            endpoints = [
              `/api/v1/tickets/search?query=owner.id:${this.currentUserId}`,
              `/api/v1/tickets?filter[owner_id]=${this.currentUserId}`,
              `/api/v1/tickets?owner_id=${this.currentUserId}`,
              '/api/v1/tickets/search?query=owner.id:me',
              '/api/v1/tickets?filter[owner_id]=me',
              '/api/v1/tickets?owner_id=me',
            ];
          } else {
            endpoints = [
              '/api/v1/tickets/search?query=owner.id:me',
              '/api/v1/tickets?filter[owner_id]=me',
              '/api/v1/tickets?owner_id=me',
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
              '/api/v1/tickets?owner_id=me',
            ];
          } else {
            endpoints = [
              '/api/v1/tickets/search?query=owner.id:me',
              '/api/v1/tickets?filter[owner_id]=me',
              '/api/v1/tickets?owner_id=me',
            ];
          }
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

        // Enhance tickets with customer data
        const enhancedTickets =
          await this.enhanceTicketsWithCustomerData(result);

        // Cache the results
        await this.cacheTickets(cacheKey, enhancedTickets);

        return enhancedTickets;
      } catch (error) {
        console.error(
          `Error with assigned tickets endpoint ${endpoint}:`,
          error
        );

        // Update API features based on error
        if (
          endpoint.includes('/search') &&
          error.message.includes('404') &&
          this.apiFeatures
        ) {
          this.apiFeatures.supportsTicketSearch = false;
          this.saveCachedApiFeatures();
          console.log(
            'API does not support ticket search endpoint (404 error)'
          );
        }
      }
    }

    throw new Error('Failed to get assigned tickets');
  }

  /**
   * Get all tickets, optionally filtered by user ID with cache-first loading
   * @param {string|number} userId - Optional user ID to filter by
   * @param {boolean} forceRefresh - If true, skip cache and fetch from API
   * @returns {Array} Array of tickets
   */
  async getAllTickets(userId = null, forceRefresh = false) {
    console.log(
      `Getting all tickets${userId ? ' for user ID: ' + userId : ''}`
    );

    const cacheKey = userId ? `user_tickets_${userId}` : 'all_tickets';

    // Try cache first unless force refresh is requested
    if (!forceRefresh) {
      const cachedTickets = this.getCachedTickets(cacheKey);
      if (cachedTickets) {
        console.log(
          `Returning ${cachedTickets.length} tickets from cache for key: ${cacheKey}`
        );
        return cachedTickets;
      }
    }

    // Try cache first unless force refresh is requested
    if (!forceRefresh) {
      const cachedTickets = this.getCachedTickets(cacheKey);
      if (cachedTickets) {
        console.log(
          `Returning ${cachedTickets.length} tickets from cache for key: ${cacheKey}`
        );
        return cachedTickets;
      }
    }

    // If a specific user ID is provided, get tickets for that user
    if (userId) {
      const tickets = await this.getTicketsForUser(userId, forceRefresh);
      const enhancedTickets =
        await this.enhanceTicketsWithCustomerData(tickets);
      await this.cacheTickets(cacheKey, enhancedTickets);
      return enhancedTickets;
    }

    // If no specific user ID is provided, check for configured user IDs in settings
    try {
      const settings = await this.getSettings();
      if (settings.userIds && settings.userIds.length > 0) {
        const userIdList = settings.userIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id);
        userIdList.push('1'); // Always include user ID 1 (unassigned) for compatibility

        console.log(
          `Using configured user IDs from settings: ${userIdList.join(', ')}`
        );

        const allTickets = [];
        for (const id of userIdList) {
          try {
            const userTickets = await this.getTicketsForUser(id, forceRefresh);
            if (Array.isArray(userTickets)) {
              allTickets.push(...userTickets);
            }
          } catch (error) {
            console.error(`Error getting tickets for user ID ${id}:`, error);
          }
        }

        const enhancedTickets =
          await this.enhanceTicketsWithCustomerData(allTickets);
        await this.cacheTickets(cacheKey, enhancedTickets);
        return enhancedTickets;
      }
    } catch (error) {
      console.error('Error checking for configured user IDs:', error);
    }

    // Fallback: If no specific user and no configured users, get all tickets unfiltered
    console.log('Using fallback: getting all tickets unfiltered');
    const tickets = await this.getAllTicketsUnfiltered(forceRefresh);
    console.log(`getAllTicketsUnfiltered returned: ${tickets ? tickets.length : 'null/undefined'} tickets`);
    const enhancedTickets = await this.enhanceTicketsWithCustomerData(tickets);
    console.log(`After enhancement: ${enhancedTickets ? enhancedTickets.length : 'null/undefined'} tickets`);
    await this.cacheTickets(cacheKey, enhancedTickets);
    return enhancedTickets;
  }

  /**
   * Get tickets for a specific user
   * @param {string|number} userId - User ID to get tickets for
   * @returns {Array} Array of tickets
   */
  async getTicketsForUser(userId, forceRefresh = false) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Getting tickets for user ID: ${userId}`);

    const lastFetchTimestamp = await storage.load('lastTicketFetchTimestamp');
    let query;

    if (lastFetchTimestamp && !forceRefresh) {
      console.log(`Performing incremental fetch for tickets updated since ${lastFetchTimestamp}`);
      query = `owner.id:${userId} AND updated_at:>'${lastFetchTimestamp}'`;
    } else {
      console.log('Performing a full ticket fetch.');
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      const formattedDate = threeYearsAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      query = `owner.id:${userId} AND created_at:>${formattedDate} AND !state.id:2 AND !state.id 3`;
    }
    const perPage = 1000;
    const totalPages = 2;
    const allTickets = [];

    for (let page = 1; page <= totalPages; page++) {
      const endpoint = `/api/v1/tickets/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&expand=true&assets=true`;
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
  }

  /**
   * Get articles for a specific ticket
   * @param {string|number} ticketId - Ticket ID to get articles for
   * @returns {Array} Array of ticket articles
   */
  async getTicketArticles(ticketId) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    console.log(`Getting articles for ticket ID: ${ticketId}`);

    const endpoint = `/api/v1/ticket_articles/by_ticket/${ticketId}`;

    try {
      const result = await this.request(endpoint);
      console.log(
        `Successfully got ${result ? result.length : 0} articles for ticket ${ticketId}`
      );
      return result || [];
    } catch (error) {
      console.error(`Error getting articles for ticket ${ticketId}:`, error);
      return [];
    }
  }

  /**
   * Get all tickets without filtering
   * @returns {Array} Array of tickets
   */
  async getAllTicketsUnfiltered(forceRefresh = false) {
    console.log('Getting all tickets (unfiltered)');

    // Check for timestamp filtering
    const lastFetchTimestamp = await storage.load('lastTicketFetchTimestamp');
    let shouldUseTimestampFilter = lastFetchTimestamp && !forceRefresh;

    let endpoints;
    if (shouldUseTimestampFilter && (!this.apiFeatures || this.apiFeatures.supportsTicketSearch !== false)) {
      console.log(`Performing incremental fetch for all tickets created or updated since ${lastFetchTimestamp}`);
      const query = `created_at:>'${lastFetchTimestamp}' OR updated_at:>'${lastFetchTimestamp}'`;
      endpoints = [
        `/api/v1/tickets/search?query=${encodeURIComponent(query)}&expand=true&assets=true`,
      ];
    } else {
      endpoints = [
        '/api/v1/tickets?expand=true&assets=true',
        '/api/v1/tickets/search?query=*&expand=true&assets=true',
        '/api/v1/tickets/search?expand=true&assets=true',
        '/api/v1/tickets',
        '/api/v1/tickets/search?query=*',
        '/api/v1/tickets/search',
      ];
    }

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint for all tickets: ${endpoint}`);
        const result = await this.request(endpoint);
        console.log(`Successfully got ${result ? result.length : 0} tickets from ${endpoint}`);
        console.log(`Result type: ${typeof result}, isArray: ${Array.isArray(result)}`);
        if (Array.isArray(result) && result.length > 0) {
          console.log(`Sample ticket:`, result[0]);
        }
        // Note: Enhancement is handled by the calling getAllTickets() method
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
    console.log('Getting all users from API with pagination');

    const endpoint = '/api/v1/users';
    const perPage = 100; // Fetch 100 users per page
    let currentPage = 1;
    let allUsers = [];
    let keepFetching = true;

    while (keepFetching) {
      try {
        const url = `${endpoint}?per_page=${perPage}&page=${currentPage}`;
        console.log(`Fetching users from: ${url}`);
        const usersOnPage = await this.request(url);

        if (Array.isArray(usersOnPage) && usersOnPage.length > 0) {
          allUsers = allUsers.concat(usersOnPage);
          // If we received fewer users than we asked for, it's the last page
          if (usersOnPage.length < perPage) {
            keepFetching = false;
          } else {
            currentPage++;
          }
        } else {
          // No more users found
          keepFetching = false;
        }
      } catch (error) {
        console.error(`Error fetching page ${currentPage} of users:`, error);
        keepFetching = false; // Stop fetching on error
        // If we already have some users, we can return them, otherwise throw
        if (allUsers.length === 0) {
          throw error;
        }
      }
    }

    console.log(`Successfully fetched a total of ${allUsers.length} users.`);
    return allUsers;
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

    console.log(
      `Attempting to delete time entry ${entryId} (token-only authentication)`
    );

    // Array of endpoints to try for deletion
    const deleteEndpoints = [];

    // If ticket ID is provided, try the ticket-specific endpoint first (official API)
    if (ticketId) {
      deleteEndpoints.push(
        `/api/v1/tickets/${ticketId}/time_accountings/${entryId}`
      );
    } else {
      // If no ticket ID provided, try to get the time entry details to determine the ticket ID
      try {
        const timeEntryDetails = await this.getTimeEntryDetails(entryId);
        console.log('Time entry details:', timeEntryDetails);

        if (timeEntryDetails && timeEntryDetails.ticket_id) {
          deleteEndpoints.push(
            `/api/v1/tickets/${timeEntryDetails.ticket_id}/time_accountings/${entryId}`
          );
        }
      } catch (detailsError) {
        console.warn(
          'Could not get time entry details, proceeding with direct deletion:',
          detailsError.message
        );
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
        console.log(
          `Successfully deleted time entry ${entryId} using endpoint: ${endpoint}`
        );

        // Clear time history cache after successful deletion
        this.clearTimeHistoryCache();

        return result;
      } catch (deleteError) {
        console.error(
          `Delete failed for endpoint ${endpoint}:`,
          deleteError.message
        );
        lastError = deleteError;

        // If it's a 404, the entry might already be deleted
        if (deleteError.message.includes('404')) {
          console.log('Entry might already be deleted (404 error)');
          this.clearTimeHistoryCache();
          return {
            success: true,
            message: 'Entry already deleted or not found',
          };
        }

        // Continue to next endpoint
        continue;
      }
    }

    // If all endpoints failed, provide detailed error information
    if (lastError) {
      if (
        lastError.message.includes('403') ||
        lastError.message.includes('401')
      ) {
        throw new Error(
          'Permission denied: You need admin.time_accounting permission to delete time entries. Please check your API token permissions or contact your Zammad administrator.'
        );
      }

      if (lastError.message.includes('404')) {
        throw new Error(
          `Time entry ${entryId} not found. It may have already been deleted.`
        );
      }

      throw new Error(
        `Failed to delete time entry ${entryId}. Last error: ${lastError.message}`
      );
    }

    throw new Error(
      `Failed to delete time entry ${entryId}. No valid endpoint found.`
    );
  }
  /**
   * Clear time history cache to force fresh data retrieval
   */
  clearTimeHistoryCache() {
    console.log('Clearing time history cache');
    this.successfulEndpoints.timeHistory = null;

    // Clear only time history related cache entries, not individual ticket time entries
    const keysToDelete = [];
    for (const [key] of this.timeEntryCache) {
      if (key.startsWith('timeHistory_')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.timeEntryCache.delete(key));

    this.saveCachedEndpoints();
  }

  /**
   * Get time tracking history for the current user
   * Uses detected API features to optimize the approach
   */
  async getTimeHistory() {
    console.log('Getting time tracking history for current user');

    // Check cache first
    const cacheKey = `timeHistory_${this.currentUserId}`;
    const now = Date.now();

    if (this.timeEntryCache.has(cacheKey)) {
      const cachedEntry = this.timeEntryCache.get(cacheKey);
      if (cachedEntry && (now - cachedEntry.timestamp) < this.timeEntryCacheExpiryMs) {
        console.log('Using cached time history');
        return cachedEntry.data;
      }
    }

    // Request deduplication - check if request is already in progress
    const requestKey = `getTimeHistory_${this.currentUserId}`;
    if (this.ongoingRequests.has(requestKey)) {
      console.log('Returning existing promise for time history request');
      return this.ongoingRequests.get(requestKey);
    }

    // Create and store the promise for this request
    const requestPromise = (async () => {
      try {
        // Try cached endpoint first, but be careful with admin endpoints
    if (
      this.successfulEndpoints.timeHistory &&
      this.successfulEndpoints.timeHistory !== 'fallback_via_tickets'
    ) {
      try {
        console.log(
          'Trying cached time history endpoint:',
          this.successfulEndpoints.timeHistory
        );
        const result = await this.request(this.successfulEndpoints.timeHistory);

        // IMPORTANT: Always filter admin endpoint results by current user
        if (Array.isArray(result) && this.currentUserId) {
          const filteredResult = result.filter(
            (entry) =>
              entry.created_by_id === this.currentUserId ||
              entry.user_id === this.currentUserId
          );
          console.log(
            `Filtered ${result.length} entries to ${filteredResult.length} for current user`
          );

          // Cache the filtered result
          this.timeEntryCache.set(cacheKey, { data: filteredResult, timestamp: now });

          return filteredResult;
        }

        // Cache the unfiltered result
        this.timeEntryCache.set(cacheKey, { data: result, timestamp: now });

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
      console.log(
        'API is known to NOT support direct time_accountings, skipping to fallback method'
      );
      tryDirectEndpointsFirst = false;
    }

    // Method 1: Try direct time_accountings endpoints (requires admin permissions)
    // Only try these if we have a user ID and either we don't know if the API supports it
    // or we know it does support it
    if (tryDirectEndpointsFirst && this.currentUserId) {
      const adminEndpoints = [
        `/api/v1/time_accountings?created_by_id=${this.currentUserId}`,
        '/api/v1/time_accountings',
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
            ? result.filter(
                (entry) =>
                  entry.created_by_id == this.currentUserId ||
                  entry.user_id == this.currentUserId
              )
            : result;

          console.log(
            `Got ${Array.isArray(result) ? result.length : 0} total entries, filtered to ${Array.isArray(filteredResult) ? filteredResult.length : 0} for current user`
          );

          // Only cache endpoints that properly filter by user
          if (endpoint.includes('created_by_id')) {
            this.successfulEndpoints.timeHistory = endpoint;
            this.saveCachedEndpoints();
          }

          // Cache the filtered result
          this.timeEntryCache.set(cacheKey, { data: filteredResult, timestamp: now });

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
            console.log(
              'API does not support direct time_accountings endpoint (404 error)'
            );
            break; // No need to try other admin endpoints
          } else if (error.message.includes('403')) {
            // If it's a 403, the endpoint exists but we don't have permission
            if (this.apiFeatures) {
              this.apiFeatures.supportsTimeAccounting = true;
              this.saveCachedApiFeatures();
            }
            console.log(
              'API supports time_accountings endpoint but permission denied (403 error)'
            );
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
      console.log(
        `Found ${tickets ? tickets.length : 0} assigned tickets for time history collection`
      );

      if (!tickets || tickets.length === 0) {
        return [];
      }

      // Collect time entries from each ticket - OPTIMIZED with parallel requests
      const allTimeEntries = [];
      const maxTicketsToCheck = 50; // Increased limit for better coverage

      // Sort tickets by updated_at desc to prioritize recent activity
      const sortedTickets = Array.isArray(tickets)
        ? tickets.sort((a, b) => {
            const dateA = new Date(a.updated_at || 0);
            const dateB = new Date(b.updated_at || 0);
            return dateB - dateA;
          }).slice(0, maxTicketsToCheck)
        : [];

      console.log(`Fetching time entries from ${sortedTickets.length} tickets in parallel`);

      // Create parallel requests for all tickets
      const timeEntryPromises = sortedTickets.map(async (ticket) => {
        try {
          const ticketId = ticket.id || ticket.ticket_id;
          if (!ticketId) return [];

          const timeEntries = await this.getTimeEntries(ticketId);
          if (Array.isArray(timeEntries)) {
            // Filter entries by current user
            const userEntries = timeEntries.filter(
              (entry) =>
                !this.currentUserId ||
                entry.created_by_id == this.currentUserId ||
                entry.user_id == this.currentUserId
            );
            return userEntries;
          }
          return [];
        } catch (error) {
          console.warn(
            `Failed to get time entries for ticket ${ticket.id}:`,
            error.message
          );
          return [];
        }
      });

      // Execute all requests in parallel and flatten results
      const results = await Promise.all(timeEntryPromises);
      results.forEach(entries => allTimeEntries.push(...entries));

      // Sort by date (newest first)
      allTimeEntries.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA;
      });

      console.log(
        `Collected ${allTimeEntries.length} time entries from ${sortedTickets.length} tickets`
      );

      // Cache this method as successful
      this.successfulEndpoints.timeHistory = 'fallback_via_tickets';
      this.saveCachedEndpoints();

      // Cache the result
      this.timeEntryCache.set(cacheKey, { data: allTimeEntries, timestamp: now });

        return allTimeEntries;
      } catch (error) {
        console.error('Fallback method also failed:', error);
        throw new Error(
          'Failed to get time tracking history. This may be due to insufficient API permissions or no assigned tickets.'
        );
      }
    } catch (error) {
      console.error('Time history request failed:', error);
      throw error;
    } finally {
      // Clean up the ongoing request
      this.ongoingRequests.delete(requestKey);
    }
  })();

  // Store the promise and return it
  this.ongoingRequests.set(requestKey, requestPromise);
  return requestPromise;
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
        console.log(
          `Successfully got time entry details from: ${endpoint}`,
          result
        );
        return result;
      } catch (error) {
        console.error(
          `Failed to get time entry details from ${endpoint}:`,
          error.message
        );
        lastError = error;
      }
    }

    throw new Error(
      `Could not retrieve time entry details. Last error: ${lastError?.message || 'Unknown error'}`
    );
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
      id: entryId,
    };

    console.log(
      `Updating time entry ${entryId} for ticket ${ticketId}`,
      updateData
    );

    try {
      // Use the official API endpoint
      const endpoint = `/api/v1/tickets/${ticketId}/time_accountings/${entryId}`;
      const result = await this.request(endpoint, 'PUT', updateData);
      console.log(`Successfully updated time entry ${entryId}`, result);

      // Clear cached time entries for this specific ticket
      const cacheKey = `timeEntries_${ticketId}`;
      this.timeEntryCache.delete(cacheKey);

      // Clear time history cache after successful update
      this.clearTimeHistoryCache();

      return result;
    } catch (error) {
      console.error(`Failed to update time entry ${entryId}:`, error);

      // Provide more specific error messages
      if (error.message.includes('403')) {
        throw new Error(
          'Permission denied: You need admin.time_accounting permission to update time entries. Please check your API token permissions or contact your Zammad administrator.'
        );
      }

      throw new Error(`Failed to update time entry: ${error.message}`);
    }
  }

  /**
   * Get all groups from Zammad
   *
   * Uses the official Zammad API endpoint:
   * GET /api/v1/groups
   *
   * Documentation: docs/zammad/docs.zammad.org/en/latest/api/group.html#list
   * Required permission: ticket.agent or admin.group
   *
   * @returns {Promise<Array>} Array of groups
   */
  async getAllGroups() {
    console.log('Getting all groups from Zammad API');

    try {
      const endpoint = '/api/v1/groups';
      console.log(`Fetching groups from endpoint: ${endpoint}`);
      const result = await this.request(endpoint);

      if (Array.isArray(result)) {
        console.log(`Successfully fetched ${result.length} groups`);
        return result;
      } else {
        console.warn('Groups API returned unexpected format:', result);
        return [];
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      throw new Error(`Failed to get groups: ${error.message}`);
    }
  }

  /**
   * Get all organizations from Zammad
   *
   * Uses the official Zammad API endpoint:
   * GET /api/v1/organizations
   *
   * Documentation: docs.zammad.org/en/latest/api/organization.html#list
   * Required permission: ticket.agent or admin.organization
   *
   * @returns {Promise<Array>} Array of organizations
   */
  async getAllOrganizations() {
    console.log('Getting all organizations from Zammad API');
    try {
      const endpoint = '/api/v1/organizations';
      console.log(`Fetching organizations from endpoint: ${endpoint}`);
      const result = await this.request(endpoint);
      if (Array.isArray(result)) {
        console.log(`Successfully fetched ${result.length} organizations`);
        return result;
      } else {
        console.warn('Organizations API returned unexpected format:', result);
        return [];
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      throw new Error(`Failed to get organizations: ${error.message}`);
    }
  }

  /**
   * Get customer/user information by ID
   *
   * Uses the official Zammad API endpoint:
   * GET /api/v1/users/{user_id}
   *
   * Documentation: docs.zammad.org/en/latest/api/user.html#show
   * Required permission: ticket.agent or admin.user
   *
   * @param {number|string} userId - The ID of the user to fetch
   * @returns {Promise<object>} User/customer information
   */
  async getUser(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Getting user information for ID: ${userId}`);

    try {
      const endpoint = `/api/v1/users/${userId}`;
      console.log(`Fetching user from endpoint: ${endpoint}`);
      const result = await this.request(endpoint);

      if (result && (result.id || result.login)) {
        console.log(
          `Successfully fetched user: ${result.login || result.email || result.id}`
        );
        return result;
      } else {
        console.warn('User API returned unexpected format:', result);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);

      // Don't throw on 404 - user might not exist or no permission
      if (error.message.includes('404')) {
        console.warn(`User ${userId} not found or no access`);
        return null;
      }

      throw new Error(`Failed to get user ${userId}: ${error.message}`);
    }
  }

  /**
   * Get all roles from Zammad
   * @returns {Promise<Array>} Array of role objects
   */
  async getRoles() {
    console.log('Getting all roles from Zammad API');
    try {
      const endpoint = '/api/v1/roles';
      const result = await this.request(endpoint);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw new Error(`Failed to get roles: ${error.message}`);
    }
  }

  /**
   * Get all admin and agent users
   * @returns {Promise<Array>} Array of user objects
   */
  async getAdminAndAgentUsers() {
    console.log('Getting all admin and agent users');
    try {
      const [roles, users] = await Promise.all([
        this.getRoles(),
        this.getAllUsers(),
      ]);

      const adminOrAgentRoleIds = roles
        .filter((role) => role.name === 'Admin' || role.name === 'Agent')
        .map((role) => role.id);

      if (adminOrAgentRoleIds.length === 0) {
        console.warn('Could not find Admin or Agent roles.');
        return users; // Fallback to all users
      }

      const filteredUsers = users.filter((user) =>
        user.role_ids.some((roleId) => adminOrAgentRoleIds.includes(roleId))
      );

      console.log(`Filtered ${users.length} users down to ${filteredUsers.length} admins/agents`);
      return filteredUsers;
    } catch (error) {
      console.error('Error getting admin and agent users:', error);
      throw error;
    }
  }

  /**
   * Enhance tickets with customer data using efficient batch fetching and caching
   * @param {Array} tickets - Array of tickets to enhance
   * @returns {Array} Enhanced tickets with customer data
   */
  async enhanceTicketsWithCustomerData(tickets) {
    if (!Array.isArray(tickets) || tickets.length === 0) {
      return tickets;
    }

    const startTime = Date.now();
    console.log(
      `Enhancing ${tickets.length} tickets with customer data (optimized)`
    );

    // Step 1: Identify tickets that need customer data and collect unique customer IDs
    const ticketsNeedingCustomerData = [];
    const customerIdsToFetch = new Set();

    for (const ticket of tickets) {
      const hasCustomerData =
        ticket.customer_data &&
        (ticket.customer_data.firstname ||
          ticket.customer_data.lastname ||
          ticket.customer_data.email);

      console.log(
        `Ticket ${ticket.id}: customer_id=${ticket.customer_id}, hasCustomerData=${hasCustomerData}, customer_data=`,
        ticket.customer_data
      );

      if (!hasCustomerData && ticket.customer_id) {
        ticketsNeedingCustomerData.push(ticket);
        customerIdsToFetch.add(ticket.customer_id);
      }
    }

    if (customerIdsToFetch.size === 0) {
      console.log('No customer data enhancement needed');
      return tickets;
    }

    console.log(
      `Need to fetch ${customerIdsToFetch.size} unique customers for ${ticketsNeedingCustomerData.length} tickets`
    );

    // Step 2: Batch fetch all needed customer data
    const customerDataMap = await this.batchFetchCustomers(
      Array.from(customerIdsToFetch)
    );

    // Step 3: Apply customer data to tickets
    const enhancedTickets = tickets.map((ticket) => {
      if (ticket.customer_id && customerDataMap.has(ticket.customer_id)) {
        return {
          ...ticket,
          customer_data: customerDataMap.get(ticket.customer_id),
        };
      }
      return ticket;
    });

    const endTime = Date.now();
    console.log(
      `Enhanced ${enhancedTickets.length} tickets with customer data in ${endTime - startTime}ms`
    );
    return enhancedTickets;
  }

  /**
   * Batch fetch customers using the most efficient available method with caching
   * @param {Array} customerIds - Array of customer IDs to fetch
   * @returns {Map} Map of customer ID to customer data
   */
  async batchFetchCustomers(customerIds) {
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return new Map();
    }

    console.log(`Batch fetching ${customerIds.length} customers`);
    const customerMap = new Map();

    // Check if cache is still valid
    const now = Date.now();
    const cacheValid =
      this.cacheTimestamp && now - this.cacheTimestamp < this.cacheExpiryMs;

    if (cacheValid) {
      console.log('Using cached customer data');
      // Use cached data for known customers
      let cacheHits = 0;
      for (const customerId of customerIds) {
        if (this.customerCache.has(customerId)) {
          customerMap.set(customerId, this.customerCache.get(customerId));
          cacheHits++;
        }
      }
      console.log(`Cache hits: ${cacheHits}/${customerIds.length}`);

      // If we found all customers in cache, return immediately
      if (cacheHits === customerIds.length) {
        return customerMap;
      }
    } else {
      console.log('Customer cache expired, clearing...');
      this.customerCache.clear();
    }

    // Identify customers that need to be fetched
    const customerIdsToFetch = customerIds.filter((id) => !customerMap.has(id));

    if (customerIdsToFetch.length > 0) {
      console.log(
        `Need to fetch ${customerIdsToFetch.length} customers from API`
      );

      try {
        // Method 1: Try to fetch all users at once and filter for needed customers
        const allUsers = await this.getAllUsers();
        if (Array.isArray(allUsers) && allUsers.length > 0) {
          console.log(
            `Got ${allUsers.length} users from getAllUsers, filtering for needed customers`
          );

          for (const user of allUsers) {
            if (customerIdsToFetch.includes(user.id)) {
              customerMap.set(user.id, user);
              // Cache the fetched customer data
              this.customerCache.set(user.id, user);
            }
          }

          const foundCount =
            customerMap.size - (customerIds.length - customerIdsToFetch.length); // Subtract cached hits
          console.log(
            `Found ${foundCount}/${customerIdsToFetch.length} needed customers from getAllUsers`
          );

          // If we found most customers this way, update cache timestamp and return
          if (foundCount >= customerIdsToFetch.length * 0.8) {
            this.cacheTimestamp = now;
            console.log(
              `Batch fetch completed: ${customerMap.size}/${customerIds.length} customers found`
            );
            return customerMap;
          }
        }
      } catch (error) {
        console.warn(
          'getAllUsers failed, falling back to search method:',
          error.message
        );
      }

      // Method 2: Fallback - try user search if getAllUsers didn't work well
      try {
        const stillMissingIds = customerIdsToFetch.filter(
          (id) => !customerMap.has(id)
        );
        if (stillMissingIds.length > 0) {
          console.log(
            `Searching for ${stillMissingIds.length} missing customers`
          );

          // Try user search endpoint
          const searchResult = await this.request(
            '/api/v1/users/search?query=*&per_page=1000'
          );
          if (Array.isArray(searchResult)) {
            console.log(`User search returned ${searchResult.length} users`);

            for (const user of searchResult) {
              if (stillMissingIds.includes(user.id)) {
                customerMap.set(user.id, user);
                // Cache the fetched customer data
                this.customerCache.set(user.id, user);
              }
            }
          }
        }
      } catch (searchError) {
        console.warn('User search also failed:', searchError.message);
      }

      // Method 3: Last resort - individual fetches for remaining missing customers (limited)
      const finalMissingIds = customerIdsToFetch.filter(
        (id) => !customerMap.has(id)
      );
      if (finalMissingIds.length > 0 && finalMissingIds.length <= 5) {
        console.log(
          `Fetching ${finalMissingIds.length} customers individually as last resort`
        );

        const individualPromises = finalMissingIds.map(async (customerId) => {
          try {
            const customerData = await this.getUser(customerId);
            if (customerData) {
              customerMap.set(customerId, customerData);
              // Cache the fetched customer data
              this.customerCache.set(customerId, customerData);
            }
          } catch (error) {
            console.warn(
              `Failed to fetch customer ${customerId}:`,
              error.message
            );
          }
        });

        await Promise.all(individualPromises);
      } else if (finalMissingIds.length > 5) {
        console.warn(
          `Too many missing customers (${finalMissingIds.length}), skipping individual fetches to maintain performance`
        );
      }

      // Update cache timestamp and persist to storage after successful fetch
      this.cacheTimestamp = now;
      await this.saveCustomerCacheToStorage();
    }

    console.log(
      `Batch fetch completed: ${customerMap.size}/${customerIds.length} customers found`
    );
    return customerMap;
  }
}

// Create and export a singleton instance
const zammadApi = new ZammadAPI();

// Make it available globally
window.zammadApi = zammadApi;
console.log('Zammad API singleton instance created and available globally');
