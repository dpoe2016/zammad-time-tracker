// Translations for Zammad Timetracking Extension

// Available languages
const LANGUAGES = {
  DE: 'de',
  EN: 'en'
};

// Default language
let currentLanguage = LANGUAGES.DE;

// Try to detect browser language
function detectLanguage() {
  const browserLang = (navigator.language || navigator.userLanguage || '').split('-')[0].toLowerCase();
  return browserLang === 'en' ? LANGUAGES.EN : LANGUAGES.DE;
}

// Initialize language
function initLanguage() {
  // Try to get saved language preference
  chrome.storage.local.get(['zammadLanguage'], (result) => {
    if (result.zammadLanguage) {
      currentLanguage = result.zammadLanguage;
    } else {
      // If no saved preference, detect from browser
      currentLanguage = detectLanguage();
      // Save the detected language
      saveLanguagePreference(currentLanguage);
    }

    // Update UI if we're in popup
    if (typeof updateUILanguage === 'function') {
      updateUILanguage();
    }
  });
}

// Save language preference
function saveLanguagePreference(lang) {
  chrome.storage.local.set({ zammadLanguage: lang });
}

// Set language and update UI
function setLanguage(lang) {
  if (Object.values(LANGUAGES).includes(lang)) {
    currentLanguage = lang;
    saveLanguagePreference(lang);

    // Update UI if we're in popup
    if (typeof updateUILanguage === 'function') {
      updateUILanguage();
    }

    return true;
  }
  return false;
}

// Get current language
function getCurrentLanguage() {
  return currentLanguage;
}

