// Background Script für Zammad Timetracking Extension - Service Worker Fix

console.log('Zammad Timetracking Background Script startet');

// Globale Variablen
let keepAliveInterval = null;

// Service Worker aktiv halten
function keepServiceWorkerAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  keepAliveInterval = setInterval(function() {
    chrome.runtime.getPlatformInfo(function() {
      // Einfache Aktion um Service Worker aktiv zu halten
      console.log('Service Worker ping');
    });
  }, 20000); // Alle 20 Sekunden
}

// Service Worker Lifecycle Events
chrome.runtime.onStartup.addListener(function() {
  console.log('Service Worker startet');
  keepServiceWorkerAlive();
});

chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Service Worker installiert/aktualisiert');
  keepServiceWorkerAlive();
  
  if (details.reason === 'install') {
    console.log('Zammad Timetracking Extension installiert');
    showNotification('Zammad Timetracking', 'Extension erfolgreich installiert!');
  }
});

// Sofort beim Laden aktivieren
keepServiceWorkerAlive();

// Tab-Updates überwachen für persistente Zeiterfassung
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Prüfen ob es sich um eine Zammad-Seite handelt
    if (isZammadUrl(tab.url)) {
      // Content Script injizieren falls nötig
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(err => {
        // Fehler ignorieren falls Script bereits injiziert
      });
    }
  }
});

// Nachrichten von Content Script verarbeiten
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startTracking':
      handleStartTracking(request.data);
      break;
    case 'stopTracking':
      handleStopTracking(request.data);
      break;
    case 'getTrackingState':
      getTrackingState(sendResponse);
      return true; // Async response
    case 'saveTrackingState':
      saveTrackingState(request.data);
      break;
  }
});

function isZammadUrl(url) {
  // Verschiedene Zammad-URL-Patterns erkennen
  const zammadPatterns = [
    /\/ticket\/zoom\/\d+/,
    /\/tickets\//,
    /zammad/i,
    /#ticket/,
    /\/agent\//
  ];
  
  return zammadPatterns.some(pattern => pattern.test(url));
}

function handleStartTracking(data) {
  console.log('Zeiterfassung gestartet:', data);
  
  // Badge auf Extension-Icon setzen
  chrome.action.setBadgeText({
    text: '⏱'
  });
  chrome.action.setBadgeBackgroundColor({
    color: '#dc3545'
  });
  
  // Optional: Notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Zeiterfassung gestartet',
    message: `Ticket #${data.ticketId} - Zeiterfassung läuft`
  });
}

function handleStopTracking(data) {
  console.log('Zeiterfassung beendet:', data);
  
  // Badge entfernen
  chrome.action.setBadgeText({
    text: ''
  });
  
  // Notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Zeiterfassung beendet',
    message: `Ticket #${data.ticketId} - Dauer: ${data.duration}`
  });
}

function getTrackingState(sendResponse) {
  chrome.storage.local.get(['zammadTrackingState'], (result) => {
    sendResponse(result.zammadTrackingState || null);
  });
}

function saveTrackingState(state) {
  chrome.storage.local.set({ zammadTrackingState: state });
}

// Cleanup bei Browser-Shutdown
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension wird beendet - Tracking-Status beibehalten');
});

// Context Menu für erweiterte Funktionen
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'zammad-timetracker',
    title: 'Zammad Zeiterfassung',
    contexts: ['page'],
    documentUrlPatterns: ['*://*/*']
  });
  
  chrome.contextMenus.create({
    id: 'start-tracking',
    parentId: 'zammad-timetracker',
    title: 'Zeiterfassung starten',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'stop-tracking',
    parentId: 'zammad-timetracker',
    title: 'Zeiterfassung stoppen',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'start-tracking':
    case 'stop-tracking':
      chrome.tabs.sendMessage(tab.id, {
        action: 'toggleTracking'
      });
      break;
  }
});