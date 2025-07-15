/**
 * Dashboard for Zammad Tickets
 * Displays tickets in a GitLab-like board with columns for different statuses
 */

class ZammadDashboard {
    constructor() {
        logger.info('Initializing Zammad Dashboard');

        // UI Elements
        this.dashboardContainer = document.getElementById('dashboardContainer');
        this.loadingContainer = document.getElementById('loadingContainer');
        this.errorContainer = document.getElementById('errorContainer');

        // Ticket containers
        this.openTickets = document.getElementById('openTickets');
        this.progressTickets = document.getElementById('progressTickets');
        this.waitingTickets = document.getElementById('waitingTickets');
        this.closedTickets = document.getElementById('closedTickets');

        // Counters
        this.openCount = document.getElementById('openCount');
        this.progressCount = document.getElementById('progressCount');
        this.waitingCount = document.getElementById('waitingCount');
        this.closedCount = document.getElementById('closedCount');

        // Buttons
        this.refreshBtn = document.getElementById('refreshBtn');
        this.backToPopupBtn = document.getElementById('backToPopupBtn');

        // Filter elements
        this.userFilter = document.getElementById('userFilter');
        this.userFilterLabel = document.getElementById('userFilterLabel');

        // Text elements
        this.dashboardTitle = document.getElementById('dashboardTitle');
        this.refreshBtnText = document.getElementById('refreshBtnText');
        this.backBtnText = document.getElementById('backBtnText');
        this.loadingText = document.getElementById('loadingText');
        this.openColumnTitle = document.getElementById('openColumnTitle');
        this.progressColumnTitle = document.getElementById('progressColumnTitle');
        this.waitingColumnTitle = document.getElementById('waitingColumnTitle');
        this.closedColumnTitle = document.getElementById('closedColumnTitle');

        // Ticket data
        this.tickets = [];
        this.users = [];
        this.isLoading = false;
        this.selectedUserId = 'all'; // Default to all users

        // ADD THESE NEW PROPERTIES:
        this.userCache = new Map(); // Cache user data to avoid repeated API calls
        this.baseUrl = '';
        this.token = '';

        // Initialize
        this.updateUILanguage();
        this.initEventListeners();
        this.initializeApi();
    }

    /**
     * Update UI with translations
     */
    updateUILanguage() {
        logger.info('Updating UI language');

        // Update static UI elements
        document.title = t('dashboard_title');
        this.dashboardTitle.textContent = t('dashboard_title');
        this.refreshBtnText.textContent = t('dashboard_refresh');
        this.backBtnText.textContent = t('dashboard_back');
        this.loadingText.textContent = t('dashboard_loading');
        this.userFilterLabel.textContent = t('dashboard_user_filter') || 'User:';

        // Column titles
        this.openColumnTitle.textContent = t('dashboard_open');
        this.progressColumnTitle.textContent = t('dashboard_in_progress');
        this.waitingColumnTitle.textContent = t('dashboard_waiting');
        this.closedColumnTitle.textContent = t('dashboard_closed');

        logger.info('UI language updated');
    }

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        logger.info('Setting up event listeners');

        // Refresh button
        this.refreshBtn.addEventListener('click', () => {
            logger.info('Refresh button clicked');
            this.loadTickets();
        });

        // Back to popup button
        this.backToPopupBtn.addEventListener('click', () => {
            logger.info('Back to popup button clicked');
            window.close();
        });

