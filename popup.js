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
        console.log('Popup is being initialized...');

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
        console.log('Initializing UI elements...');

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

        console.log('UI elements initialized');
    }

    initEventListeners() {
        console.log('Setting up event listeners...');

        this.startBtn.addEventListener('click', () => {
            console.log('Start button clicked');
            this.startTracking();
        });

        this.stopBtn.addEventListener('click', () => {
            console.log('Stop button clicked');
            this.stopTracking();
        });

        this.notificationsToggle.addEventListener('change', () => {
            console.log('Notifications changed:', this.notificationsToggle.checked);
            this.saveSettings();
        });

        this.autoSubmitToggle.addEventListener('change', () => {
            console.log('Auto-Submit changed:', this.autoSubmitToggle.checked);
            this.saveSettings();
        });

        // Language selector
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            const newLang = e.target.value;
            console.log('Language changed:', newLang);
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
                this.debug('Debug mode activated');
            }
        });

        console.log('Event listeners set up');
    }

    debug(message) {
        const timestamp = new Date().toLocaleTimeString();
        console.log('[Popup Debug]', timestamp, message);
        this.debugInfo.textContent = timestamp + ': ' + message;
    }

    async loadState() {
        this.debug('Loading saved state...');

        try {
            const result = await chrome.storage.local.get(['zammadTrackingState', 'zammadSettings']);
            const state = result.zammadTrackingState;
            const settings = result.zammadSettings || {};

            this.debug('State loaded: ' + JSON.stringify(state));

            // Apply settings
            this.notificationsToggle.checked = settings.notifications !== false;
            this.autoSubmitToggle.checked = settings.autoSubmit !== false;

            // Restore active tracking
            if (state && state.isTracking && state.startTime) {
                this.debug('Active tracking found - restoring');

                this.isTracking = true;
                this.startTime = new Date(state.startTime);
                this.currentTicketId = state.ticketId;
                this.currentTicketTitle = state.title;
                this.currentTimeSpent = state.timeSpent || 0;

                this.updateUI();
                this.startTimer();

                this.ticketId.textContent = '#' + state.ticketId;

                // Display ticket information
                if (state.title) {
                    this.ticketTitle.textContent = state.title;
                } else {
                    this.ticketTitle.textContent = t('title_not_available');
                }

                this.timeSpent.textContent = Math.round(state.timeSpent || 0);
                this.ticketInfo.style.display = 'block';
                this.infoText.textContent = t('tracking_running');
                this.infoText.className = 'info success';

                this.debug('Tracking restored for ticket: ' + state.ticketId);
            } else {
                this.debug('No active tracking - checking page');
                await this.checkCurrentPage();
            }

        } catch (error) {
            this.debug('Error loading: ' + error.message);
            console.error('Error loading state:', error);
            await this.checkCurrentPage();
        }
    }

    async checkCurrentPage() {
        this.debug('Checking current page...');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.debug('URL: ' + tab.url);

            if (this.isZammadUrl(tab.url)) {
                this.debug('Zammad page detected - loading ticket information');

                // Inject content script
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    this.debug('Content script injected');
                } catch (e) {
                    this.debug('Content script already exists: ' + e.message);
                }

                // Short wait
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Load ticket information
                await this.loadTicketInfo(tab);

                this.infoText.textContent = t('ready_for_tracking');
                this.infoText.className = 'info';
                this.startBtn.disabled = false;
            } else {
                this.debug('Not a Zammad page');
                this.infoText.textContent = t('open_ticket');
                this.infoText.className = 'info';
                this.startBtn.disabled = true;
            }
        } catch (error) {
            this.debug('Error checking page: ' + error.message);
            this.infoText.textContent = t('page_check_error');
            this.infoText.className = 'info error';
        }
    }

    async loadTicketInfo(tab) {
        try {
            this.debug('Loading ticket information...');

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getTicketInfo' });

            if (response) {
                this.debug('Ticket info received: ' + JSON.stringify(response));

                if (response.ticketId) {
                    this.ticketId.textContent = '#' + response.ticketId;
                    this.currentTicketId = response.ticketId;
                }

                if (response.title) {
                    this.ticketTitle.textContent = response.title;
                    this.currentTicketTitle = response.title;
                    this.debug('Ticket title: ' + response.title);
                } else {
                    this.ticketTitle.textContent = t('title_not_available');
                }

                if (response.timeSpent !== undefined && response.timeSpent > 0) {
                    this.timeSpent.textContent = Math.round(response.timeSpent);
                    this.currentTimeSpent = response.timeSpent;
                    this.debug('Time already recorded: ' + response.timeSpent + ' min');
                } else {
                    this.timeSpent.textContent = '0';
                    this.currentTimeSpent = 0;
                }

                // Show ticket info if data is available
                if (response.ticketId || response.title) {
                    this.ticketInfo.style.display = 'block';
                }

            } else {
                this.debug('No ticket info received from content script');
            }
        } catch (error) {
            this.debug('Error loading ticket info: ' + error.message);
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
            this.debug('Starting time tracking...');

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.debug('Tab URL: ' + tab.url);

            if (!this.isZammadUrl(tab.url)) {
                this.infoText.textContent = t('open_ticket');
                this.infoText.className = 'info error';
                this.debug('Not a Zammad URL');
                return;
            }

            this.startBtn.disabled = true;
            this.infoText.textContent = t('starting_tracking');
            this.infoText.className = 'info';

            // Inject content script
            this.debug('Injecting content script...');
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                this.debug('Content script injected');
            } catch (e) {
                this.debug('Content script error: ' + e.message);
            }

            // Wait for content script
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Try to find ticket ID and info
            let ticketId = await this.getTicketInfo(tab);

            if (!ticketId) {
                this.debug('No ticket ID - using fallback');
                ticketId = 'fallback-' + Date.now();
            }

            // Notify content script to start tracking
            try {
                const trackingResponse = await chrome.tabs.sendMessage(tab.id, {
                    action: 'startTracking'
                });

                if (!trackingResponse || !trackingResponse.success) {
                    this.debug('Content script could not start tracking');
                } else {
                    this.debug('Content script has started tracking');
                }
            } catch (error) {
                this.debug('Error starting tracking in content script: ' + error.message);
            }

            // Start tracking
            this.debug('Starting timer for ticket: ' + ticketId);
            this.isTracking = true;
            this.startTime = new Date();
            this.currentTicketId = ticketId;

            // Save state (with extended information)
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

            // Update UI
            this.updateUI();
            this.startTimer();

            this.ticketId.textContent = '#' + ticketId;

            // Display ticket title and already recorded time
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

            // Notify background script
            try {
                chrome.runtime.sendMessage({
                    action: 'trackingStarted',
                    data: { ticketId: ticketId, startTime: this.startTime.toISOString() }
                });
                this.debug('Background script notified');
            } catch (error) {
                this.debug('Background script error: ' + error.message);
            }

            this.debug('Time tracking successfully started');

            // Close popup
            setTimeout(() => window.close(), 2000);

        } catch (error) {
            this.debug('Critical error: ' + error.message);
            console.error('Start error:', error);
            this.infoText.textContent = 'Error: ' + error.message;
            this.infoText.className = 'info error';
            this.startBtn.disabled = false;
        }
    }

    async getTicketInfo(tab) {
        // Try multiple strategies

        // 1. Ask content script - extended ticket info
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                this.debug('Content script attempt ' + attempt);
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'getTicketInfo' });
                if (response && response.ticketId) {
                    this.debug('Ticket info from content script: ' + JSON.stringify(response));

                    // Save ticket information in popup
                    this.currentTicketTitle = response.title;
                    this.currentTimeSpent = response.timeSpent || 0;

                    return response.ticketId;
                }
            } catch (error) {
                this.debug('Content script attempt ' + attempt + ' failed');
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // 2. Try URL pattern
        this.debug('Trying URL parsing...');
        const urlPatterns = [
            /\/ticket\/zoom\/(\d+)/,
            /\/ticket.*?\/(\d+)/,
            /ticket.*?(\d+)/,
            /#.*?(\d+)/
        ];

        for (const pattern of urlPatterns) {
            const match = tab.url.match(pattern);
            if (match && match[1]) {
                this.debug('Ticket ID from URL: ' + match[1]);
                return match[1];
            }
        }

        this.debug('No ticket ID found');
        return null;
    }

    async stopTracking() {
        try {
            this.debug('Stopping time tracking...');

            if (!this.isTracking || !this.startTime) {
                this.debug('No active time tracking');
                this.infoText.textContent = t('no_active_tracking');
                this.infoText.className = 'info error';
                return;
            }

            // Calculate time
            const endTime = new Date();
            const duration = Math.round((endTime - this.startTime) / 1000);
            const durationMinutes = Math.round(duration / 60);
            const durationText = this.formatDuration(duration);

            this.debug('Duration: ' + durationText + ' (' + durationMinutes + ' min)');

            // Reset status
            this.isTracking = false;
            const ticketId = this.currentTicketId;
            const ticketTitle = this.currentTicketTitle;

            // Update UI
            this.updateUI();
            this.stopTimer();

            // Notify content script to stop tracking
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const stopResponse = await chrome.tabs.sendMessage(tab.id, {
                    action: 'stopTracking'
                });

                if (!stopResponse || !stopResponse.success) {
                    this.debug('Content script could not stop tracking');
                } else {
                    this.debug('Content script has stopped tracking');
                }
            } catch (error) {
                this.debug('Error stopping tracking in content script: ' + error.message);
            }

            // Delete storage
            await chrome.storage.local.remove(['zammadTrackingState']);
            this.debug('Status deleted');

            // Try auto-submit
            let autoSubmitSuccess = await this.tryAutoSubmit(ticketId, durationMinutes);

            // UI feedback
            this.ticketInfo.style.display = 'none';
            if (autoSubmitSuccess) {
                this.infoText.textContent = t('time_recorded') + ': ' + durationMinutes + ' ' + t('min');
                this.infoText.className = 'info success';
            } else {
                this.infoText.textContent = t('manual_entry_required', [durationMinutes]);
                this.infoText.className = 'info error';
            }

            // Notify background script
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
                this.debug('Background script error: ' + error.message);
            }

            this.debug('Time tracking successfully ended');

            // Reset local variables
            this.currentTicketId = null;
            this.currentTicketTitle = null;
            this.currentTimeSpent = 0;

            // Close popup
            setTimeout(() => window.close(), 3000);

        } catch (error) {
            this.debug('Stop error: ' + error.message);
            console.error('Stop error:', error);
            this.infoText.textContent = t('stop_error') + ': ' + error.message;
            this.infoText.className = 'info error';
        }
    }

    async tryAutoSubmit(ticketId, durationMinutes) {
        try {
            this.debug('Trying automatic entry...');

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'submitTime',
                duration: durationMinutes,
                ticketId: ticketId
            });

            if (response && response.success) {
                this.debug('Auto-submit successful');
                return true;
            } else {
                this.debug('Auto-submit failed');
                return false;
            }
        } catch (error) {
            this.debug('Auto-submit error: ' + error.message);
            return false;
        }
    }

    updateUI() {
        if (this.isTracking) {
            this.statusDot.className = 'status-dot active';
            this.statusText.textContent = 'Active';
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
        } else {
            this.statusDot.className = 'status-dot inactive';
            this.statusText.textContent = 'Not active';
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.timerDisplay.textContent = '00:00:00';
        }
    }

    startTimer() {
        this.debug('Timer started');
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
            this.debug('Timer stopped');
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
