// Content Script for Zammad Timetracking - Popup version only

// Only define the class if it hasn't been defined yet
if (typeof window.ZammadTimetracker === 'undefined') {
  window.ZammadTimetracker = class {
  constructor() {
    this.isTracking = false;
    this.startTime = null;
    this.ticketId = null;
    this.apiInitialized = false;

    this.init();
  }

  init() {
    // Wait until Zammad is loaded
    this.waitForZammad(() => {
      // Initialize API
      this.initializeApi().then(() => {
        // Load tracking state after API is initialized
        this.loadTrackingState();
      }).catch(error => {
        console.error('Error initializing API:', error);
        // Still load tracking state even if API initialization fails
        this.loadTrackingState();
      });

      // Message listener for popup communication
      this.setupMessageListener();
    });
  }

  async initializeApi() {
    try {
      // Check if API settings are available
      const result = await chrome.storage.local.get(['zammadApiSettings']);
      const apiSettings = result.zammadApiSettings || {};

      if (apiSettings.baseUrl && apiSettings.token) {
        console.log('Initializing Zammad API with saved settings');

        // Check if zammadApi is available globally
        if (window.zammadApi) {
          window.zammadApi.init(apiSettings.baseUrl, apiSettings.token);
          this.apiInitialized = true;
          console.log('Zammad API initialized successfully');
        } else {
          console.log('Global Zammad API not available, creating local instance');
          try {
            // Create and use a local instance
            window.zammadApi = new ZammadAPI();
            window.zammadApi.init(apiSettings.baseUrl, apiSettings.token);
            this.apiInitialized = true;
            console.log('Local Zammad API instance created and initialized');
          } catch (apiError) {
            console.error('Error creating local Zammad API instance:', apiError);
          }
        }
      } else {
        console.log('No API settings found, API not initialized');
      }
    } catch (error) {
      console.error('Error initializing API:', error);
    }
  }

  waitForZammad(callback) {
    const checkInterval = setInterval(() => {
      if (this.isZammadPage()) {
        clearInterval(checkInterval);
        callback();
      }
    }, 1000);
  }

  isZammadPage() {
    // Erweiterte Zammad-Erkennung
    const indicators = [
      // DOM-Elemente
      () => document.querySelector('.main'),
      () => document.querySelector('#app'),
      () => document.querySelector('.ticketZoom'),
      () => document.querySelector('[data-tab="ticket"]'),
      () => document.querySelector('.ticket'),
      () => document.querySelector('[class*="zammad"]'),
      () => document.querySelector('[id*="zammad"]'),

      // URL-Patterns
      () => /zammad/i.test(window.location.href),
      () => /ticket/i.test(window.location.href),
      () => /agent/i.test(window.location.href),

      // Title oder Meta
      () => /zammad/i.test(document.title),
      () => document.querySelector('meta[name*="zammad"]'),

      // Scripts oder Stylesheets
      () => document.querySelector('script[src*="zammad"]'),
      () => document.querySelector('link[href*="zammad"]')
    ];

    const isZammad = indicators.some(check => {
      try {
        return check();
      } catch (e) {
        return false;
      }
    });

    console.log('Zammad page detected:', isZammad, 'URL:', window.location.href);
    return isZammad;
  }

  async getCurrentTicketId() {
    // First try to extract from URL for immediate response
    // This is kept for backward compatibility and quick response
    const urlTicketId = this.extractTicketIdFromUrl();

    // If API is initialized, try to get the current ticket ID from the API
    if (this.apiInitialized && window.zammadApi && window.zammadApi.isInitialized()) {
      try {
        console.log('Trying to get ticket ID from API using URL-extracted ID as reference:', urlTicketId);

        // If we have a URL ticket ID, we can use it to get the full ticket data
        if (urlTicketId) {
          const ticketData = await window.zammadApi.getTicket(urlTicketId);
          if (ticketData && ticketData.id) {
            console.log(`Ticket ID confirmed via API: ${ticketData.id}`);
            return ticketData.id.toString();
          }
        }

        // If we couldn't get the ticket ID from the API using the URL ID,
        // we'll fall back to DOM extraction
        console.log('Could not get ticket ID from API, falling back to DOM extraction');
      } catch (error) {
        console.error('Error getting ticket ID from API:', error);
      }
    } else {
      console.log('API not initialized, using DOM extraction for ticket ID');
    }

    // If we already have a URL ticket ID, return it
    if (urlTicketId) {
      return urlTicketId;
    }

    // Fallback to DOM extraction
    return this.extractTicketIdFromDom();
  }

  extractTicketIdFromUrl() {
    // Extract ticket ID from URL
    const urlPatterns = [
      /\/#ticket\/zoom\/(\d+)/,
      /\/tickets\/(\d+)/,
      /\/helpdesk\/ticket\/(\d+)/,
      /\/ticket\/(\d+)/,
      /ticket[_-]?id[=:](\d+)/i,
      /id[=:](\d+)/
    ];

    for (const pattern of urlPatterns) {
      const urlMatch = window.location.href.match(pattern);
      if (urlMatch && urlMatch[1]) {
        console.log(`Ticket ID found in URL: ${urlMatch[1]}`);
        return urlMatch[1];
      }
    }

    return null;
  }

  extractTicketIdFromDom() {
    // Extract ticket ID from DOM elements
    const selectors = [
      '[data-ticket-id]',
      '.ticket-number',
      '.ticketZoom',
      '[id*="ticket"]',
      '[class*="ticket"]',
      '.ticket-title',
      '.ticket-info',
      'h1', 'h2', 'h3'  // Headers that often contain ticket info
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check data-ticket-id attribute
        const dataId = element.getAttribute('data-ticket-id');
        if (dataId && /^\d+$/.test(dataId)) {
          console.log(`Ticket ID found in data attribute: ${dataId}`);
          return dataId;
        }

        // Search text content for numbers
        const text = element.textContent || element.innerText || '';
        const textMatch = text.match(/(?:ticket|#)\s*(\d+)/i);
        if (textMatch && textMatch[1]) {
          console.log(`Ticket ID found in text: ${textMatch[1]}`);
          return textMatch[1];
        }

        // Only numbers in text
        const numberMatch = text.match(/^\s*(\d{3,})\s*$/);
        if (numberMatch && numberMatch[1]) {
          console.log(`Ticket ID found as number: ${numberMatch[1]}`);
          return numberMatch[1];
        }
      }
    }

    // Fallback: From title or meta tags
    const title = document.title;
    const titleMatch = title.match(/(?:ticket|#)\s*(\d+)/i);
    if (titleMatch && titleMatch[1]) {
      console.log(`Ticket ID found in title: ${titleMatch[1]}`);
      return titleMatch[1];
    }

    // For debug: Log current URL
    console.log('No ticket ID found. Current URL:', window.location.href);
    console.log('Document title:', document.title);

    return null;
  }

  createTrackingUI() {
    // Don't create UI on the page - use popup only
    console.log('Zammad Timetracker initialized - using popup only');
  }

  setupMessageListener() {
    // Ensure only one listener is active
    if (window.zammadListenerActive) {
      return;
    }
    window.zammadListenerActive = true;

    // Receive messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content script receiving message:', request.action);

      switch (request.action) {
        case 'startTracking':
          const startResult = this.startTracking();
          sendResponse({ success: startResult });
          break;
        case 'stopTracking':
          // Handle async stopTracking
          this.stopTracking().then(stopResult => {
            console.log('Stop tracking result:', stopResult);
            sendResponse({ success: stopResult });
          }).catch(error => {
            console.error('Error stopping tracking:', error);
            sendResponse({ success: false, error: error.message });
          });
          return true; // Indicate we'll send response asynchronously
        case 'getStatus':
          sendResponse({
            isTracking: this.isTracking,
            ticketId: this.getCurrentTicketId(),
            startTime: this.startTime ? this.startTime.toISOString() : null,
            currentTime: this.isTracking ? this.formatDuration(Math.round((new Date() - this.startTime) / 1000)) : '00:00:00'
          });
          break;
        case 'getTicketId':
          const ticketId = this.getCurrentTicketId();
          console.log('Ticket ID requested:', ticketId);
          sendResponse({ ticketId: ticketId });
          break;
        case 'getTicketInfo':
          // Handle getTicketInfo action from popup
          // Use async/await pattern with Promise to ensure response is sent after API call
          (async () => {
            try {
              // Get current ticket ID
              const currentTicketId = await this.getCurrentTicketId();
              console.log('Ticket info requested:', currentTicketId);

              if (!currentTicketId) {
                console.log('No ticket ID found');
                sendResponse({ 
                  ticketId: null,
                  title: '',
                  timeSpent: 0
                });
                return;
              }

              // Try to get ticket info from API if initialized
              if (this.apiInitialized && window.zammadApi && window.zammadApi.isInitialized()) {
                try {
                  console.log('Getting ticket info from API');
                  const ticketData = await window.zammadApi.getTicket(currentTicketId);

                  if (ticketData) {
                    console.log('Ticket data received from API:', ticketData);

                    // Get time entries from API
                    let timeSpent = 0;
                    try {
                      const timeEntries = await window.zammadApi.getTimeEntries(currentTicketId);
                      console.log('Time entries received from API:', timeEntries);

                      if (timeEntries && Array.isArray(timeEntries)) {
                        // Calculate total time spent
                        timeSpent = timeEntries.reduce((total, entry) => {
                          return total + (parseFloat(entry.time_unit) || 0);
                        }, 0);
                        console.log('Total time from API:', timeSpent, 'min');
                      }
                    } catch (timeError) {
                      console.error('Error getting time entries from API:', timeError);
                      // Continue with ticket info even if time entries fail
                    }

                    sendResponse({ 
                      ticketId: currentTicketId,
                      title: ticketData.title || '',
                      timeSpent: timeSpent
                    });
                    return;
                  }
                } catch (apiError) {
                  console.error('Error getting ticket info from API:', apiError);
                  // Fall back to DOM extraction
                }
              }

              // Fallback: Get ticket title from page if possible
              console.log('Falling back to DOM extraction for ticket info');
              let title = '';
              try {
                const titleElement = document.querySelector('.ticket-title, .ticketZoom-header .ticket-number + div, h1, h2');
                if (titleElement) {
                  title = titleElement.textContent.trim();
                }
              } catch (e) {
                console.error('Error extracting title:', e);
              }

              // Get time spent if available
              let timeSpent = 0;
              try {
                const timeField = document.querySelector('input[name="time_unit"], input[id*="time"], .time-accounting input');
                if (timeField && timeField.value) {
                  timeSpent = parseFloat(timeField.value) || 0;
                }
              } catch (e) {
                console.error('Error extracting time:', e);
              }

              sendResponse({ 
                ticketId: currentTicketId,
                title: title,
                timeSpent: timeSpent
              });
            } catch (error) {
              console.error('Error in getTicketInfo:', error);
              sendResponse({ 
                ticketId: null,
                title: '',
                timeSpent: 0,
                error: error.message
              });
            }
          })();
          return true; // Indicate we'll send response asynchronously
          break;
        case 'submitTime':
          // Handle submitTime action from popup
          console.log('Recording time:', request.duration, 'minutes for ticket', request.ticketId);

          // Use async/await pattern with Promise to ensure response is sent after time entry is submitted
          if (request.duration > 0) {
            // If a specific ticket ID is provided, use it
            if (request.ticketId) {
              this.ticketId = request.ticketId;
            }

            // Convert minutes to seconds for submitTimeEntry
            // this.submitTimeEntry(request.duration * 60).then(success => {
            //   console.log('Time entry submission result:', success);
            //   sendResponse({ success: success });
            // }).catch(error => {
            //   console.error('Error submitting time entry:', error);
            //   sendResponse({ success: false, error: error.message });
            // });
          } else {
            console.log('Invalid duration, not submitting time entry');
            sendResponse({ success: false, error: 'Invalid duration' });
          }
          return true; // Indicate we'll send response asynchronously
      }
      return true; // Async response
    });

    console.log('Message listener set up for Zammad Timetracker');
  }

  async toggleTracking() {
    if (this.isTracking) {
      try {
        await this.stopTracking();
        console.log('Tracking stopped via toggle');
      } catch (error) {
        console.error('Error stopping tracking via toggle:', error);
      }
    } else {
      this.startTracking();
    }
  }

  async startTracking() {
    try {
      // Get ticket ID using the API if possible
      this.ticketId = await this.getCurrentTicketId();

      if (!this.ticketId) {
        // Message to background script for notification
        chrome.runtime.sendMessage({
          action: 'showNotification',
          title: 'Error',
          message: t('no_ticket_id')
        });
        return false;
      }

      this.isTracking = true;
      this.startTime = new Date();

      // If API is initialized, try to get additional ticket info
      let ticketTitle = '';
      if (this.apiInitialized && window.zammadApi && window.zammadApi.isInitialized()) {
        try {
          console.log('Getting ticket info from API for tracking start');
          const ticketData = await window.zammadApi.getTicket(this.ticketId);
          if (ticketData && ticketData.title) {
            ticketTitle = ticketData.title;
            console.log('Got ticket title from API:', ticketTitle);
          }
        } catch (error) {
          console.error('Error getting ticket info from API:', error);
          // Continue without ticket title
        }
      }

      // Save status with additional info if available
      this.saveTrackingState(ticketTitle);

      // Notify background script
      chrome.runtime.sendMessage({
        action: 'trackingStarted',
        data: { 
          ticketId: this.ticketId, 
          startTime: this.startTime.toISOString(),
          title: ticketTitle
        }
      });

      console.log(`Time tracking started for ticket #${this.ticketId}${ticketTitle ? ` (${ticketTitle})` : ''}`);
      return true;
    } catch (error) {
      console.error('Error starting tracking:', error);
      chrome.runtime.sendMessage({
        action: 'showNotification',
        title: 'Error',
        message: t('start_error') + ': ' + error.message
      });
      return false;
    }
  }

  async stopTracking() {
    if (!this.isTracking) return false;

    const endTime = new Date();
    const duration = Math.round((endTime - this.startTime) / 1000); // Seconds

    this.isTracking = false;

    try {
      // Enter time in Zammad
      const success = await this.submitTimeEntry(duration);

      // Delete status
      this.clearTrackingState();

      // Notify background script
      chrome.runtime.sendMessage({
        action: 'trackingStopped',
        data: { 
          ticketId: this.ticketId, 
          duration: this.formatDuration(duration),
          success: success
        }
      });

      console.log(`Time tracking ended for ticket #${this.ticketId}. Duration: ${this.formatDuration(duration)}`);
      return true;
    } catch (error) {
      console.error('Error submitting time entry:', error);

      // Still notify background script about the stop, but with success=false
      chrome.runtime.sendMessage({
        action: 'trackingStopped',
        data: { 
          ticketId: this.ticketId, 
          duration: this.formatDuration(duration),
          success: false,
          error: error.message
        }
      });

      return false;
    }
  }

  startTimer() {
    // Timer is only displayed in the popup - not needed here
  }

  stopTimer() {
    // Timer is only displayed in the popup - not needed here
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async submitTimeEntry(durationInSeconds) {
    return new Promise(async (resolve, reject) => {
      try {
        const durationInMinutes = Math.round(durationInSeconds / 60);
        console.log(`Submitting time entry: ${durationInMinutes} minutes for ticket #${this.ticketId}`);

        // First try to submit via API if initialized
        if (this.apiInitialized && window.zammadApi && window.zammadApi.isInitialized()) {
          try {
            console.log('Submitting time entry via API');
            const comment = 'Time tracked via Zammad Timetracking Extension';

            const response = await window.zammadApi.submitTimeEntry(this.ticketId, durationInMinutes, comment);

            if (response) {
              console.log('API time entry successful:', response);

              // Show success message
              const message = `${t('tracking_ended')}\n${t('ticket_id')}: #${this.ticketId}\n${t('duration')}: ${this.formatDuration(durationInSeconds)}\n${t('minutes_entered')}: ${durationInMinutes}`;
              this.showNotification(message);

              resolve(true); // Time successfully entered via API
              return;
            }
          } catch (apiError) {
            console.error('API time entry failed:', apiError);
            // Continue to fallback method
          }
        } else {
          console.log('API not initialized or not available');
        }


      } catch (error) {
        console.error('Critical error in submitTimeEntry:', error);
        reject(error);
      }
    });
  }

  showNotification(message) {
    // Try to show a notification or use alert
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(t('extension_title'), {
          body: message,
          icon: '/favicon.ico'
        });
      } else {
        alert(message);
      }
    } catch (notificationError) {
      console.error('Error showing notification:', notificationError);
      // Try alert as fallback
      try {
        alert(message);
      } catch (alertError) {
        console.error('Error showing alert:', alertError);
      }
    }
  }

  saveTrackingState(ticketTitle = '') {
    const state = {
      isTracking: this.isTracking,
      startTime: this.startTime ? this.startTime.toISOString() : null,
      ticketId: this.ticketId,
      title: ticketTitle || '',
      url: window.location.href
    };

    chrome.storage.local.set({ zammadTrackingState: state });
    console.log('Saved tracking state:', state);
  }

  async loadTrackingState() {
    try {
      const result = await chrome.storage.local.get(['zammadTrackingState']);
      const state = result.zammadTrackingState;

      console.log('Loading tracking state:', state);

      if (state && state.isTracking && state.startTime) {
        // Get current ticket ID but don't use it to determine if we should continue tracking
        const currentTicketId = await this.getCurrentTicketId();
        console.log('Current ticket ID:', currentTicketId, 'Saved ticket ID:', state.ticketId);

        // Always continue tracking regardless of the current ticket ID
        this.isTracking = true;
        this.startTime = new Date(state.startTime);
        this.ticketId = state.ticketId; // Keep the original ticket ID

        // If we have a title in the state, log it
        if (state.title) {
          console.log(`Time tracking continued for ticket #${this.ticketId} (${state.title})`);
        } else {
          console.log(`Time tracking continued for ticket #${this.ticketId}`);

          // If API is initialized but we don't have a title, try to get it
          if (this.apiInitialized && window.zammadApi && window.zammadApi.isInitialized()) {
            try {
              console.log('Getting ticket info from API for restored tracking');
              const ticketData = await window.zammadApi.getTicket(this.ticketId);
              if (ticketData && ticketData.title) {
                // Save the state again with the title
                this.saveTrackingState(ticketData.title);
                console.log('Updated tracking state with title from API:', ticketData.title);
              }
            } catch (error) {
              console.error('Error getting ticket info from API during state restore:', error);
              // Continue without ticket title
            }
          }
        }

        // If we're on a different ticket page, inform the user that tracking is continuing for the original ticket
        if (currentTicketId && currentTicketId !== state.ticketId) {
          console.log(`Note: You're viewing ticket #${currentTicketId} but tracking is active for ticket #${state.ticketId}`);
          // We could show a notification here if needed
        }
      } else {
        console.log('No active tracking state found');
      }
    } catch (error) {
      console.error('Error loading tracking state:', error);
    }
  }

  clearTrackingState() {
    chrome.storage.local.remove(['zammadTrackingState']);
    this.startTime = null;
    this.ticketId = null;
  }
  }
}

// Initialize extension when DOM is loaded
console.log('Zammad Timetracker Content Script is loading...');

// Avoid multiple instances
if (!window.zammadTrackerInstance) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOM loaded, initializing Zammad Timetracker');
      window.zammadTrackerInstance = new window.ZammadTimetracker();
    });
  } else {
    console.log('DOM already loaded, initializing Zammad Timetracker');
    window.zammadTrackerInstance = new window.ZammadTimetracker();
  }

  // Also reinitialize when navigating within Zammad
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('URL changed to:', url);
      setTimeout(() => {
        if (!window.zammadTrackerInstance || window.zammadTrackerInstance.needsReinit) {
          console.log('Reinitializing after URL change');
          window.zammadTrackerInstance = new window.ZammadTimetracker();
        }
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
} else {
  console.log('Zammad Timetracker already initialized');
}