        // User filter change
        this.userFilter.addEventListener('change', () => {
            const selectedValue = this.userFilter.value;
            logger.info(`User filter changed to: ${selectedValue}`);
            this.selectedUserId = selectedValue;
            this.loadTickets();
        });
    }

    /**
     * Initialize the API
     */
    async initializeApi() {
        try {
            logger.info('Initializing API');

            // Load API settings
            const apiSettings = await storage.load('zammadApiSettings');

            if (!apiSettings || !apiSettings.baseUrl || !apiSettings.token) {
                this.showError('API settings not configured. Please configure in the extension options.');
                return;
            }

            // Initialize API
            zammadApi.init(apiSettings.baseUrl, apiSettings.token);

            // Load tickets
            this.loadTickets();

        } catch (error) {
            logger.error('Error initializing API:', error);
            this.showError('Failed to initialize API: ' + error.message);
        }
    }

    /**
     * Load tickets from API
     */
    async loadTickets() {
        // Prevent multiple simultaneous loads
        if (this.isLoading) {
            return;
        }

        this.isLoading = true;
        this.showLoading();

        try {
            logger.info('Loading tickets from API');

            // Check if API is initialized
            if (!zammadApi.isInitialized()) {
                throw new Error('API not initialized');
            }

            // Load users if we haven't already
            if (this.users.length === 0) {
                await this.loadUsers();
            }

            // Get tickets based on selected user filter
            let tickets;
            if (this.selectedUserId === 'all') {
                // Get all tickets
                tickets = await zammadApi.getAllTickets();
                logger.info(`Loaded ${tickets ? tickets.length : 0} tickets from all users`);
            } else if (this.selectedUserId === 'me') {
                // Get current user's tickets
                tickets = await zammadApi.getAssignedTickets();
                logger.info(`Loaded ${tickets ? tickets.length : 0} tickets assigned to current user`);
            } else {
                // Get tickets for specific user
                tickets = await zammadApi.getAllTickets(this.selectedUserId);
                logger.info(`Loaded ${tickets ? tickets.length : 0} tickets for user ${this.selectedUserId}`);
            }

            // Store tickets
            this.tickets = Array.isArray(tickets) ? tickets : [];

            // Process and display tickets
            this.processTickets();
            this.hideLoading();

        } catch (error) {
            logger.error('Error loading tickets:', error);
            this.showError('Failed to load tickets: ' + error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load users from API and populate user filter
     */
    async loadUsers() {
        try {
            logger.info('Loading users from API');

            // Get all users
            const users = await zammadApi.getAllUsers();
            logger.info(`Loaded ${users ? users.length : 0} users`);

            // Store users
            this.users = Array.isArray(users) ? users : [];

            // Populate user filter dropdown
            await this.populateUserFilter();

        } catch (error) {
            logger.error('Error loading users:', error);
            // Don't show error, just log it - we can still show tickets without user filter
        }
    }

    /**
     * Populate user filter dropdown with users
     */
    async populateUserFilter() {
        logger.info('Populating user filter dropdown');

        // Keep the first two options (All Users and My Tickets)
        const allOption = this.userFilter.options[0];
        const meOption = this.userFilter.options[1];

        // Clear existing options
        this.userFilter.innerHTML = '';

        // Add back the first two options
        this.userFilter.appendChild(allOption);
        this.userFilter.appendChild(meOption);

        // Get configured user IDs from API settings
        let configuredUserIds = [];
        try {
            const apiSettings = await storage.load('zammadApiSettings');
            if (apiSettings && apiSettings.userIds) {
                configuredUserIds = apiSettings.userIds.split(',').map(id => id.trim()).filter(id => id);
                logger.info(`Found configured user IDs: ${configuredUserIds.join(', ')}`);
            }
        } catch (error) {
            logger.error('Error loading configured user IDs:', error);
        }

        // Sort users by name
        const sortedUsers = [...this.users].sort((a, b) => {
            const nameA = `${a.firstname || ''} ${a.lastname || ''}`.trim() || a.login || a.email || '';
            const nameB = `${b.firstname || ''} ${b.lastname || ''}`.trim() || b.login || b.email || '';
            return nameA.localeCompare(nameB);
        });

        // Filter users if we have configured user IDs
        const filteredUsers = configuredUserIds.length > 0
            ? sortedUsers.filter(user => configuredUserIds.includes(String(user.id)))
            : sortedUsers;

        // Add user options
        filteredUsers.forEach(user => {
            // Skip users without an ID
            if (!user.id) return;

            // Create display name
            const displayName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.login || user.email || `User ${user.id}`;

            // Create option
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = displayName;

            // Add option to dropdown
            this.userFilter.appendChild(option);
        });

        logger.info(`Added ${filteredUsers.length} users to filter dropdown`);
    }

    /**
     * Process tickets and categorize by status
     */
    processTickets() {
        logger.info('Processing tickets');

        // Clear existing tickets
        this.clearTickets();

        // Skip if no tickets
        if (!this.tickets || this.tickets.length === 0) {
            this.showEmptyState();
            return;
        }

        // Counters for each category
        let openCount = 0;
        let progressCount = 0;
        let waitingCount = 0;
        let closedCount = 0;

        // Process each ticket
        this.tickets.forEach(ticket => {
            // Determine ticket status category
            const category = this.getTicketCategory(ticket);

            // Create ticket element
            const ticketElement = this.createTicketElement(ticket);

            // Add to appropriate container
            switch (category) {
                case 'open':
                    this.openTickets.appendChild(ticketElement);
                    openCount++;
                    break;
                case 'progress':
                    this.progressTickets.appendChild(ticketElement);
                    progressCount++;
                    break;
                case 'waiting':
                    this.waitingTickets.appendChild(ticketElement);
                    waitingCount++;
                    break;
                case 'closed':
                    this.closedTickets.appendChild(ticketElement);
                    closedCount++;
                    break;
            }
        });

        // Update counters
        this.openCount.textContent = openCount;
        this.progressCount.textContent = progressCount;
        this.waitingCount.textContent = waitingCount;
        this.closedCount.textContent = closedCount;

        // Show dashboard
        this.dashboardContainer.style.display = 'grid';

        logger.info(`Displayed tickets: ${openCount} open, ${progressCount} in progress, ${waitingCount} waiting, ${closedCount} closed`);
    }

    /**
     * Determine ticket category based on state
     * @param {Object} ticket - Ticket object
     * @returns {string} Category: 'open', 'progress', 'waiting', or 'closed'
     */
    getTicketCategory(ticket) {
        // Get state information
        const stateId = ticket.state_id;
        const stateName = String(ticket.state || '').toLowerCase();

        // Map state IDs to categories based on the provided JSON data
        // State types from Zammad:
        // 1: new, 2: open, 3: pending reminder, 4: pending action, 5: closed, 6: merged

        // Closed tickets
        if (stateId === 2 || // closed successful
            stateId === 3 || // closed unsuccessful
            stateId === 9) { // merged
            return 'closed';
        }

        // In progress tickets
        if (stateId === 10) { // in progress
            return 'progress';
        }

        // Waiting tickets
        if (stateId === 6 || // pending reminder
            stateId === 7 || // pending auto close+
            stateId === 8 || // pending auto close-
            stateId === 11 || // blockiert
            stateId === 12 || // warten
            stateName.includes('wait') || 
            stateName.includes('on hold') || 
            stateName.includes('pending')) {
            return 'waiting';
        }

        // Open tickets
        if (stateId === 1 || // new
            stateId === 4) { // open
            return 'open';
        }

        // Default to open for any other state
        return 'open';
    }

    /**
     * Create a ticket element
     * @param {Object} ticket - Ticket object
     * @returns {HTMLElement} Ticket element
     */
    createTicketElement(ticket) {
        // Extract ticket data
        const ticketId = ticket.id || ticket.number || '';
        const ticketTitle = ticket.title || 'No title available';
        const ticketState = ticket.state || ticket.state_id || '';
        const ticketPriority = this.getTicketPriority(ticket);

        // Get user information
        let userName = '';
        let userId = '';

        // First try to get user info from owner_data (added by our API)
        if (ticket.owner_data) {
            userName = ticket.owner_data.fullname;
            userId = ticket.owner_data.id;
        } 
        // Then try to get from owner fields
        else if (ticket.owner_id) {
            userId = ticket.owner_id;
            // Try to get a more descriptive name from the ticket if available
            if (ticket.owner && typeof ticket.owner === 'object') {
                // If owner object is available with name information
                const owner = ticket.owner;
                userName = `${owner.firstname || ''} ${owner.lastname || ''}`.trim() || owner.login || owner.email || `User ${userId}`;
            } else if (ticket.owner && typeof ticket.owner === 'string') {
                // If owner is just a string
                userName = ticket.owner;
            } else {
                // Try to find user in our users array
                const user = this.users.find(u => u.id == userId);
                if (user) {
                    userName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.login || user.email || `User ${user.id}`;
                } else {
                    // Fallback to User ID
                    userName = `User ${userId}`;
                }
            }
        }

        // Create ticket item element
        const ticketItem = document.createElement('div');
        ticketItem.className = 'ticket-item';
        ticketItem.setAttribute('data-ticket-id', ticketId);
        if (userId) {
            ticketItem.setAttribute('data-user-id', userId);
        }

        // Add selectable attribute
        ticketItem.setAttribute('data-selectable', 'true');

        // Add ticket content
        ticketItem.innerHTML = `
            <div class="ticket-item-title">${ticketTitle}</div>
            <div class="ticket-item-details">
                <span class="ticket-item-id">${userName || `#${ticketId}`}</span>
                <div class="ticket-item-meta">
                    <span class="ticket-item-priority ${this.getPriorityClass(ticketPriority)}">${ticketPriority}</span>
                    <span class="ticket-number">#${ticketId}</span>
                </div>
            </div>
        `;

        // Add click event with selection functionality
        ticketItem.addEventListener('click', (event) => {
            // Check if Ctrl/Cmd key is pressed for selection
            if (event.ctrlKey || event.metaKey) {
                // Toggle selection
                ticketItem.classList.toggle('selected');
                event.preventDefault();
                event.stopPropagation();
            } else {
                // Regular click opens the ticket in Zammad
                this.openTicketInZammad(ticketId);
            }
        });

        return ticketItem;
    }

    /**
     * Get ticket priority
     * @param {Object} ticket - Ticket object
     * @returns {string} Priority: translated version of 'Low', 'Medium', or 'High'
     */
    getTicketPriority(ticket) {
        // Check if priority exists
        if (!ticket.priority && !ticket.priority_id) {
            return t('dashboard_priority_medium');
        }
        const priorityId = ticket.priority_id;

        // Low priority
        if (priorityId === 2 || priorityId === 1) {
            return t('dashboard_priority_low');
        }
        // Medium priority
        if (priorityId === 3) {
            return t('dashboard_priority_medium');
        }
        // High priority
        if (priorityId === 4 || priorityId === 5) {
            return t('dashboard_priority_high');
        }

        // Default to medium
        return t('dashboard_priority_medium');
    }

    /**
     * Get CSS class for priority
     * @param {string} priority - Priority string (translated)
     * @returns {string} CSS class
     */
    getPriorityClass(priority) {
        // Compare with translations to determine the right class
        if (priority === t('dashboard_priority_high')) {
            return 'priority-high';
        } else if (priority === t('dashboard_priority_low')) {
            return 'priority-low';
        } else {
            return 'priority-medium';
        }
    }

    /**
     * Open ticket in Zammad
     * @param {string|number} ticketId - Ticket ID
     */
    openTicketInZammad(ticketId) {
        try {
            logger.info(`Opening ticket #${ticketId} in Zammad`);

            // Get API settings
            const baseUrl = zammadApi.baseUrl;

            if (!baseUrl) {
                throw new Error('API base URL not available');
            }

            // Construct ticket URL
            const ticketUrl = `${baseUrl}/#ticket/zoom/${ticketId}`;

            // Open in new tab
            window.open(ticketUrl, '_blank');

        } catch (error) {
            logger.error(`Error opening ticket #${ticketId}:`, error);
            this.showError(`Failed to open ticket #${ticketId}: ${error.message}`);
        }
    }

    /**
     * Clear all ticket containers
     */
    clearTickets() {
        this.openTickets.innerHTML = '';
        this.progressTickets.innerHTML = '';
        this.waitingTickets.innerHTML = '';
        this.closedTickets.innerHTML = '';
    }

    /**
     * Show empty state when no tickets are found
     */
    showEmptyState() {
        const emptyState = `<div class="empty-state">${t('dashboard_no_tickets')}</div>`;

        this.openTickets.innerHTML = emptyState;
        this.progressTickets.innerHTML = emptyState;
        this.waitingTickets.innerHTML = emptyState;
        this.closedTickets.innerHTML = emptyState;

        // Update counters
        this.openCount.textContent = '0';
        this.progressCount.textContent = '0';
        this.waitingCount.textContent = '0';
        this.closedCount.textContent = '0';

        // Show dashboard
        this.dashboardContainer.style.display = 'grid';
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.loadingContainer.style.display = 'flex';
        this.dashboardContainer.style.display = 'none';
        this.errorContainer.style.display = 'none';
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        this.loadingContainer.style.display = 'none';
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        logger.error('Dashboard error:', message);

        this.errorContainer.textContent = message;
        this.errorContainer.style.display = 'block';
        this.loadingContainer.style.display = 'none';

        // Show empty dashboard
        this.showEmptyState();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Enable debug mode in logger if needed
    // logger.enableDebug();

    // Create dashboard instance
    window.dashboard = new ZammadDashboard();
});
