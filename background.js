// Minimales Background Script für Zammad Timetracking Extension
console.log('Zammad Timetracking Background Script geladen');

// Installation Event
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Extension installiert/aktualisiert:', details.reason);
  
  if (details.reason === 'install') {
    console.log('Erste Installation - zeige Willkommensnachricht');
    
    // Notification nur wenn möglich
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Zammad Timetracking',
        message: 'Extension erfolgreich installiert!'
      }, function(notificationId) {
        if (chrome.runtime.lastError) {
          console.log('Notification nicht möglich:', chrome.runtime.lastError.message);
        }
      });
    }
  }
});

// Message Handler - Hauptkommunikation
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Nachricht empfangen:', request.action);
  
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
        console.log('Unbekannte Aktion:', request.action);
        sendResponse({ error: 'Unknown action: ' + request.action });
    }
  } catch (error) {
    console.error('Fehler in Message Handler:', error);
    sendResponse({ error: error.message });
  }
  
  return true; // Asynchrone Antworten erlauben
});

// Tracking Started Handler
function handleTrackingStarted(data) {
  console.log('Zeiterfassung gestartet für Ticket:', data.ticketId);
  
  // Badge setzen
  if (chrome.action && chrome.action.setBadgeText) {
    chrome.action.setBadgeText({ text: '⏱' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc3545' });
  }
  
  // Notification
  showNotification(
    'Zeiterfassung gestartet', 
    'Ticket #' + (data.ticketId || 'unbekannt') + ' - Timer läuft'
  );
}

// Tracking Stopped Handler
function handleTrackingStopped(data) {
  console.log('Zeiterfassung beendet für Ticket:', data.ticketId);
  
  // Badge entfernen
  if (chrome.action && chrome.action.setBadgeText) {
    chrome.action.setBadgeText({ text: '' });
  }
  
  // Notification mit Status
  var message = 'Ticket #' + (data.ticketId || 'unbekannt') + 
                ' - Dauer: ' + (data.duration || '?');
  
  if (data.success) {
    message += '\nZeit automatisch eingetragen.';
  } else {
    message += '\nBitte Zeit manuell eintragen.';
  }
  
  showNotification('Zeiterfassung beendet', message);
}

// Notification Helper
function showNotification(title, message) {
  if (!chrome.notifications || !chrome.notifications.create) {
    console.log('Notifications nicht verfügbar');
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
        console.log('Notification Fehler:', chrome.runtime.lastError.message);
      } else {
        console.log('Notification erstellt:', notificationId);
      }
    });
  } catch (error) {
    console.error('Fehler beim Erstellen der Notification:', error);
  }
}

// Tab Updates für Content Script Injection
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Nur bei vollständig geladenen Seiten
  if (changeInfo.status !== 'complete' || !tab.url) {
    return;
  }
  
  // Zammad-URLs erkennen
  if (isZammadUrl(tab.url)) {
    console.log('Zammad-Seite erkannt:', tab.url);
    
    // Content Script injizieren (mit Error Handling)
    if (chrome.scripting && chrome.scripting.executeScript) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).then(function() {
        console.log('Content Script erfolgreich injiziert');
      }).catch(function(error) {
        console.log('Content Script Injection Fehler (normal wenn bereits vorhanden):', error.message);
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

// Startup Event
chrome.runtime.onStartup.addListener(function() {
  console.log('Browser gestartet - Extension reaktiviert');
});

console.log('Background Script vollständig geladen');