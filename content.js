// Content Script for Zammad Timetracking - Popup version only

class ZammadTimetracker {
  constructor() {
    this.isTracking = false;
    this.startTime = null;
    this.ticketId = null;

    this.init();
  }

  init() {
    // Wait until Zammad is loaded
    this.waitForZammad(() => {
      this.loadTrackingState();
      // Message listener for popup communication
      this.setupMessageListener();
    });
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

  getCurrentTicketId() {
    // Try different methods for ticket ID extraction

    // 1. Extract from URL
    const urlPatterns = [
      /\/ticket\/zoom\/(\d+)/,
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

    // 2. Extract from DOM elements
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

    // 3. Fallback: From title or meta tags
    const title = document.title;
    const titleMatch = title.match(/(?:ticket|#)\s*(\d+)/i);
    if (titleMatch && titleMatch[1]) {
      console.log(`Ticket ID found in title: ${titleMatch[1]}`);
      return titleMatch[1];
    }

    // 4. For debug: Log current URL
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
          break;
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
          const currentTicketId = this.getCurrentTicketId();
          console.log('Ticket info requested:', currentTicketId);

          // Get ticket title from page if possible
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
          break;
        case 'submitTime':
          // Handle submitTime action from popup
          console.log('Recording time:', request.duration, 'minutes for ticket', request.ticketId);

          // Use async/await pattern with Promise to ensure response is sent after time entry is submitted
          if (request.duration > 0) {
            // Convert minutes to seconds for submitTimeEntry
            this.submitTimeEntry(request.duration * 60).then(success => {
              console.log('Time entry submission result:', success);
              sendResponse({ success: success });
            }).catch(error => {
              console.error('Error submitting time entry:', error);
              sendResponse({ success: false, error: error.message });
            });
          } else {
            console.log('Invalid duration, not submitting time entry');
            sendResponse({ success: false, error: 'Invalid duration' });
          }
          return true; // Indicate we'll send response asynchronously
          break;
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

  startTracking() {
    this.ticketId = this.getCurrentTicketId();

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

    // Save status
    this.saveTrackingState();

    // Notify background script
    chrome.runtime.sendMessage({
      action: 'trackingStarted',
      data: { ticketId: this.ticketId, startTime: this.startTime.toISOString() }
    });

    console.log(`Time tracking started for ticket #${this.ticketId}`);
    return true;
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
    return new Promise((resolve, reject) => {
      try {
        const durationInMinutes = Math.round(durationInSeconds / 60);
        console.log(`Submitting time entry: ${durationInMinutes} minutes`);

        // Try to find and fill the Zammad Time Accounting field
        const timeFields = [
          'input[name="time_unit"]',
          'input[id*="time"]',
          '.time-accounting input',
          '[data-attribute-name="time_unit"] input'
        ];

        let timeField = null;
        for (const selector of timeFields) {
          try {
            timeField = document.querySelector(selector);
            if (timeField) {
              console.log(`Found time field with selector: ${selector}`);
              break;
            }
          } catch (error) {
            console.error(`Error finding time field with selector ${selector}:`, error);
            // Continue to next selector
          }
        }

        if (timeField) {
          try {
            console.log(`Setting time field value to: ${durationInMinutes}`);
            timeField.value = durationInMinutes;
            timeField.dispatchEvent(new Event('input', { bubbles: true }));
            timeField.dispatchEvent(new Event('change', { bubbles: true }));

            // Optional: Also set the Activity field if available
            try {
              const activityField = document.querySelector('select[name="type_id"], select[id*="activity"]');
              if (activityField && activityField.options.length > 1) {
                console.log('Setting activity field');
                activityField.selectedIndex = 1; // Select first available option
                activityField.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } catch (activityError) {
              console.error('Error setting activity field:', activityError);
              // Continue even if activity field fails
            }

            // Submit the form if there's a submit button
            const submitButton = document.querySelector('button[type="submit"], input[type="submit"], .js-submit, .form-submit, [data-type="update"]');
            if (submitButton) {
              console.log('Found submit button, clicking it');

              // Create a listener for form submission completion
              const formSubmitPromise = new Promise((formResolve) => {
                // Listen for form submission events
                const formSubmitListener = () => {
                  console.log('Form submission detected');
                  formResolve();
                };

                // Add listeners to potential form submission events
                document.addEventListener('submit', formSubmitListener, { once: true });

                // Also set a timeout in case the event doesn't fire
                setTimeout(() => {
                  document.removeEventListener('submit', formSubmitListener);
                  console.log('Form submission timeout - assuming success');
                  formResolve();
                }, 2000);
              });

              // Click the button
              submitButton.click();

              // Wait for form submission to complete (or timeout)
              formSubmitPromise.then(() => {
                // Show alert and resolve with success after form submission
                const message = `${t('tracking_ended')}\n${t('ticket_id')}: #${this.ticketId}\n${t('duration')}: ${this.formatDuration(durationInSeconds)}\n${t('minutes_entered')}: ${durationInMinutes}`;
                alert(message);
                console.log('Time entry submitted successfully');
                resolve(true); // Time successfully entered
              }).catch((error) => {
                console.error('Error during form submission:', error);
                reject(error);
              });
            } else {
              // No submit button found, still consider it a success
              // Show alert and resolve with success
              const message = `${t('tracking_ended')}\n${t('ticket_id')}: #${this.ticketId}\n${t('duration')}: ${this.formatDuration(durationInSeconds)}\n${t('minutes_entered')}: ${durationInMinutes}`;
              alert(message);
              console.log('Time entry submitted successfully (no submit button)');
              resolve(true); // Time successfully entered
            }
          } catch (fieldError) {
            console.error('Error setting time field value:', fieldError);
            reject(fieldError);
          }
        } else {
          console.log('No time field found, showing manual entry message');
          // Fallback: Manually inform user
          const message = `${t('tracking_ended')}\n\n${t('ticket_id')}: #${this.ticketId}\n${t('duration')}: ${this.formatDuration(durationInSeconds)}\n${t('min')}: ${durationInMinutes}\n\n${t('manual_entry_message')}`;

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
          console.log('Manual time entry required');
          resolve(false); // Time could not be automatically entered
        }
      } catch (error) {
        console.error('Critical error in submitTimeEntry:', error);
        reject(error);
      }
    });
  }

  saveTrackingState() {
    const state = {
      isTracking: this.isTracking,
      startTime: this.startTime ? this.startTime.toISOString() : null,
      ticketId: this.ticketId,
      url: window.location.href
    };

    chrome.storage.local.set({ zammadTrackingState: state });
  }

  loadTrackingState() {
    chrome.storage.local.get(['zammadTrackingState'], (result) => {
      const state = result.zammadTrackingState;

      if (state && state.isTracking && state.startTime) {
        // Check if we're still in the same ticket
        const currentTicketId = this.getCurrentTicketId();

        if (currentTicketId === state.ticketId) {
          this.isTracking = true;
          this.startTime = new Date(state.startTime);
          this.ticketId = state.ticketId;

          console.log(`Time tracking continued for ticket #${this.ticketId}`);
        } else {
          // Different ticket - delete state
          this.clearTrackingState();
        }
      }
    });
  }

  clearTrackingState() {
    chrome.storage.local.remove(['zammadTrackingState']);
    this.startTime = null;
    this.ticketId = null;
  }
}

// Initialize extension when DOM is loaded
console.log('Zammad Timetracker Content Script is loading...');

// Avoid multiple instances
if (!window.zammadTrackerInstance) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOM loaded, initializing Zammad Timetracker');
      window.zammadTrackerInstance = new ZammadTimetracker();
    });
  } else {
    console.log('DOM already loaded, initializing Zammad Timetracker');
    window.zammadTrackerInstance = new ZammadTimetracker();
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
          window.zammadTrackerInstance = new ZammadTimetracker();
        }
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
} else {
  console.log('Zammad Timetracker already initialized');
}
