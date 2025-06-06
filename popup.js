// Function to update UI language - called from translations.js
function updateUILanguage() {
    // Update static UI elements
    document.getElementById('extensionTitle').textContent = t('extension_title');
    document.getElementById('subtitle').textContent = t('subtitle');
    document.getElementById('statusText').textContent = t(document.querySelector('.status-dot').classList.contains('active') ? 'status_active' : 'status_inactive');
    document.getElementById('ticketTitle').textContent = t('ticket_loading');
    document.getElementById('ticketLabel').textContent = t('ticket');
    document.getElementById('timeSpentLabel').textContent = t('time_spent');
    document.getElementById('minLabel').textContent = t('min');
    document.getElementById('startBtn').textContent = t('btn_start');
    document.getElementById('stopBtn').textContent = t('btn_stop');
    document.getElementById('infoText').textContent = t('checking_page');
    document.getElementById('settingsTitle').textContent = t('settings');
    document.getElementById('notificationsLabel').textContent = t('notifications');
    document.getElementById('autoSubmitLabel').textContent = t('auto_submit');
    document.getElementById('languageLabel').textContent = t('language');
    document.getElementById('debugInfo').textContent = t('debug_mode');

    // Set language selector to current language
    document.getElementById('languageSelect').value = getCurrentLanguage();

    // Update document title
    document.title = t('extension_title');
}

class TimetrackingPopup {
    constructor() {
        console.log('Popup wird initialisiert...');
        
        this.isTracking = false;
        this.startTime = null;
        this.timerInterval = null;
        this.currentTicketId = null;
        this.currentTicketTitle = null;
        this.currentTimeSpent = 0;
        
        this.initElements();
        this.initEventListeners();
        this.loadState();

        // Update UI language
        updateUILanguage();
    }
    
    initElements() {
        console.log('Initialisiere UI-Elemente...');
        
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.ticketInfo = document.getElementById('ticketInfo');
        this.ticketTitle = document.getElementById('ticketTitle');
        this.ticketId = document.getElementById('ticketId');
        this.timeSpent = document.getElementById('timeSpent');
        this.timerDisplay = document.getElementById('timerDisplay');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.infoText = document.getElementById('infoText');
        this.notificationsToggle = document.getElementById('notificationsToggle');
        this.autoSubmitToggle = document.getElementById('autoSubmitToggle');
        this.debugInfo = document.getElementById('debugInfo');
        
        console.log('UI-Elemente initialisiert');
    }
    
