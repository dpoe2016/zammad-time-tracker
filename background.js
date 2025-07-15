// Minimal Background Script for Zammad Timetracking Extension

// Import translations and utilities
importScripts('translations.js');
importScripts('logger.js');
importScripts('storage.js');

// Log startup
logger.info('Background Script loaded');

// Global tracking state
let trackingState = {
  isTracking: false,
  ticketId: null,
  startTime: null
};

// Helper function to manage badge state
function updateBadge(isActive) {
  if (!chrome.action || !chrome.action.setBadgeText) {
    logger.warn('Badge API not available');
    return;
  }

  if (isActive) {
    chrome.action.setBadgeText({ text: '⏱' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc3545' });
    logger.debug('Badge set to active state');
  } else {
    chrome.action.setBadgeText({ text: '' });
    logger.debug('Badge cleared');
  }
}

// Load tracking state from storage
async function loadTrackingState() {
  try {
    const result = await storage.load('zammadTrackingState');
    if (result) {
      logger.info('Loaded tracking state from storage');
      logger.debug('Tracking state details', result);
      trackingState = result;

      // Restore badge if tracking is active
      if (trackingState.isTracking) {
        logger.info('Restoring badge for active tracking');
        updateBadge(true);
      }
    } else {
      logger.info('No tracking state found in storage');
    }
  } catch (error) {
    logger.error('Error loading tracking state', error);
  }
}

// Save tracking state to storage
async function saveTrackingState() {
  try {
    await storage.save('zammadTrackingState', trackingState);
    logger.info('Tracking state saved to storage');
    logger.debug('Tracking state details', trackingState);
  } catch (error) {
    logger.error('Error saving tracking state', error);
  }
}

// Load tracking state when background script starts
loadTrackingState();

// Helper function for showing notifications
function showNotification(title, message) {
  if (!chrome.notifications || !chrome.notifications.create) {
    logger.warn('Notifications API not available');
    return;
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: title,
    message: message,
    requireInteraction: false
  }, function(notificationId) {
    if (chrome.runtime.lastError) {
      logger.error('Notification error', chrome.runtime.lastError.message);
    } else {
      logger.debug('Notification created', notificationId);
    }
  });
}

// Installation Event
chrome.runtime.onInstalled.addListener(function(details) {
  logger.info('Extension installed/updated', details.reason);

  if (details.reason === 'install') {
    logger.info('First installation - showing welcome message');
    showNotification(t('extension_title'), t('extension_installed'));
  }
});

// Message Handler - Main communication
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  logger.info('Message received', request.action);

  try {
    switch (request.action) {
      case 'ping':
        // Health Check
        sendResponse({ 
          status: 'alive', 
          timestamp: Date.now(),
          version: chrome.runtime.getManifest().version
        });
        break;

      case 'trackingStarted':
        handleTrackingStarted(request.data);
        sendResponse({ success: true });
        break;

      case 'trackingStopped':
        handleTrackingStopped(request.data);
        sendResponse({ success: true });
        break;

      case 'showNotification':
        showNotification(request.title, request.message);
        sendResponse({ success: true });
        break;

      default:
        logger.warn('Unknown action received', request.action);
        sendResponse({ error: 'Unknown action: ' + request.action });
    }
  } catch (error) {
    logger.error('Error in message handler', error);
    sendResponse({ error: error.message });
  }

  return true; // Allow asynchronous responses
});

// Tracking Started Handler
function handleTrackingStarted(data) {
  logger.info('Time tracking started for ticket', data.ticketId);

  // Update tracking state
  trackingState = {
    isTracking: true,
    ticketId: data.ticketId,
    startTime: data.startTime || new Date().toISOString(),
    title: data.title || null
  };

  // Save tracking state to storage
  saveTrackingState();

  // Set badge
  updateBadge(true);

  // Notification
  showNotification(
    t('tracking_started_notification'), 
    t('ticket_id') + ' #' + (data.ticketId || t('unknown')) + ' - ' + t('timer_running')
  );
}

// Tracking Stopped Handler
function handleTrackingStopped(data) {
  logger.info('Time tracking ended for ticket', data.ticketId);
  logger.debug('Tracking data', data);

  // Clear tracking state
  trackingState = {
    isTracking: false,
    ticketId: null,
    startTime: null,
    title: null
  };

  // Save tracking state to storage
  saveTrackingState();

  // Remove badge
  updateBadge(false);

  // Notification with status
  var message = t('ticket_id') + ' #' + (data.ticketId || t('unknown')) + 
                ' - ' + t('duration') + ': ' + (data.duration || '?');

  if (data.success) {
    message += '\n' + t('auto_time_entry');
  } else {
    message += '\n' + t('manual_time_entry');
  }

  showNotification(t('tracking_stopped_notification'), message);
}

// This function is now defined earlier in the file

// Zammad URL Detection
function isZammadUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  var patterns = [
    /zammad/i,
    /\/ticket/i,
    /\/agent/i,
    /ticketZoom/i
  ];

  return patterns.some(function(pattern) {
    return pattern.test(url);
  });
}

// Tab Updates for Content Script Injection
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only for fully loaded pages
  if (changeInfo.status !== 'complete' || !tab.url) {
    return;
  }

  // Detect Zammad URLs
  if (isZammadUrl(tab.url)) {
    logger.info('Zammad page detected', tab.url);

    // Inject content script (with error handling)
    if (chrome.scripting && chrome.scripting.executeScript) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).then(function() {
        logger.debug('Content script successfully injected');
      }).catch(function(error) {
        // This is normal if the script is already injected
        logger.debug('Content script already exists', error.message);
      });
    } else {
      logger.warn('Scripting API not available');
    }
  }
});

// Tab Activation Event - Ensure badge state is maintained when tabs are switched
chrome.tabs.onActivated.addListener(function(activeInfo) {
  logger.debug('Tab activated', activeInfo.tabId);

  // Check if we have active tracking and restore badge if needed
  if (trackingState.isTracking) {
    logger.debug('Active tracking detected, ensuring badge is visible');
    updateBadge(true);
  } else {
    // Ensure badge is cleared if no active tracking
    logger.debug('No active tracking, ensuring badge is cleared');
    updateBadge(false);
  }
});

// Startup Event
chrome.runtime.onStartup.addListener(function() {
  logger.info('Browser started - Extension reactivated');
  // Load tracking state when browser starts
  loadTrackingState();
});

logger.info('Background script fully loaded');
