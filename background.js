// Minimal Background Script for Zammad Timetracking Extension
console.log('Zammad Timetracking Background Script loaded');

// Import translations
importScripts('translations.js');

// Global tracking state
let trackingState = {
  isTracking: false,
  ticketId: null,
  startTime: null
};

// Load tracking state from storage
function loadTrackingState() {
  chrome.storage.local.get(['zammadTrackingState'], function(result) {
    if (result.zammadTrackingState) {
      console.log('Loaded tracking state from storage:', result.zammadTrackingState);
      trackingState = result.zammadTrackingState;

      // Restore badge if tracking is active
      if (trackingState.isTracking) {
        console.log('Restoring badge for active tracking');
        if (chrome.action && chrome.action.setBadgeText) {
          chrome.action.setBadgeText({ text: '⏱' });
          chrome.action.setBadgeBackgroundColor({ color: '#dc3545' });
        }
      }
    } else {
      console.log('No tracking state found in storage');
    }
  });
}

// Save tracking state to storage
function saveTrackingState() {
  chrome.storage.local.set({ zammadTrackingState: trackingState }, function() {
    console.log('Tracking state saved to storage:', trackingState);
  });
}

// Load tracking state when background script starts
loadTrackingState();

// Installation Event
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    console.log('First installation - showing welcome message');

    // Notification only if possible
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: t('extension_title'),
        message: t('extension_installed')
      }, function(notificationId) {
        if (chrome.runtime.lastError) {
          console.log('Notification not possible:', chrome.runtime.lastError.message);
        }
      });
    }
  }
});

// Message Handler - Main communication
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Message received:', request.action);

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
        console.log('Unknown action:', request.action);
        sendResponse({ error: 'Unknown action: ' + request.action });
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    sendResponse({ error: error.message });
  }

  return true; // Allow asynchronous responses
});

// Tracking Started Handler
function handleTrackingStarted(data) {
  console.log('Time tracking started for ticket:', data.ticketId);

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
  if (chrome.action && chrome.action.setBadgeText) {
    chrome.action.setBadgeText({ text: '⏱' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc3545' });
  }

  // Notification
  showNotification(
    t('tracking_started_notification'), 
    t('ticket_id') + ' #' + (data.ticketId || t('unknown')) + ' - ' + t('timer_running')
  );
}

// Tracking Stopped Handler
function handleTrackingStopped(data) {
  console.log('Time tracking ended for ticket:', data.ticketId);

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
  if (chrome.action && chrome.action.setBadgeText) {
    chrome.action.setBadgeText({ text: '' });
  }

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

// Notification Helper
function showNotification(title, message) {
  if (!chrome.notifications || !chrome.notifications.create) {
    console.log('Notifications not available');
    return;
  }

  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: title,
      message: message,
      requireInteraction: false
    }, function(notificationId) {
      if (chrome.runtime.lastError) {
        console.log('Notification error:', chrome.runtime.lastError.message);
      } else {
        console.log('Notification created:', notificationId);
      }
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Tab Updates for Content Script Injection
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only for fully loaded pages
  if (changeInfo.status !== 'complete' || !tab.url) {
    return;
  }

  // Detect Zammad URLs
  if (isZammadUrl(tab.url)) {
    console.log('Zammad page detected:', tab.url);

    // Inject content script (with error handling)
    if (chrome.scripting && chrome.scripting.executeScript) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).then(function() {
        console.log('Content script successfully injected');
      }).catch(function(error) {
        console.log('Content script injection error (normal if already exists):', error.message);
      });
    }
  }
});

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

// Tab Activation Event - Ensure badge state is maintained when tabs are switched
chrome.tabs.onActivated.addListener(function(activeInfo) {
  console.log('Tab activated:', activeInfo.tabId);

  // Check if we have active tracking and restore badge if needed
  if (trackingState.isTracking) {
    console.log('Active tracking detected, ensuring badge is visible');
    if (chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: '⏱' });
      chrome.action.setBadgeBackgroundColor({ color: '#dc3545' });
    }
  } else {
    // Ensure badge is cleared if no active tracking
    console.log('No active tracking, ensuring badge is cleared');
    if (chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: '' });
    }
  }
});

// Startup Event
chrome.runtime.onStartup.addListener(function() {
  console.log('Browser started - Extension reactivated');
  // Load tracking state when browser starts
  loadTrackingState();
});

console.log('Background script fully loaded');