    initEventListeners() {
        console.log('Richte Event Listener ein...');
        
        this.startBtn.addEventListener('click', () => {
            console.log('Start-Button geklickt');
            this.startTracking();
        });
        
        this.stopBtn.addEventListener('click', () => {
            console.log('Stop-Button geklickt');
            this.stopTracking();
        });
        
        this.notificationsToggle.addEventListener('change', () => {
            console.log('Benachrichtigungen geändert:', this.notificationsToggle.checked);
            this.saveSettings();
        });
        
        this.autoSubmitToggle.addEventListener('change', () => {
            console.log('Auto-Submit geändert:', this.autoSubmitToggle.checked);
            this.saveSettings();
        });
        
        // Language selector
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            const newLang = e.target.value;
            console.log('Sprache geändert:', newLang);
            setLanguage(newLang);
            // Ensure UI is updated immediately with the new language
            updateUILanguage();
            this.saveSettings();
        });
        
        // Debug-Modus Toggle
        document.querySelector('.header').addEventListener('dblclick', () => {
            const isVisible = this.debugInfo.style.display !== 'none';
            this.debugInfo.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                this.debug('Debug-Modus aktiviert');
            }
        });
        
        console.log('Event Listener eingerichtet');
    }
    
    debug(message) {
        const timestamp = new Date().toLocaleTimeString();
        console.log('[Popup Debug]', timestamp, message);
        this.debugInfo.textContent = timestamp + ': ' + message;
    }
    
    async loadState() {
        this.debug('Lade gespeicherten Status...');
        
        try {
            const result = await chrome.storage.local.get(['zammadTrackingState', 'zammadSettings']);
            const state = result.zammadTrackingState;
            const settings = result.zammadSettings || {};
            
            this.debug('Status geladen: ' + JSON.stringify(state));
            
            // Settings anwenden
            this.notificationsToggle.checked = settings.notifications !== false;
            this.autoSubmitToggle.checked = settings.autoSubmit !== false;
            
            // Aktives Tracking wiederherstellen
            if (state && state.isTracking && state.startTime) {
                this.debug('Aktives Tracking gefunden - stelle wieder her');
                
                this.isTracking = true;
                this.startTime = new Date(state.startTime);
                this.currentTicketId = state.ticketId;
                this.currentTicketTitle = state.title;
                this.currentTimeSpent = state.timeSpent || 0;
                
                this.updateUI();
                this.startTimer();
                
                this.ticketId.textContent = '#' + state.ticketId;
                
                // Ticket-Informationen anzeigen
                if (state.title) {
                    this.ticketTitle.textContent = state.title;
                } else {
                    this.ticketTitle.textContent = t('title_not_available');
                }
                
                this.timeSpent.textContent = Math.round(state.timeSpent || 0);
                this.ticketInfo.style.display = 'block';
                this.infoText.textContent = t('tracking_running');
                this.infoText.className = 'info success';
                
                this.debug('Tracking wiederhergestellt für Ticket: ' + state.ticketId);
            } else {
                this.debug('Kein aktives Tracking - prüfe Seite');
                await this.checkCurrentPage();
            }
            
        } catch (error) {
            this.debug('Fehler beim Laden: ' + error.message);
            console.error('Fehler beim Laden des Status:', error);
            await this.checkCurrentPage();
        }
    }
    
    async checkCurrentPage() {
        this.debug('Prüfe aktuelle Seite...');
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.debug('URL: ' + tab.url);
            
            if (this.isZammadUrl(tab.url)) {
                this.debug('Zammad-Seite erkannt - lade Ticket-Informationen');
                
                // Content Script injizieren
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    this.debug('Content Script injiziert');
                } catch (e) {
                    this.debug('Content Script bereits vorhanden: ' + e.message);
                }
                
                // Kurz warten
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Ticket-Informationen laden
                await this.loadTicketInfo(tab);
                
                this.infoText.textContent = t('ready_for_tracking');
                this.infoText.className = 'info';
                this.startBtn.disabled = false;
            } else {
                this.debug('Keine Zammad-Seite');
                this.infoText.textContent = t('open_ticket');
                this.infoText.className = 'info';
                this.startBtn.disabled = true;
            }
        } catch (error) {
            this.debug('Fehler bei Seitenprüfung: ' + error.message);
            this.infoText.textContent = t('page_check_error');
            this.infoText.className = 'info error';
        }
    }
    
    async loadTicketInfo(tab) {
        try {
            this.debug('Lade Ticket-Informationen...');
            
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getTicketInfo' });
            
            if (response) {
                this.debug('Ticket-Info erhalten: ' + JSON.stringify(response));
                
                if (response.ticketId) {
                    this.ticketId.textContent = '#' + response.ticketId;
                    this.currentTicketId = response.ticketId;
                }
                
                if (response.title) {
                    this.ticketTitle.textContent = response.title;
                    this.currentTicketTitle = response.title;
                    this.debug('Ticket-Titel: ' + response.title);
                } else {
                    this.ticketTitle.textContent = t('title_not_available');
                }
                
                if (response.timeSpent !== undefined && response.timeSpent > 0) {
                    this.timeSpent.textContent = Math.round(response.timeSpent);
                    this.currentTimeSpent = response.timeSpent;
                    this.debug('Bereits erfasste Zeit: ' + response.timeSpent + ' Min');
                } else {
                    this.timeSpent.textContent = '0';
                    this.currentTimeSpent = 0;
                }
                
                // Ticket-Info anzeigen wenn Daten vorhanden
                if (response.ticketId || response.title) {
                    this.ticketInfo.style.display = 'block';
                }
                
            } else {
                this.debug('Keine Ticket-Info vom Content Script erhalten');
            }
        } catch (error) {
            this.debug('Fehler beim Laden der Ticket-Info: ' + error.message);
        }
    }
    
    isZammadUrl(url) {
        if (!url) return false;
        
        const patterns = [
            /zammad/i,
            /ticket/i,
            /agent/i,
            /\/tickets?\//,
            /ticketZoom/i
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }
    
    async startTracking() {
        try {
            this.debug('Starte Zeiterfassung...');
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.debug('Tab URL: ' + tab.url);
            
            if (!this.isZammadUrl(tab.url)) {
                this.infoText.textContent = t('open_ticket');
                this.infoText.className = 'info error';
                this.debug('Keine Zammad-URL');
                return;
            }
            
            this.startBtn.disabled = true;
            this.infoText.textContent = t('starting_tracking');
            this.infoText.className = 'info';
            
            // Content Script injizieren
            this.debug('Injiziere Content Script...');
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                this.debug('Content Script injiziert');
            } catch (e) {
                this.debug('Content Script Fehler: ' + e.message);
            }
            
            // Warten für Content Script
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Ticket-ID und -Info versuchen zu finden
            let ticketId = await this.getTicketInfo(tab);
            
            if (!ticketId) {
                this.debug('Keine Ticket-ID - verwende Fallback');
                ticketId = 'fallback-' + Date.now();
            }
            
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
            
            // Tracking starten
            this.debug('Starte Timer für Ticket: ' + ticketId);
            this.isTracking = true;
            this.startTime = new Date();
            this.currentTicketId = ticketId;
            
            // Status speichern (mit erweiterten Informationen)
            await chrome.storage.local.set({
                zammadTrackingState: {
                    isTracking: true,
                    startTime: this.startTime.toISOString(),
                    ticketId: ticketId,
                    title: this.currentTicketTitle || null,
                    timeSpent: this.currentTimeSpent || 0,
                    url: tab.url
                }
            });
            
            // UI aktualisieren
            this.updateUI();
            this.startTimer();
            
            this.ticketId.textContent = '#' + ticketId;
            
            // Ticket-Titel und bereits erfasste Zeit anzeigen
            if (this.currentTicketTitle) {
                this.ticketTitle.textContent = this.currentTicketTitle;
            } else {
                this.ticketTitle.textContent = t('title_loading');
            }
            
            if (this.currentTimeSpent > 0) {
                this.timeSpent.textContent = Math.round(this.currentTimeSpent);
            } else {
                this.timeSpent.textContent = '0';
            }
            
            this.ticketInfo.style.display = 'block';
            this.infoText.textContent = t('tracking_started');
            this.infoText.className = 'info success';
            
            // Background Script benachrichtigen
            try {
                chrome.runtime.sendMessage({
                    action: 'trackingStarted',
                    data: { ticketId: ticketId, startTime: this.startTime.toISOString() }
                });
                this.debug('Background Script benachrichtigt');
            } catch (error) {
                this.debug('Background Script Fehler: ' + error.message);
            }
            
            this.debug('Zeiterfassung erfolgreich gestartet');
            
            // Popup schließen
            setTimeout(() => window.close(), 2000);
            
        } catch (error) {
            this.debug('Kritischer Fehler: ' + error.message);
            console.error('Startfehler:', error);
            this.infoText.textContent = 'Fehler: ' + error.message;
            this.infoText.className = 'info error';
            this.startBtn.disabled = false;
        }
    }
    
    async getTicketInfo(tab) {
        // Mehrere Strategien versuchen
        
        // 1. Content Script fragen - erweiterte Ticket-Info
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                this.debug('Content Script Versuch ' + attempt);
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'getTicketInfo' });
                if (response && response.ticketId) {
                    this.debug('Ticket-Info von Content Script: ' + JSON.stringify(response));
                    
                    // Ticket-Informationen im Popup speichern
                    this.currentTicketTitle = response.title;
                    this.currentTimeSpent = response.timeSpent || 0;
                    
                    return response.ticketId;
                }
            } catch (error) {
                this.debug('Content Script Versuch ' + attempt + ' fehlgeschlagen');
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        // 2. URL-Pattern versuchen
        this.debug('Versuche URL-Parsing...');
        const urlPatterns = [
            /\/ticket\/zoom\/(\d+)/,
            /\/ticket.*?\/(\d+)/,
            /ticket.*?(\d+)/,
            /#.*?(\d+)/
        ];
        
        for (const pattern of urlPatterns) {
            const match = tab.url.match(pattern);
            if (match && match[1]) {
                this.debug('Ticket-ID aus URL: ' + match[1]);
                return match[1];
            }
        }
        
        this.debug('Keine Ticket-ID gefunden');
        return null;
    }
    
    async stopTracking() {
        try {
            this.debug('Stoppe Zeiterfassung...');
            
            if (!this.isTracking || !this.startTime) {
                this.debug('Keine aktive Zeiterfassung');
                this.infoText.textContent = t('no_active_tracking');
                this.infoText.className = 'info error';
                return;
            }
            
            // Zeit berechnen
            const endTime = new Date();
            const duration = Math.round((endTime - this.startTime) / 1000);
            const durationMinutes = Math.round(duration / 60);
            const durationText = this.formatDuration(duration);
            
            this.debug('Dauer: ' + durationText + ' (' + durationMinutes + ' Min)');
            
            // Status zurücksetzen
            this.isTracking = false;
            const ticketId = this.currentTicketId;
            const ticketTitle = this.currentTicketTitle;
            
            // UI aktualisieren
            this.updateUI();
            this.stopTimer();
            
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
            
            // Storage löschen
            await chrome.storage.local.remove(['zammadTrackingState']);
            this.debug('Status gelöscht');
            
            // Auto-Submit versuchen
            let autoSubmitSuccess = await this.tryAutoSubmit(ticketId, durationMinutes);
            
            // UI Feedback
            this.ticketInfo.style.display = 'none';
            if (autoSubmitSuccess) {
                this.infoText.textContent = t('time_recorded') + ': ' + durationMinutes + ' ' + t('min');
                this.infoText.className = 'info success';
            } else {
                this.infoText.textContent = t('manual_entry_required', [durationMinutes]);
                this.infoText.className = 'info error';
            }
            
            // Background Script benachrichtigen
            try {
                chrome.runtime.sendMessage({
                    action: 'trackingStopped',
                    data: {
                        ticketId: ticketId,
                        title: ticketTitle,
                        duration: durationText,
                        success: autoSubmitSuccess
                    }
                });
            } catch (error) {
                this.debug('Background Script Fehler: ' + error.message);
            }
            
            this.debug('Zeiterfassung erfolgreich beendet');
            
            // Reset der lokalen Variablen
            this.currentTicketId = null;
            this.currentTicketTitle = null;
            this.currentTimeSpent = 0;
            
            // Popup schließen
            setTimeout(() => window.close(), 3000);
            
        } catch (error) {
            this.debug('Stopp-Fehler: ' + error.message);
            console.error('Stopp-Fehler:', error);
            this.infoText.textContent = t('stop_error') + ': ' + error.message;
            this.infoText.className = 'info error';
        }
    }
    
    async tryAutoSubmit(ticketId, durationMinutes) {
        try {
            this.debug('Versuche automatisches Eintragen...');
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'submitTime',
                duration: durationMinutes,
                ticketId: ticketId
            });
            
            if (response && response.success) {
                this.debug('Auto-Submit erfolgreich');
                return true;
            } else {
                this.debug('Auto-Submit fehlgeschlagen');
                return false;
            }
        } catch (error) {
            this.debug('Auto-Submit Fehler: ' + error.message);
            return false;
        }
    }
    
    updateUI() {
        if (this.isTracking) {
            this.statusDot.className = 'status-dot active';
            this.statusText.textContent = 'Aktiv';
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
        } else {
            this.statusDot.className = 'status-dot inactive';
            this.statusText.textContent = 'Nicht aktiv';
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.timerDisplay.textContent = '00:00:00';
        }
    }
    
    startTimer() {
        this.debug('Timer gestartet');
        this.timerInterval = setInterval(() => {
            if (this.startTime) {
                const elapsed = Math.round((new Date() - this.startTime) / 1000);
                this.timerDisplay.textContent = this.formatDuration(elapsed);
            }
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            this.debug('Timer gestoppt');
        }
    }
    
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return hours.toString().padStart(2, '0') + ':' +
            minutes.toString().padStart(2, '0') + ':' +
            secs.toString().padStart(2, '0');
    }
    
    async saveSettings() {
        const settings = {
            notifications: this.notificationsToggle.checked,
            autoSubmit: this.autoSubmitToggle.checked,
            language: getCurrentLanguage()
        };
        
        await chrome.storage.local.set({ zammadSettings: settings });
        this.debug(t('settings_saved'));
    }
}

// Popup beim Laden initialisieren
document.addEventListener('DOMContentLoaded', () => {
    new TimetrackingPopup();
});