// Translation strings
const translations = {
  // Popup UI
  'extension_title': {
    [LANGUAGES.DE]: 'Zammad Timetracking',
    [LANGUAGES.EN]: 'Zammad Time Tracking'
  },
  'subtitle': {
    [LANGUAGES.DE]: 'Zeiterfassung für Tickets',
    [LANGUAGES.EN]: 'Time tracking for tickets'
  },
  'status_active': {
    [LANGUAGES.DE]: 'Aktiv',
    [LANGUAGES.EN]: 'Active'
  },
  'status_inactive': {
    [LANGUAGES.DE]: 'Nicht aktiv',
    [LANGUAGES.EN]: 'Inactive'
  },
  'ticket_loading': {
    [LANGUAGES.DE]: 'Ticket wird geladen...',
    [LANGUAGES.EN]: 'Loading ticket...'
  },
  'ticket': {
    [LANGUAGES.DE]: 'Ticket',
    [LANGUAGES.EN]: 'Ticket'
  },
  'time_spent': {
    [LANGUAGES.DE]: 'Erfasst',
    [LANGUAGES.EN]: 'Recorded'
  },
  'min': {
    [LANGUAGES.DE]: 'Min',
    [LANGUAGES.EN]: 'min'
  },
  'btn_start': {
    [LANGUAGES.DE]: 'Start',
    [LANGUAGES.EN]: 'Start'
  },
  'btn_stop': {
    [LANGUAGES.DE]: 'Stop',
    [LANGUAGES.EN]: 'Stop'
  },
  'checking_page': {
    [LANGUAGES.DE]: 'Überprüfe Zammad-Seite...',
    [LANGUAGES.EN]: 'Checking Zammad page...'
  },
  'settings': {
    [LANGUAGES.DE]: 'Einstellungen',
    [LANGUAGES.EN]: 'Settings'
  },
  'notifications': {
    [LANGUAGES.DE]: 'Benachrichtigungen',
    [LANGUAGES.EN]: 'Notifications'
  },
  'auto_submit': {
    [LANGUAGES.DE]: 'Auto-Submit',
    [LANGUAGES.EN]: 'Auto-Submit'
  },
  'language': {
    [LANGUAGES.DE]: 'Sprache',
    [LANGUAGES.EN]: 'Language'
  },
  'debug_mode': {
    [LANGUAGES.DE]: 'Debug-Modus aktiviert',
    [LANGUAGES.EN]: 'Debug mode activated'
  },
  'title_not_available': {
    [LANGUAGES.DE]: 'Titel nicht verfügbar',
    [LANGUAGES.EN]: 'Title not available'
  },
  'ready_for_tracking': {
    [LANGUAGES.DE]: 'Bereit für Zeiterfassung',
    [LANGUAGES.EN]: 'Ready for time tracking'
  },
  'open_ticket': {
    [LANGUAGES.DE]: 'Öffnen Sie ein Zammad-Ticket',
    [LANGUAGES.EN]: 'Please open a Zammad ticket'
  },
  'page_check_error': {
    [LANGUAGES.DE]: 'Fehler beim Überprüfen der Seite',
    [LANGUAGES.EN]: 'Error checking the page'
  },
  'starting_tracking': {
    [LANGUAGES.DE]: 'Starte Zeiterfassung...',
    [LANGUAGES.EN]: 'Starting time tracking...'
  },
  'tracking_started': {
    [LANGUAGES.DE]: 'Zeiterfassung gestartet!',
    [LANGUAGES.EN]: 'Time tracking started!'
  },
  'tracking_running': {
    [LANGUAGES.DE]: 'Zeiterfassung läuft...',
    [LANGUAGES.EN]: 'Time tracking running...'
  },
  'title_loading': {
    [LANGUAGES.DE]: 'Titel wird geladen...',
    [LANGUAGES.EN]: 'Loading title...'
  },
  'no_active_tracking': {
    [LANGUAGES.DE]: 'Keine aktive Zeiterfassung',
    [LANGUAGES.EN]: 'No active time tracking'
  },
  'time_recorded': {
    [LANGUAGES.DE]: 'Zeit eingetragen',
    [LANGUAGES.EN]: 'Time recorded'
  },
  'manual_entry_required': {
    [LANGUAGES.DE]: 'Bitte {} Min manuell eintragen',
    [LANGUAGES.EN]: 'Please enter {} min manually'
  },
  'stop_error': {
    [LANGUAGES.DE]: 'Fehler beim Stoppen',
    [LANGUAGES.EN]: 'Error stopping'
  },
  'settings_saved': {
    [LANGUAGES.DE]: 'Einstellungen gespeichert',
    [LANGUAGES.EN]: 'Settings saved'
  },

  // API Settings
  'api_settings': {
    [LANGUAGES.DE]: 'API Einstellungen',
    [LANGUAGES.EN]: 'API Settings'
  },
  'api_settings_title': {
    [LANGUAGES.DE]: 'Zammad API Einstellungen',
    [LANGUAGES.EN]: 'Zammad API Settings'
  },
  'api_base_url': {
    [LANGUAGES.DE]: 'Base URL',
    [LANGUAGES.EN]: 'Base URL'
  },
  'api_token': {
    [LANGUAGES.DE]: 'API Token',
    [LANGUAGES.EN]: 'API Token'
  },
  'api_edit': {
    [LANGUAGES.DE]: 'Bearbeiten',
    [LANGUAGES.EN]: 'Edit'
  },
  'api_options': {
    [LANGUAGES.DE]: 'Optionen',
    [LANGUAGES.EN]: 'Options'
  },
  'api_save': {
    [LANGUAGES.DE]: 'Speichern',
    [LANGUAGES.EN]: 'Save'
  },
  'api_cancel': {
    [LANGUAGES.DE]: 'Abbrechen',
    [LANGUAGES.EN]: 'Cancel'
  },
  'api_saved': {
    [LANGUAGES.DE]: 'API Einstellungen gespeichert',
    [LANGUAGES.EN]: 'API settings saved'
  },
  'api_error': {
    [LANGUAGES.DE]: 'API Fehler',
    [LANGUAGES.EN]: 'API Error'
  },

  // Content script
  'no_ticket_id': {
    [LANGUAGES.DE]: 'Keine Ticket-ID gefunden. Bitte stellen Sie sicher, dass Sie sich in einem Ticket befinden.',
    [LANGUAGES.EN]: 'No ticket ID found. Please make sure you are in a ticket.'
  },
  'tracking_ended': {
    [LANGUAGES.DE]: 'Zeiterfassung beendet!',
    [LANGUAGES.EN]: 'Time tracking ended!'
  },
  'ticket_id': {
    [LANGUAGES.DE]: 'Ticket',
    [LANGUAGES.EN]: 'Ticket'
  },
  'duration': {
    [LANGUAGES.DE]: 'Dauer',
    [LANGUAGES.EN]: 'Duration'
  },
  'minutes_entered': {
    [LANGUAGES.DE]: 'Minuten eingetragen',
    [LANGUAGES.EN]: 'Minutes entered'
  },
  'manual_entry_message': {
    [LANGUAGES.DE]: 'Bitte tragen Sie die Zeit manuell in das Zeiterfassungsfeld ein.',
    [LANGUAGES.EN]: 'Please enter the time manually in the time tracking field.'
  },

  // Background script
  'extension_installed': {
    [LANGUAGES.DE]: 'Extension erfolgreich installiert!',
    [LANGUAGES.EN]: 'Extension successfully installed!'
  },
  'tracking_started_notification': {
    [LANGUAGES.DE]: 'Zeiterfassung gestartet',
    [LANGUAGES.EN]: 'Time tracking started'
  },
  'timer_running': {
    [LANGUAGES.DE]: 'Timer läuft',
    [LANGUAGES.EN]: 'Timer running'
  },
  'tracking_stopped_notification': {
    [LANGUAGES.DE]: 'Zeiterfassung beendet',
    [LANGUAGES.EN]: 'Time tracking stopped'
  },
  'unknown': {
    [LANGUAGES.DE]: 'unbekannt',
    [LANGUAGES.EN]: 'unknown'
  },
  'auto_time_entry': {
    [LANGUAGES.DE]: 'Zeit automatisch eingetragen.',
    [LANGUAGES.EN]: 'Time automatically entered.'
  },
  'manual_time_entry': {
    [LANGUAGES.DE]: 'Bitte Zeit manuell eintragen.',
    [LANGUAGES.EN]: 'Please enter time manually.'
  },

  // Options page
  'options_title': {
    [LANGUAGES.DE]: 'Optionen',
    [LANGUAGES.EN]: 'Options'
  },

  // New API status messages
  'api_not_initialized': {
    [LANGUAGES.DE]: 'API nicht initialisiert. Bitte API-Einstellungen konfigurieren.',
    [LANGUAGES.EN]: 'API not initialized. Please configure API settings.'
  },
  'api_not_configured': {
    [LANGUAGES.DE]: 'API nicht konfiguriert. Bitte in den Optionen einrichten.',
    [LANGUAGES.EN]: 'API not configured. Please set up in options.'
  },
  'loading_ticket_info': {
    [LANGUAGES.DE]: 'Lade Ticket-Informationen...',
    [LANGUAGES.EN]: 'Loading ticket information...'
  },
  'ticket_loaded': {
    [LANGUAGES.DE]: 'Ticket erfolgreich geladen',
    [LANGUAGES.EN]: 'Ticket successfully loaded'
  },
  'no_ticket_data': {
    [LANGUAGES.DE]: 'Keine Ticket-Daten erhalten',
    [LANGUAGES.EN]: 'No ticket data received'
  },
  'ticket_load_error': {
    [LANGUAGES.DE]: 'Fehler beim Laden des Tickets',
    [LANGUAGES.EN]: 'Error loading ticket'
  }
};

// Get translation by key
function t(key, placeholders = []) {
  let text = translations[key]?.[currentLanguage] || key;

  // Replace placeholders if any
  if (placeholders.length > 0) {
    placeholders.forEach((value, index) => {
      text = text.replace(`{${index}}`, value);
    });
  }

  return text;
}

// Initialize language when script is loaded
initLanguage();

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    t,
    setLanguage,
    getCurrentLanguage,
    LANGUAGES
  };
}
