# Zammad Time Tracker Fix

## Problem
The start and stop buttons in the Zammad Time Tracker Chrome extension were not working properly. The issue was that the popup.html file was not properly communicating with the content.js file to start and stop tracking.

## Solution
The solution involves two main changes:

1. Added handlers for 'getTicketInfo' and 'submitTime' actions in content.js
2. Modified popup.html to send 'startTracking' and 'stopTracking' messages to content.js

### Changes in content.js
Added handlers for 'getTicketInfo' and 'submitTime' actions in the message listener:

```javascript
case 'getTicketInfo':
  // Handle getTicketInfo action from popup
  const currentTicketId = this.getCurrentTicketId();
  console.log('Ticket-Info abgefragt:', currentTicketId);
  
  // Get ticket title from page if possible
  let title = '';
  try {
    const titleElement = document.querySelector('.ticket-title, .ticketZoom-header .ticket-number + div, h1, h2');
    if (titleElement) {
      title = titleElement.textContent.trim();
    }
  } catch (e) {
    console.error('Fehler beim Extrahieren des Titels:', e);
  }
  
  // Get time spent if available
  let timeSpent = 0;
  try {
    const timeField = document.querySelector('input[name="time_unit"], input[id*="time"], .time-accounting input');
    if (timeField && timeField.value) {
      timeSpent = parseFloat(timeField.value) || 0;
    }
  } catch (e) {
    console.error('Fehler beim Extrahieren der Zeit:', e);
  }
  
  sendResponse({ 
    ticketId: currentTicketId,
    title: title,
    timeSpent: timeSpent
  });
  break;
case 'submitTime':
  // Handle submitTime action from popup
  console.log('Zeit eintragen:', request.duration, 'Minuten für Ticket', request.ticketId);
  
  let success = false;
  if (request.duration > 0) {
    // Convert minutes to seconds for submitTimeEntry
    success = this.submitTimeEntry(request.duration * 60);
  }
  
  sendResponse({ success: success });
  break;
```

### Changes in popup.html
Modified the startTracking and stopTracking methods to communicate with content.js:

#### In startTracking method:
Added code to send a message to content.js to start tracking:

```javascript
// Content Script benachrichtigen, um Tracking zu starten
try {
    const trackingResponse = await chrome.tabs.sendMessage(tab.id, { 
        action: 'startTracking'
    });
    
    if (!trackingResponse || !trackingResponse.success) {
        this.debug('Content Script konnte Tracking nicht starten');
    } else {
        this.debug('Content Script hat Tracking gestartet');
    }
} catch (error) {
    this.debug('Fehler beim Starten des Trackings im Content Script: ' + error.message);
}
```

#### In stopTracking method:
Added code to send a message to content.js to stop tracking:

```javascript
// Content Script benachrichtigen, um Tracking zu stoppen
try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const stopResponse = await chrome.tabs.sendMessage(tab.id, { 
        action: 'stopTracking'
    });
    
    if (!stopResponse || !stopResponse.success) {
        this.debug('Content Script konnte Tracking nicht stoppen');
    } else {
        this.debug('Content Script hat Tracking gestoppt');
    }
} catch (error) {
    this.debug('Fehler beim Stoppen des Trackings im Content Script: ' + error.message);
}
```

## How to Apply the Fix
1. Replace the content.js file with the fixed version
2. Replace the popup.html file with popup_fixed.html

After making these changes, the start and stop buttons should work properly, and time tracking should be recorded correctly.