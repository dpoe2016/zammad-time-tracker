// Content Script für Zammad Timetracking - Nur Popup-Version
class ZammadTimetracker {
  constructor() {
    this.isTracking = false;
    this.startTime = null;
    this.ticketId = null;

    this.init();
  }

  init() {
    // Warten bis Zammad geladen ist
    this.waitForZammad(() => {
      this.loadTrackingState();
      // Message Listener für Popup-Kommunikation
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

    console.log('Zammad-Seite erkannt:', isZammad, 'URL:', window.location.href);
    return isZammad;
  }

  getCurrentTicketId() {
    // Verschiedene Methoden zur Ticket-ID-Extraktion versuchen

    // 1. Aus der URL extrahieren
    const urlPatterns = [
      /\/ticket\/zoom\/(\d+)/,
      /\/tickets\/(\d+)/,
      /ticket[_-]?id[=:](\d+)/i,
      /id[=:](\d+)/
    ];

    for (const pattern of urlPatterns) {
      const urlMatch = window.location.href.match(pattern);
      if (urlMatch && urlMatch[1]) {
        console.log(`Ticket-ID aus URL gefunden: ${urlMatch[1]}`);
        return urlMatch[1];
      }
    }

    // 2. Aus DOM-Elementen extrahieren
    const selectors = [
      '[data-ticket-id]',
      '.ticket-number',
      '.ticketZoom',
      '[id*="ticket"]',
      '[class*="ticket"]',
      '.ticket-title',
      '.ticket-info',
      'h1', 'h2', 'h3'  // Headers die oft Ticket-Info enthalten
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // data-ticket-id Attribut prüfen
        const dataId = element.getAttribute('data-ticket-id');
        if (dataId && /^\d+$/.test(dataId)) {
          console.log(`Ticket-ID aus data-attribute gefunden: ${dataId}`);
          return dataId;
        }

        // Text-Inhalt nach Zahlen durchsuchen
        const text = element.textContent || element.innerText || '';
        const textMatch = text.match(/(?:ticket|#)\s*(\d+)/i);
        if (textMatch && textMatch[1]) {
          console.log(`Ticket-ID aus Text gefunden: ${textMatch[1]}`);
          return textMatch[1];
        }

        // Nur Zahlen im Text
        const numberMatch = text.match(/^\s*(\d{3,})\s*$/);
        if (numberMatch && numberMatch[1]) {
          console.log(`Ticket-ID als Nummer gefunden: ${numberMatch[1]}`);
          return numberMatch[1];
        }
      }
    }

    // 3. Fallback: Aus Title oder Meta-Tags
    const title = document.title;
    const titleMatch = title.match(/(?:ticket|#)\s*(\d+)/i);
    if (titleMatch && titleMatch[1]) {
      console.log(`Ticket-ID aus Title gefunden: ${titleMatch[1]}`);
      return titleMatch[1];
    }

    // 4. Für Debug: Aktuelle URL loggen
    console.log('Keine Ticket-ID gefunden. Aktuelle URL:', window.location.href);
    console.log('Document title:', document.title);

    return null;
  }

  createTrackingUI() {
    // Kein UI auf der Seite erstellen - nur Popup verwenden
    console.log('Zammad Timetracker initialisiert - verwende nur Popup');
  }

  setupMessageListener() {
    // Sicherstellen dass nur ein Listener aktiv ist
    if (window.zammadListenerActive) {
      return;
    }
    window.zammadListenerActive = true;

    // Nachrichten vom Popup empfangen
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content Script empfängt Nachricht:', request.action);

      switch (request.action) {
        case 'startTracking':
          const startResult = this.startTracking();
          sendResponse({ success: startResult });
          break;
        case 'stopTracking':
          const stopResult = this.stopTracking();
          sendResponse({ success: stopResult });
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
          console.log('Ticket-ID abgefragt:', ticketId);
          sendResponse({ ticketId: ticketId });
          break;
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
      }
      return true; // Async response
    });

    console.log('Message Listener eingerichtet für Zammad Timetracker');
  }

  toggleTracking() {
    if (this.isTracking) {
      this.stopTracking();
    } else {
      this.startTracking();
    }
  }

  startTracking() {
    this.ticketId = this.getCurrentTicketId();

    if (!this.ticketId) {
      // Nachricht an Background Script für Benachrichtigung
      chrome.runtime.sendMessage({
        action: 'showNotification',
        title: 'Fehler',
        message: 'Keine Ticket-ID gefunden. Bitte stellen Sie sicher, dass Sie sich in einem Ticket befinden.'
      });
      return false;
    }

    this.isTracking = true;
    this.startTime = new Date();

    // Status speichern
    this.saveTrackingState();

    // Background Script benachrichtigen
    chrome.runtime.sendMessage({
      action: 'trackingStarted',
      data: { ticketId: this.ticketId, startTime: this.startTime.toISOString() }
    });

    console.log(`Zeittracking gestartet für Ticket #${this.ticketId}`);
    return true;
  }

  stopTracking() {
    if (!this.isTracking) return false;

    const endTime = new Date();
    const duration = Math.round((endTime - this.startTime) / 1000); // Sekunden

    this.isTracking = false;

    // Zeit in Zammad eintragen
    const success = this.submitTimeEntry(duration);

    // Status löschen
    this.clearTrackingState();

    // Background Script benachrichtigen
    chrome.runtime.sendMessage({
      action: 'trackingStopped',
      data: { 
        ticketId: this.ticketId, 
        duration: this.formatDuration(duration),
        success: success
      }
    });

    console.log(`Zeittracking beendet für Ticket #${this.ticketId}. Dauer: ${this.formatDuration(duration)}`);
    return true;
  }

  startTimer() {
    // Timer wird nur im Popup angezeigt - hier nicht benötigt
  }

  stopTimer() {
    // Timer wird nur im Popup angezeigt - hier nicht benötigt
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  submitTimeEntry(durationInSeconds) {
    const durationInMinutes = Math.round(durationInSeconds / 60);

    // Versuchen, das Zammad Time Accounting Feld zu finden und auszufüllen
    const timeFields = [
      'input[name="time_unit"]',
      'input[id*="time"]',
      '.time-accounting input',
      '[data-attribute-name="time_unit"] input'
    ];

    let timeField = null;
    for (const selector of timeFields) {
      timeField = document.querySelector(selector);
      if (timeField) break;
    }

    if (timeField) {
      timeField.value = durationInMinutes;
      timeField.dispatchEvent(new Event('input', { bubbles: true }));
      timeField.dispatchEvent(new Event('change', { bubbles: true }));

      // Optional: Auch das Activity-Feld setzen falls vorhanden
      const activityField = document.querySelector('select[name="type_id"], select[id*="activity"]');
      if (activityField && activityField.options.length > 1) {
        activityField.selectedIndex = 1; // Erste verfügbare Option wählen
        activityField.dispatchEvent(new Event('change', { bubbles: true }));
      }

      alert(`Zeiterfassung beendet!\nTicket: #${this.ticketId}\nDauer: ${this.formatDuration(durationInSeconds)}\nMinuten eingetragen: ${durationInMinutes}`);
    } else {
      // Fallback: Benutzer manuell informieren
      const message = `Zeiterfassung beendet!\n\nTicket: #${this.ticketId}\nDauer: ${this.formatDuration(durationInSeconds)}\nMinuten: ${durationInMinutes}\n\nBitte tragen Sie die Zeit manuell in das Zeiterfassungsfeld ein.`;

      // Versuchen, eine Notification zu zeigen oder Alert zu verwenden
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Zammad Timetracking', {
          body: message,
          icon: '/favicon.ico'
        });
      } else {
        alert(message);
      }
    }
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
        // Prüfen ob wir noch im gleichen Ticket sind
        const currentTicketId = this.getCurrentTicketId();

        if (currentTicketId === state.ticketId) {
          this.isTracking = true;
          this.startTime = new Date(state.startTime);
          this.ticketId = state.ticketId;

          console.log(`Zeittracking fortgesetzt für Ticket #${this.ticketId}`);
        } else {
          // Anderes Ticket - State löschen
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

// Extension initialisieren wenn DOM geladen ist
console.log('Zammad Timetracker Content Script wird geladen...');

// Vermeiden von mehreren Instanzen
if (!window.zammadTrackerInstance) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOM geladen, initialisiere Zammad Timetracker');
      window.zammadTrackerInstance = new ZammadTimetracker();
    });
  } else {
    console.log('DOM bereits geladen, initialisiere Zammad Timetracker');
    window.zammadTrackerInstance = new ZammadTimetracker();
  }

  // Auch bei Navigation innerhalb von Zammad neu initialisieren
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('URL geändert zu:', url);
      setTimeout(() => {
        if (!window.zammadTrackerInstance || window.zammadTrackerInstance.needsReinit) {
          console.log('Reinitialisiere nach URL-Änderung');
          window.zammadTrackerInstance = new ZammadTimetracker();
        }
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
} else {
  console.log('Zammad Timetracker bereits initialisiert');
}
