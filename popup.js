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

    // Time edit elements
    const timeSpentElement = document.getElementById('timeSpent');
    if (timeSpentElement) {
        timeSpentElement.title = t('edit_time');
    }

    // Save and cancel buttons in time edit form
    const saveTimeBtn = document.getElementById('saveTimeBtn');
    if (saveTimeBtn) {
        saveTimeBtn.textContent = t('api_save');
    }

    const cancelTimeBtn = document.getElementById('cancelTimeBtn');
    if (cancelTimeBtn) {
        cancelTimeBtn.textContent = t('api_cancel');
    }

    // Tag elements
    const tagsLabel = document.getElementById('tagsLabel');
    if (tagsLabel) {
        tagsLabel.textContent = t('tags');
    }

    const applyTagsBtn = document.getElementById('applyTagsBtn');
    if (applyTagsBtn) {
        applyTagsBtn.textContent = t('apply_tags');
    }

    const cancelTagsBtn = document.getElementById('cancelTagsBtn');
    if (cancelTagsBtn) {
        cancelTagsBtn.textContent = t('cancel_tags');
    }

    // API Settings
    document.getElementById('apiSettingsLabel').textContent = t('api_settings');
    document.getElementById('apiSettingsBtn').textContent = t('api_options');

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
        this.currentTicketTags = [];
        this.availableTags = [];

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

        // Time edit elements
        this.editTimeIcon = document.getElementById('editTimeIcon');
        this.timeEditForm = document.getElementById('timeEditForm');
        this.timeEditInput = document.getElementById('timeEditInput');
        this.saveTimeBtn = document.getElementById('saveTimeBtn');
        this.cancelTimeBtn = document.getElementById('cancelTimeBtn');

        // Tag elements
        this.ticketTagsContainer = document.getElementById('ticketTagsContainer');
        this.tagsLabel = document.getElementById('tagsLabel');
        this.showTagsBtn = document.getElementById('showTagsBtn');
        this.currentTags = document.getElementById('currentTags');
        this.tagSelector = document.getElementById('tagSelector');
        this.tagList = document.getElementById('tagList');
        this.applyTagsBtn = document.getElementById('applyTagsBtn');
        this.cancelTagsBtn = document.getElementById('cancelTagsBtn');

        // API Settings elements
        this.apiSettingsBtn = document.getElementById('apiSettingsBtn');

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

        // Time edit functionality
        this.timeSpent.addEventListener('click', () => {
            console.log('Time spent clicked');
            this.showTimeEditForm();
        });

        this.editTimeIcon.addEventListener('click', () => {
            console.log('Edit time icon clicked');
            this.showTimeEditForm();
        });

        this.saveTimeBtn.addEventListener('click', () => {
            console.log('Save time button clicked');
            this.saveEditedTime();
        });

        this.cancelTimeBtn.addEventListener('click', () => {
            console.log('Cancel time button clicked');
            this.hideTimeEditForm();
        });

        // Handle Enter key in time edit input
        this.timeEditInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                this.saveEditedTime();
            } else if (e.key === 'Escape') {
                this.hideTimeEditForm();
            }
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

        // API Settings - Open options page
        this.apiSettingsBtn.addEventListener('click', () => {
            console.log('API Settings button clicked - opening options page');
            chrome.runtime.openOptionsPage();
        });

        // Tag-related event listeners
        this.showTagsBtn.addEventListener('click', () => {
            console.log('Show tags button clicked');
            this.showTagSelector();
        });

        this.applyTagsBtn.addEventListener('click', () => {
            console.log('Apply tags button clicked');
            this.applySelectedTags();
        });

        this.cancelTagsBtn.addEventListener('click', () => {
            console.log('Cancel tags button clicked');
            this.hideTagSelector();
        });

        // Debug-Modus Toggle
        document.querySelector('.header').addEventListener('dblclick', () => {
            const computedStyle = window.getComputedStyle(this.debugInfo);
            const isVisible = computedStyle.display !== 'none';
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
            const result = await chrome.storage.local.get(['zammadTrackingState', 'zammadSettings', 'zammadApiSettings']);
            const state = result.zammadTrackingState;
            const settings = result.zammadSettings || {};
            const apiSettings = result.zammadApiSettings || {};

            this.debug('State loaded: ' + JSON.stringify(state));

            // Apply settings
            this.notificationsToggle.checked = settings.notifications !== false;
            this.autoSubmitToggle.checked = settings.autoSubmit !== false;

            // Initialize API if settings are available
            if (apiSettings.baseUrl && apiSettings.token) {
                this.debug('Initializing API with saved settings');
                zammadApi.init(apiSettings.baseUrl, apiSettings.token);
            }

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

                // Try to refresh ticket info from API if available
                if (zammadApi.isInitialized() && this.currentTicketId) {
                    this.loadTicketInfoFromApi(this.currentTicketId);
                }
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

                // If API is not initialized, try to extract base URL from tab URL
                if (!zammadApi.isInitialized()) {
                    const baseUrl = zammadApi.extractBaseUrlFromTabUrl(tab.url);
                    if (baseUrl) {
                        this.debug('Extracted base URL from tab: ' + baseUrl);

                        // Check if we have a token saved
                        const settings = await zammadApi.getSettings();
                        if (settings.token && !settings.baseUrl) {
                            // We have a token but no base URL, so save the extracted base URL
                            settings.baseUrl = baseUrl;
                            await zammadApi.saveSettings(settings);
                            zammadApi.init(baseUrl, settings.token);
                            this.debug('API initialized with extracted base URL and saved token');
                        } else if (!settings.token) {
                            this.debug('No API token found - please configure in options page');
                            this.infoText.textContent = t('api_not_configured');
                            this.infoText.className = 'info warning';
                        }
                    }
                }

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

                // If API is not initialized, show a hint
                if (!zammadApi.isInitialized()) {
                    this.debug('API not initialized - showing hint');
                    this.infoText.textContent = t('ready_for_tracking') + ' - ' + t('api_settings') + ' ' + t('api_edit');
                }
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

    async loadTicketInfoFromApi(ticketId) {
        try {
            if (!zammadApi.isInitialized()) {
                this.debug('API not initialized, cannot load ticket info');
                this.infoText.textContent = t('api_not_initialized');
                this.infoText.className = 'info warning';
                return false;
            }

            this.debug('Loading ticket information from API for ticket #' + ticketId);
            this.infoText.textContent = t('loading_ticket_info');
            this.infoText.className = 'info';

            // Get ticket information
            try {
                const ticketData = await zammadApi.getTicket(ticketId);
                this.debug('Ticket data received from API: ' + JSON.stringify(ticketData));

                if (ticketData) {
                    // Update ticket title
                    if (ticketData.title) {
                        this.ticketTitle.textContent = ticketData.title;
                        this.currentTicketTitle = ticketData.title;
                        this.debug('Ticket title from API: ' + ticketData.title);
                    } else {
                        this.debug('Ticket data received but no title found');
                    }

                    // Get time entries
                    try {
                        const timeEntries = await zammadApi.getTimeEntries(ticketId);
                        this.debug('Time entries received from API: ' + JSON.stringify(timeEntries));

                        if (timeEntries && Array.isArray(timeEntries)) {
                            // Calculate total time spent
                            const totalTimeSpent = timeEntries.reduce((total, entry) => {
                                return total + (parseFloat(entry.time_unit) || 0);
                            }, 0);

                            this.timeSpent.textContent = Math.round(totalTimeSpent);
                            this.currentTimeSpent = totalTimeSpent;
                            this.debug('Total time from API: ' + totalTimeSpent + ' min');
                        } else {
                            this.debug('No time entries found or invalid format');
                        }
                    } catch (timeError) {
                        this.debug('Error loading time entries: ' + timeError.message);
                        // Continue with ticket info even if time entries fail
                    }

                    // Get ticket tags if available in ticket data
                    if (ticketData.tags && Array.isArray(ticketData.tags)) {
                        this.currentTicketTags = ticketData.tags;
                        this.debug('Tags from ticket data: ' + JSON.stringify(this.currentTicketTags));
                        this.displayCurrentTags();
                    } else {
                        // If tags not in ticket data, try to fetch them separately
                        try {
                            // Try to get ticket-specific tags
                            this.debug('Fetching tags for ticket #' + ticketId);
                            try {
                                const ticketTags = await zammadApi.getTicketTags(ticketId);
                                if (ticketTags && Array.isArray(ticketTags)) {
                                    this.currentTicketTags = ticketTags;
                                    this.debug('Tags from getTicketTags: ' + JSON.stringify(this.currentTicketTags));
                                    this.displayCurrentTags();
                                } else {
                                    this.debug('No tags returned from getTicketTags or invalid format');
                                    this.currentTicketTags = [];
                                    this.displayCurrentTags();
                                }
                            } catch (ticketTagsError) {
                                this.debug('Error fetching ticket tags: ' + ticketTagsError.message);

                                // Fallback: Fetch available tags if needed
                                if (this.availableTags.length === 0) {
                                    await this.fetchAvailableTags();
                                }

                                // Display empty tags as we couldn't get ticket-specific tags
                                this.currentTicketTags = [];
                                this.displayCurrentTags();
                            }
                        } catch (tagsError) {
                            this.debug('Error loading tags: ' + tagsError.message);
                            // Continue with ticket info even if tags fail
                        }
                    }

                    // Show ticket info
                    this.ticketInfo.style.display = 'block';
                    this.infoText.textContent = t('ticket_loaded');
                    this.infoText.className = 'info success';
                    return true;
                } else {
                    this.debug('No ticket data received from API');
                    this.infoText.textContent = t('no_ticket_data');
                    this.infoText.className = 'info error';
                }
            } catch (ticketError) {
                this.debug('Error loading ticket: ' + ticketError.message);
                this.infoText.textContent = t('ticket_load_error') + ': ' + ticketError.message;
                this.infoText.className = 'info error';
                throw ticketError; // Re-throw to be caught by outer catch
            }

            return false;
        } catch (error) {
            this.debug('Error loading ticket info from API: ' + error.message);
            // Error message already set in inner catch
            return false;
        }
    }

    async loadTicketInfo(tab) {
        try {
            this.debug('Loading ticket information...');

            // First try to get ticket ID from URL or DOM
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getTicketInfo' });

            if (response && response.ticketId) {
                this.debug('Ticket ID received from content script: ' + response.ticketId);
                this.currentTicketId = response.ticketId;
                this.ticketId.textContent = '#' + response.ticketId;

                // Try to get ticket info from API first
                if (zammadApi.isInitialized()) {
                    const apiSuccess = await this.loadTicketInfoFromApi(response.ticketId);

                    if (apiSuccess) {
                        this.debug('Successfully loaded ticket info from API');
                        return;
                    }
                }

                // Fallback to content script data if API failed or not initialized
                this.debug('Using ticket info from content script');

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

                // Show ticket info
                this.ticketInfo.style.display = 'block';
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
            // let autoSubmitSuccess = await this.tryAutoSubmit(ticketId, durationMinutes);

            // UI feedback
            this.ticketInfo.style.display = 'none';
            // if (autoSubmitSuccess) {
                this.infoText.textContent = t('time_recorded') + ': ' + durationMinutes + ' ' + t('min');
                this.infoText.className = 'info success';
            // } else {
            //    this.infoText.textContent = t('manual_entry_required', [durationMinutes]);
            //    this.infoText.className = 'info error';
            //}

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

            // First try to submit via API if initialized
            if (zammadApi.isInitialized()) {
                try {
                    this.debug('Submitting time via API...');
                    // const comment = 'Time tracked via Zammad Timetracking Extension';
                    //
                    // const response = await zammadApi.submitTimeEntry(ticketId, durationMinutes, comment);
                    //
                    // if (response) {
                    //     this.debug('API time entry successful: ' + JSON.stringify(response));
                    //     return true;
                    // }
                } catch (apiError) {
                    this.debug('API time entry failed: ' + apiError.message);
                    // Continue to fallback method
                }
            }

            // Fallback to content script method
            this.debug('Falling back to content script method...');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'submitTime',
                duration: durationMinutes,
                ticketId: ticketId
            });

            if (response && response.success) {
                this.debug('Content script auto-submit successful');
                return true;
            } else {
                this.debug('Content script auto-submit failed');
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

    // API Settings are now managed in the options page

    /**
     * Show the time edit form
     */
    showTimeEditForm() {
        if (!this.currentTicketId) {
            this.debug('No active ticket, cannot edit time');
            return;
        }

        // Position the form near the time spent element
        const rect = this.timeSpent.getBoundingClientRect();
        this.timeEditForm.style.left = rect.left + 'px';
        this.timeEditForm.style.top = (rect.bottom + 5) + 'px';

        // Set the current value in the input
        this.timeEditInput.value = Math.round(this.currentTimeSpent);

        // Show the form
        this.timeEditForm.style.display = 'block';

        // Focus the input
        this.timeEditInput.focus();
        this.timeEditInput.select();

        this.debug('Time edit form shown');
    }

    /**
     * Hide the time edit form
     */
    hideTimeEditForm() {
        this.timeEditForm.style.display = 'none';
        this.debug('Time edit form hidden');
    }

    /**
     * Save the edited time
     */
    async saveEditedTime() {
        try {
            const newTimeValue = parseInt(this.timeEditInput.value, 10);

            if (isNaN(newTimeValue) || newTimeValue < 0) {
                this.debug('Invalid time value');
                this.infoText.textContent = t('invalid_time_value');
                this.infoText.className = 'info error';
                return;
            }

            this.debug(`Saving new time value: ${newTimeValue} min`);

            // Hide the form
            this.hideTimeEditForm();

            // Update the UI
            this.timeSpent.textContent = newTimeValue;
            this.currentTimeSpent = newTimeValue;

            // Submit the updated time to Zammad if API is initialized
            if (zammadApi.isInitialized() && this.currentTicketId) {
                this.infoText.textContent = t('updating_time');
                this.infoText.className = 'info';

                try {
                    // Submit the time entry with a comment indicating it's a correction
                    const comment = 'Korrektur der erfassten Zeit';
                    const response = await zammadApi.submitTimeEntry(this.currentTicketId, newTimeValue, comment);

                    if (response) {
                        this.debug('Time updated successfully');
                        this.infoText.textContent = t('time_updated');
                        this.infoText.className = 'info success';
                    } else {
                        throw new Error('No response from API');
                    }
                } catch (apiError) {
                    this.debug('Error updating time: ' + apiError.message);
                    this.infoText.textContent = t('time_update_error') + ': ' + apiError.message;
                    this.infoText.className = 'info error';
                }
            } else {
                this.debug('API not initialized, cannot update time');
                this.infoText.textContent = t('time_updated_locally');
                this.infoText.className = 'info warning';
            }
        } catch (error) {
            this.debug('Error saving time: ' + error.message);
            this.infoText.textContent = t('time_update_error') + ': ' + error.message;
            this.infoText.className = 'info error';
        }
    }

    /**
     * Fetch available tags from Zammad
     */
    async fetchAvailableTags() {
        try {
            if (!zammadApi.isInitialized()) {
                this.debug('API not initialized, cannot fetch tags');
                return false;
            }

            this.debug('Fetching available tags from Zammad');
            const tags = await zammadApi.getTags();

            if (tags && Array.isArray(tags)) {
                this.availableTags = tags;
                this.debug(`Fetched ${tags.length} tags from Zammad`);
                return true;
            } else {
                this.debug('No tags found or invalid format');
                return false;
            }
        } catch (error) {
            this.debug('Error fetching tags: ' + error.message);
            return false;
        }
    }

    /**
     * Display current ticket tags
     */
    displayCurrentTags() {
        this.currentTags.innerHTML = '';

        if (!this.currentTicketTags || this.currentTicketTags.length === 0) {
            this.debug('No tags to display');
            return;
        }

        this.debug(`Displaying ${this.currentTicketTags.length} tags`);

        this.currentTicketTags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-item';
            tagElement.innerHTML = `
                ${tag}
                <span class="tag-remove" data-tag="${tag}">×</span>
            `;

            // Add event listener to remove tag
            const removeBtn = tagElement.querySelector('.tag-remove');
            removeBtn.addEventListener('click', (e) => {
                const tagToRemove = e.target.getAttribute('data-tag');
                this.debug(`Removing tag: ${tagToRemove}`);
                this.currentTicketTags = this.currentTicketTags.filter(t => t !== tagToRemove);
                this.displayCurrentTags();
                this.updateTicketTags();
            });

            this.currentTags.appendChild(tagElement);
        });
    }

    /**
     * Show tag selector
     */
    async showTagSelector() {
        if (!this.currentTicketId) {
            this.debug('No active ticket, cannot show tag selector');
            return;
        }

        this.debug('Showing tag selector');

        // Fetch available tags if needed
        if (this.availableTags.length === 0) {
            this.infoText.textContent = t('fetching_tags');
            this.infoText.className = 'info';

            const success = await this.fetchAvailableTags();
            if (!success) {
                this.infoText.textContent = t('tags_fetch_error');
                this.infoText.className = 'info error';
                return;
            }
        }

        // Check if we have any tags to display
        if (this.availableTags.length === 0) {
            this.debug('No available tags to display');
            this.infoText.textContent = t('no_tags_available');
            this.infoText.className = 'info warning';
            return;
        }

        // Clear and populate tag list
        this.tagList.innerHTML = '';

        this.availableTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;

            // Pre-select if tag is already assigned
            if (this.currentTicketTags.includes(tag)) {
                option.selected = true;
            }

            this.tagList.appendChild(option);
        });

        // Show the tag selector
        this.tagSelector.style.display = 'block';
        this.showTagsBtn.textContent = '-';
    }

    /**
     * Hide tag selector
     */
    hideTagSelector() {
        this.debug('Hiding tag selector');
        this.tagSelector.style.display = 'none';
        this.showTagsBtn.textContent = '+';
    }

    /**
     * Apply selected tags to the current ticket
     */
    async applySelectedTags() {
        if (!this.currentTicketId) {
            this.debug('No active ticket, cannot apply tags');
            return;
        }

        try {
            // Get selected tags
            const selectedTags = Array.from(this.tagList.selectedOptions).map(option => option.value);
            this.debug(`Applying ${selectedTags.length} tags to ticket #${this.currentTicketId}`);

            // Update current tags
            this.currentTicketTags = selectedTags;

            // Hide selector
            this.hideTagSelector();

            // Display updated tags
            this.displayCurrentTags();

            // Update tags in Zammad
            await this.updateTicketTags();

        } catch (error) {
            this.debug('Error applying tags: ' + error.message);
            this.infoText.textContent = t('tags_update_error') + ': ' + error.message;
            this.infoText.className = 'info error';
        }
    }

    /**
     * Update ticket tags in Zammad
     */
    async updateTicketTags() {
        if (!this.currentTicketId || !zammadApi.isInitialized()) {
            this.debug('Cannot update tags: No ticket ID or API not initialized');
            return false;
        }

        try {
            this.debug(`Updating tags for ticket #${this.currentTicketId}`);
            this.infoText.textContent = t('updating_tags');
            this.infoText.className = 'info';

            const response = await zammadApi.assignTagsToTicket(this.currentTicketId, this.currentTicketTags);

            if (response) {
                this.debug('Tags updated successfully');
                this.infoText.textContent = t('tags_updated');
                this.infoText.className = 'info success';
                return true;
            } else {
                throw new Error('No response from API');
            }
        } catch (error) {
            this.debug('Error updating tags: ' + error.message);
            this.infoText.textContent = t('tags_update_error') + ': ' + error.message;
            this.infoText.className = 'info error';
            return false;
        }
    }
}

// Popup beim Laden initialisieren
document.addEventListener('DOMContentLoaded', () => {
    new TimetrackingPopup();
});
