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

    // API Settings
    document.getElementById('apiSettingsLabel').textContent = t('api_settings');
    document.getElementById('apiSettingsBtn').textContent = t('api_options');

    // Tab labels
    document.getElementById('tab-current').textContent = t('tab_current');
    document.getElementById('tab-tickets').textContent = t('tab_tickets');
    document.getElementById('tab-history').textContent = t('tab_history');

    // Info messages for tabs
    document.getElementById('ticketsInfo').textContent = t('loading_tickets');
    document.getElementById('historyInfo').textContent = t('loading_history');

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

        // For assigned tickets tab
        this.assignedTickets = [];
        this.isLoadingTickets = false;

        // For history tab
        this.timeHistory = [];
        this.isLoadingHistory = false;

        this.initElements();
        this.initEventListeners();
        this.loadState();

        // Update UI language
        updateUILanguage();

        // Initialize tabs
        this.initTabs();
    }

    initElements() {
        console.log('Initializing UI elements...');

        // Current tab elements
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

        // Tab elements
        this.tabs = document.querySelectorAll('.tab');
        this.tabContents = document.querySelectorAll('.tab-content');

        // Tickets tab elements
        this.ticketList = document.getElementById('ticketList');
        this.ticketsLoading = document.getElementById('ticketsLoading');
        this.ticketsInfo = document.getElementById('ticketsInfo');

        // History tab elements
        this.historyList = document.getElementById('historyList');
        this.historyLoading = document.getElementById('historyLoading');
        this.historyInfo = document.getElementById('historyInfo');

        // Settings elements
        this.notificationsToggle = document.getElementById('notificationsToggle');
        this.autoSubmitToggle = document.getElementById('autoSubmitToggle');
        this.debugInfo = document.getElementById('debugInfo');

        // Time edit elements
        this.editTimeIcon = document.getElementById('editTimeIcon');
        this.timeEditForm = document.getElementById('timeEditForm');
        this.timeEditInput = document.getElementById('timeEditInput');
        this.saveTimeBtn = document.getElementById('saveTimeBtn');
        this.cancelTimeBtn = document.getElementById('cancelTimeBtn');

        // API Settings elements
        this.apiSettingsBtn = document.getElementById('apiSettingsBtn');

        console.log('UI elements initialized');
    }

    /**
     * Initialize tabs functionality
     */
    initTabs() {
        this.debug('Initializing tabs...');

        // Add click event listeners to tabs
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });

        // Load content for tickets and history tabs
        this.loadTabContent('tickets');
        this.loadTabContent('history');
    }

    /**
     * Switch to a specific tab
     * @param {string} tabId - The ID of the tab to switch to
     */
    switchTab(tabId) {
        this.debug('Switching to tab: ' + tabId);

        // Update active tab
        this.tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update active content
        this.tabContents.forEach(content => {
            if (content.id === 'content-' + tabId) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Load content for the selected tab if needed
        this.loadTabContent(tabId);
    }

    /**
     * Load content for a specific tab
     * @param {string} tabId - The ID of the tab to load content for
     */
    loadTabContent(tabId) {
        this.debug('Loading content for tab: ' + tabId);

        switch (tabId) {
            case 'tickets':
                this.loadAssignedTickets();
                break;
            case 'history':
                this.loadTimeHistory();
                break;
        }
    }

    /**
     * Load assigned tickets from the API
     */
    async loadAssignedTickets() {
        // Skip if already loading
        if (this.isLoadingTickets) {
            return;
        }

        // Check API initialization and validation
        if (!zammadApi.isInitialized()) {
            if (zammadApi.isInitializedButNotValidated()) {
                this.ticketsInfo.textContent = t('api_token_validation_pending');
                this.ticketsInfo.className = 'info warning';
            } else {
                this.ticketsInfo.textContent = t('api_not_initialized');
                this.ticketsInfo.className = 'info warning';
            }
            this.ticketsLoading.style.display = 'none';
            return;
        }

        this.isLoadingTickets = true;
        this.ticketsLoading.style.display = 'flex';
        this.ticketsInfo.textContent = t('loading_tickets');
        this.ticketsInfo.className = 'info';

        try {
            this.debug('Fetching assigned tickets from API...');
            const tickets = await zammadApi.getAssignedTickets();
            this.debug('Received ' + (tickets ? tickets.length : 0) + ' tickets from API');

            // Store tickets
            this.assignedTickets = Array.isArray(tickets) ? tickets : [];

            // Display tickets
            this.displayAssignedTickets();

            // Update info text
            if (this.assignedTickets.length === 0) {
                this.ticketsInfo.textContent = t('no_tickets_found');
                this.ticketsInfo.className = 'info warning';
            } else {
                // Get count of non-closed tickets
                const nonClosedCount = this.assignedTickets.filter(ticket => {
                    // Get state_id from ticket
                    const stateId = ticket.state_id;

                    // Exclude tickets with state_id 2 (closed successful) and 3 (closed unsuccessful)
                    return stateId != 2 && stateId != 3;
                }).length;

                this.ticketsInfo.textContent = t('tickets_loaded', [nonClosedCount]) + ' (' + t('non_closed_only') + ')';
                this.ticketsInfo.className = 'info success';
            }
        } catch (error) {
            this.debug('Error loading assigned tickets: ' + error.message);

            // Check if it's an authentication error
            if (error.message.includes('401') || error.message.includes('403') || error.message.includes('unauthorized')) {
                this.ticketsInfo.textContent = t('api_token_invalid');
                this.ticketsInfo.className = 'info error';
                // Mark API as not validated
                zammadApi.validated = false;
            } else {
                this.ticketsInfo.textContent = t('error_loading_tickets') + ': ' + error.message;
                this.ticketsInfo.className = 'info error';
            }

            // Show empty state
            this.ticketList.innerHTML = `
                <div class="empty-state">
                    ${t('error_loading_tickets')}
                </div>
            `;
        } finally {
            this.isLoadingTickets = false;
            this.ticketsLoading.style.display = 'none';
        }
    }
    /**
     * Display assigned tickets in the UI
     */
    displayAssignedTickets() {
        this.debug('Displaying assigned tickets...');

        // Clear ticket list
        this.ticketList.innerHTML = '';

        // Filter out closed tickets
        const nonClosedTickets = this.assignedTickets.filter(ticket => {
            // Get state_id from ticket
            const stateId = ticket.state_id;

            // Exclude tickets with state_id 2 (closed successful) and 3 (closed unsuccessful)
            return stateId != 2 && stateId != 3;
        });

        this.debug(`Filtered ${this.assignedTickets.length} tickets to ${nonClosedTickets.length} non-closed tickets`);

        // If no tickets, show empty state
        if (nonClosedTickets.length === 0) {
            this.ticketList.innerHTML = `
                <div class="empty-state">
                    ${t('no_tickets_found')}
                </div>
            `;
            return;
        }

        // Create ticket items
        nonClosedTickets.forEach(ticket => {
            // Extract ticket data
            const ticketId = ticket.id || ticket.number || '';
            const ticketTitle = ticket.title || t('title_not_available');
            const ticketState = ticket.state || ticket.state_id || '';

            // Create ticket item element
            const ticketItem = document.createElement('div');
            ticketItem.className = 'ticket-item';
            ticketItem.setAttribute('data-ticket-id', ticketId);

            // Determine state class for styling
            const stateStr = String(ticketState).toLowerCase();
            let stateClass = 'state-default';

            if (stateStr.includes('new') || stateStr.includes('open')) {
                stateClass = 'state-new';
            } else if (stateStr.includes('in progress') || stateStr.includes('pending')) {
                stateClass = 'state-progress';
            } else if (stateStr.includes('wait')) {
                stateClass = 'state-waiting';
            }

            // Add ticket content
            ticketItem.innerHTML = `
                <div class="ticket-item-title">${ticketTitle}</div>
                <div class="ticket-item-details">
                    <span class="ticket-item-id">#${ticketId}</span>
                    <span class="ticket-item-state ${stateClass}">${ticketState}</span>
                </div>
            `;

            // Add click event to show ticket info without starting tracking
            ticketItem.addEventListener('click', () => {
                this.showTicketInfo(ticketId, ticketTitle);
            });

            // Add to ticket list
            this.ticketList.appendChild(ticketItem);
        });
    }

    /**
     * Show ticket info without starting tracking
     * @param {string|number} ticketId - The ticket ID
     * @param {string} ticketTitle - The ticket title
     */
    async showTicketInfo(ticketId, ticketTitle) {
        this.debug(`Showing info for ticket #${ticketId} (${ticketTitle})`);

        // Set current ticket info
        this.currentTicketId = ticketId;
        this.currentTicketTitle = ticketTitle;

        // Update UI
        this.ticketId.textContent = '#' + ticketId;
        this.ticketTitle.textContent = ticketTitle;
        this.ticketInfo.style.display = 'block';

        // If API is initialized, try to load ticket info from API
        if (zammadApi.isInitialized()) {
            await this.loadTicketInfoFromApi(ticketId);
        }

        // Switch to current tab
        this.switchTab('current');

        this.infoText.textContent = t('ready_for_tracking');
        this.infoText.className = 'info';
    }

    /**
     * Start tracking for a specific ticket
     * @param {string|number} ticketId - The ticket ID
     * @param {string} ticketTitle - The ticket title
     */
    async startTrackingForTicket(ticketId, ticketTitle) {
        this.debug(`Starting tracking for ticket #${ticketId} (${ticketTitle})`);

        // If already tracking, ask for confirmation
        if (this.isTracking) {
            if (!confirm(t('confirm_switch_ticket'))) {
                return;
            }

            // Stop current tracking
            await this.stopTracking();
        }

        // Show ticket info first
        await this.showTicketInfo(ticketId, ticketTitle);

        // Start tracking
        this.startTracking();
    }

    /**
     * Load time tracking history from the API
     */
    async loadTimeHistory() {
        // Skip if already loading
        if (this.isLoadingHistory) {
            return;
        }

        // Check API initialization and validation
        if (!zammadApi.isInitialized()) {
            if (zammadApi.isInitializedButNotValidated()) {
                this.historyInfo.textContent = t('api_token_validation_pending');
                this.historyInfo.className = 'info warning';
            } else {
                this.historyInfo.textContent = t('api_not_initialized');
                this.historyInfo.className = 'info warning';
            }
            this.historyLoading.style.display = 'none';
            return;
        }

        this.isLoadingHistory = true;
        this.historyLoading.style.display = 'flex';
        this.historyInfo.textContent = t('loading_history');
        this.historyInfo.className = 'info';

        try {
            this.debug('Fetching time history from API...');
            const history = await zammadApi.getTimeHistory();
            this.debug('Received ' + (history ? history.length : 0) + ' time entries from API');

            // Store history
            this.timeHistory = Array.isArray(history) ? history : [];

            // Display history
            this.displayTimeHistory();

            // Update info text
            if (this.timeHistory.length === 0) {
                this.historyInfo.textContent = t('no_history_found');
                this.historyInfo.className = 'info warning';
            } else {
                this.historyInfo.textContent = t('history_loaded', [this.timeHistory.length]);
                this.historyInfo.className = 'info success';
            }
        } catch (error) {
            this.debug('Error loading time history: ' + error.message);

            // Check if it's an authentication error
            if (error.message.includes('401') || error.message.includes('403') || error.message.includes('unauthorized')) {
                this.historyInfo.textContent = t('api_token_invalid');
                this.historyInfo.className = 'info error';
                // Mark API as not validated
                zammadApi.validated = false;
            } else {
                this.historyInfo.textContent = t('error_loading_history') + ': ' + error.message;
                this.historyInfo.className = 'info error';
            }

            // Show empty state
            this.historyList.innerHTML = `
                <div class="empty-state">
                    ${t('error_loading_history')}
                </div>
            `;
        } finally {
            this.isLoadingHistory = false;
            this.historyLoading.style.display = 'none';
        }
    }
    /**
     * Display time tracking history in the UI
     */
    displayTimeHistory() {
        this.debug('Displaying time history...');

        // Clear history list
        this.historyList.innerHTML = '';

        // If no history, show empty state
        if (this.timeHistory.length === 0) {
            this.historyList.innerHTML = `
            <div class="empty-state">
                ${t('no_history_found')}
            </div>
        `;
            return;
        }

        // Calculate total time
        const totalTime = this.timeHistory.reduce((total, entry) => {
            return total + (parseFloat(entry.time_unit) || 0);
        }, 0);

        // Add total time at the top
        const totalTimeItem = document.createElement('div');
        totalTimeItem.className = 'history-item total-time';
        totalTimeItem.innerHTML = `
        <div class="history-item-title">${t('total_time')}</div>
        <div class="history-item-details">
            <span class="history-item-time">${Math.round(totalTime)} ${t('min')}</span>
        </div>
    `;
        this.historyList.appendChild(totalTimeItem);

        // Create history items
        this.timeHistory.forEach(entry => {
            // Extract entry data
            const entryId = entry.id;
            const ticketId = entry.ticket_id || '';
            const timeUnit = parseFloat(entry.time_unit) || 0;
            const comment = entry.comment || '';
            const createdAt = entry.created_at ? new Date(entry.created_at) : new Date();

            // Format date
            const dateStr = createdAt.toLocaleDateString();
            const timeStr = createdAt.toLocaleTimeString();

            // Create history item element
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.setAttribute('data-entry-id', entryId);

            // Add history content with delete button
            historyItem.innerHTML = `
            <div class="history-item-content" ${ticketId ? `data-ticket-id="${ticketId}"` : ''}>
                <div class="history-item-title">
                    ${comment || t('time_entry_for_ticket', ['#' + ticketId])}
                </div>
                <div class="history-item-details">
                    <span class="history-item-time">${Math.round(timeUnit)} ${t('min')}</span>
                    <span class="history-item-date">${dateStr} ${timeStr}</span>
                </div>
            </div>
            <div class="history-item-actions">
                <button class="delete-btn" title="${t('delete_entry')}" data-entry-id="${entryId}">
                    <span class="delete-icon">✕</span>
                </button>
            </div>
        `;

            // Add click event to history content (not the delete button)
            const contentElement = historyItem.querySelector('.history-item-content');
            if (ticketId && contentElement) {
                contentElement.addEventListener('click', () => {
                    const title = comment || t('time_entry_for_ticket', ['#' + ticketId]);
                    this.showTicketInfo(ticketId, title);
                });
            }

            // Add click event to delete button
            const deleteBtn = historyItem.querySelector('.delete-btn');
            if (deleteBtn && entryId) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the content click
                    this.confirmDeleteTimeEntry(entryId, timeUnit, ticketId);
                });
            }

            // Add to history list
            this.historyList.appendChild(historyItem);
        });
    }

    /**
     * Confirm and delete a time entry
     */
    async confirmDeleteTimeEntry(entryId, timeUnit, ticketId) {
        this.debug(`Confirming deletion of time entry ${entryId} (${timeUnit} min)`);

        // Show confirmation dialog
        const confirmMessage = t('confirm_delete_entry', [Math.round(timeUnit), ticketId ? `#${ticketId}` : '']);
        if (!confirm(confirmMessage)) {
            return;
        }

        // Show loading state
        this.historyInfo.textContent = t('deleting_entry');
        this.historyInfo.className = 'info';

        try {
            // Check if API is available and initialized
            if (!zammadApi || !zammadApi.isInitialized()) {
                throw new Error('API not initialized. Please check your settings.');
            }

            this.debug(`Calling API to delete time entry ${entryId}`);

            // Delete the entry via API
            const result = await zammadApi.deleteTimeEntry(entryId);

            this.debug(`Successfully deleted time entry ${entryId}`, result);

            // Show success message
            this.historyInfo.textContent = t('entry_deleted');
            this.historyInfo.className = 'info success';

            // Reload history to update the display
            setTimeout(() => {
                this.loadTimeHistory();
            }, 1000);

            // If this was for the current ticket, update the time display
            if (ticketId === this.currentTicketId) {
                this.loadTicketInfoFromApi(this.currentTicketId);
            }

        } catch (error) {
            console.error(`Error deleting time entry ${entryId}:`, error);
            this.debug(`Error deleting time entry: ${error.message}`);

            // Show more specific error messages
            let errorMessage = t('delete_entry_error') + ': ';

            if (error.message.includes('Permission denied') || error.message.includes('403')) {
                errorMessage += 'You don\'t have permission to delete time entries. Contact your administrator.';
            } else if (error.message.includes('404') || error.message.includes('not found')) {
                errorMessage += 'Time entry not found or already deleted.';
            } else if (error.message.includes('API not initialized')) {
                errorMessage += 'Please configure your API settings first.';
            } else {
                errorMessage += error.message;
            }

            this.historyInfo.textContent = errorMessage;
            this.historyInfo.className = 'info error';
        }
    }
    async refreshApi() {
        if (window.zammadApi) {
            await window.zammadApi.forceRefreshSettings();
            console.log('API refreshed with new token');

            // Show user feedback
            this.showMessage('API refreshed with new settings', 'success');

            // Reload the current state to use new API settings
            await this.loadState();
        } else {
            console.log('No API instance available to refresh');
            this.showMessage('No API instance found to refresh', 'warning');
        }
    }

    showMessage(message, type = 'info') {
        if (this.infoText) {
            this.infoText.textContent = message;
            this.infoText.className = `info ${type}`;

            // Clear message after 3 seconds
            setTimeout(() => {
                this.infoText.textContent = '';
                this.infoText.className = 'info';
            }, 3000);
        }
    }


    initEventListeners() {
        console.log('Setting up event listeners...');

        this.startBtn.addEventListener('click', () => {
            console.log('Start button clicked');
            // Immediately disable button to prevent double-clicking
            this.startBtn.disabled = true;
            // Ensure the action is processed even if popup closes quickly
            setTimeout(() => this.startTracking(), 0);
        });

        this.stopBtn.addEventListener('click', () => {
            console.log('Stop button clicked');
            // Immediately disable button to prevent double-clicking
            this.stopBtn.disabled = true;
            // Ensure the action is processed even if popup closes quickly
            setTimeout(() => this.stopTracking(), 0);
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

            // Store the last tracked ticket ID if available
            let lastTicketId = null;
            if (state && state.ticketId) {
                lastTicketId = state.ticketId;
                this.debug('Last tracked ticket ID: ' + lastTicketId);
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

                // If we have a last tracked ticket ID and API is initialized, try to refresh its info
                // This ensures we show the latest time data even when not actively tracking
                if (lastTicketId && zammadApi.isInitialized()) {
                    this.debug('Refreshing info for last tracked ticket: ' + lastTicketId);
                    this.currentTicketId = lastTicketId;
                    this.ticketId.textContent = '#' + lastTicketId;
                    await this.loadTicketInfoFromApi(lastTicketId);
                    this.ticketInfo.style.display = 'block';
                }

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

            // Immediately disable button to prevent double-clicking
            this.startBtn.disabled = true;
            this.infoText.textContent = t('starting_tracking');
            this.infoText.className = 'info';

            // Initialize tracking state early
            this.isTracking = true;
            this.startTime = new Date();

            // Save initial state to storage immediately
            try {
                await chrome.storage.local.set({
                    zammadTrackingState: {
                        isTracking: true,
                        startTime: this.startTime.toISOString(),
                        // We'll update with more details later
                        ticketId: 'initializing',
                        title: null,
                        timeSpent: 0
                    }
                });
                this.debug('Initial tracking state saved');
            } catch (storageError) {
                this.debug('Error saving initial state: ' + storageError.message);
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.debug('Tab URL: ' + tab.url);

            if (!this.isZammadUrl(tab.url)) {
                this.infoText.textContent = t('open_ticket');
                this.infoText.className = 'info error';
                this.debug('Not a Zammad URL');
                this.isTracking = false; // Reset tracking state
                this.startBtn.disabled = false; // Re-enable button
                return;
            }

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

            // Close popup after a delay to ensure all operations complete
            // Using a longer timeout to ensure tracking is registered even if user moves away quickly
            setTimeout(() => window.close(), 5000);

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
                this.stopBtn.disabled = false; // Re-enable button
                return;
            }

            // Calculate time
            const endTime = new Date();
            const duration = Math.round((endTime - this.startTime) / 1000);
            const durationMinutes = Math.round(duration / 60);
            const durationText = this.formatDuration(duration);

            this.debug('Duration: ' + durationText + ' (' + durationMinutes + ' min)');

            // Store ticket info before resetting
            const ticketId = this.currentTicketId;
            const ticketTitle = this.currentTicketTitle;

            // Reset status immediately
            this.isTracking = false;

            // Remove tracking state from storage immediately
            try {
                await chrome.storage.local.remove(['zammadTrackingState']);
                this.debug('Tracking state removed from storage');
            } catch (storageError) {
                this.debug('Error removing tracking state: ' + storageError.message);
            }

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

            // Storage already deleted at the beginning of the method
            this.debug('Status already deleted');

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

            // Close popup after a delay to ensure all operations complete
            // Using a longer timeout to ensure tracking is registered even if user moves away quickly
            setTimeout(() => window.close(), 5000);

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
                    // Get existing time entries to calculate the difference
                    const timeEntries = await zammadApi.getTimeEntries(this.currentTicketId);
                    let totalExistingTime = 0;

                    if (timeEntries && Array.isArray(timeEntries)) {
                        // Calculate total time spent
                        totalExistingTime = timeEntries.reduce((total, entry) => {
                            return total + (parseFloat(entry.time_unit) || 0);
                        }, 0);
                        this.debug('Total existing time: ' + totalExistingTime + ' min');
                    }

                    // If the new time is different from the existing total, submit a correction
                    if (newTimeValue !== totalExistingTime) {
                        // Submit the time entry with a comment indicating it's a correction
                        // If new time is less than existing, we need to submit a negative value to adjust
                        const adjustmentValue = newTimeValue - totalExistingTime;
                        const comment = 'Korrektur der erfassten Zeit';

                        this.debug('Submitting time adjustment: ' + adjustmentValue + ' min');
                        const response = await zammadApi.submitTimeEntry(this.currentTicketId, adjustmentValue, comment);

                        if (response) {
                            this.debug('Time updated successfully');
                            this.infoText.textContent = t('time_updated');
                            this.infoText.className = 'info success';
                        } else {
                            throw new Error('No response from API');
                        }
                    } else {
                        this.debug('No time adjustment needed, values are the same');
                        this.infoText.textContent = t('time_updated');
                        this.infoText.className = 'info success';
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
}

// Popup beim Laden initialisieren
document.addEventListener('DOMContentLoaded', () => {
    new TimetrackingPopup();
});
