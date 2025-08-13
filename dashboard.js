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
        this.groupFilter = document.getElementById('groupFilter');
        this.groupFilterLabel = document.getElementById('groupFilterLabel');

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
        this.groups = [];
        this.isLoading = false;
        this.selectedUserId = 'all'; // Default to all users
        this.selectedGroup = 'all'; // Default to all groups
        this.draggedTicket = null; // Track the currently dragged ticket
        this.userCache = new Map(); // Cache user data to avoid repeated API calls
        this.baseUrl = '';
        this.token = '';

        // Initialize
        this.updateUILanguage();
        this.initEventListeners();
        this.initializeApi();
        this.initDragAndDrop();

        // Auto-refresh setup
        this.autoRefreshTimer = null;
        this.autoRefreshSec = 0;
        this.initAutoRefresh();
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
        this.groupFilterLabel.textContent = t('dashboard_group_filter') || 'Group:';

        // Column titles
        this.openColumnTitle.textContent = t('dashboard_open');
        this.progressColumnTitle.textContent = t('dashboard_in_progress');
        this.waitingColumnTitle.textContent = t('dashboard_waiting');
        this.closedColumnTitle.textContent = t('dashboard_closed');

        logger.info('UI language updated');
    }

    /**
     * Initialize auto refresh based on stored settings and listen for changes
     */
    initAutoRefresh() {
        // Load current setting
        this.applyAutoRefreshFromSettings();

        // Apply on storage changes
        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.zammadApiSettings) {
                    logger.info('Detected change in API settings, re-evaluating auto-refresh');
                    this.applyAutoRefreshFromSettings();
                }
            });
        } catch (e) {
            logger.warn('chrome.storage.onChanged not available or failed to attach listener', e);
        }

        // Clear timer on page unload
        window.addEventListener('beforeunload', () => this.stopAutoRefresh());
    }

    /**
     * Read setting from storage and start/stop timer accordingly
     */
    async applyAutoRefreshFromSettings() {
        try {
            const settings = await storage.load('zammadApiSettings', {});
            const sec = parseInt(settings && settings.dashboardRefreshSec, 10);
            const nextSec = isNaN(sec) ? 0 : Math.max(0, sec);

            if (nextSec !== this.autoRefreshSec) {
                this.autoRefreshSec = nextSec;
                logger.info(`Auto-refresh interval set to ${this.autoRefreshSec} seconds`);
                this.stopAutoRefresh();
                if (this.autoRefreshSec > 0) {
                    this.startAutoRefresh();
                }
            } else {
                // If same but timer missing (e.g., after navigation), ensure it's running
                if (this.autoRefreshSec > 0 && !this.autoRefreshTimer) {
                    this.startAutoRefresh();
                }
            }
        } catch (error) {
            logger.error('Failed to apply auto-refresh setting', error);
        }
    }

    /** Start the interval timer */
    startAutoRefresh() {
        this.stopAutoRefresh();
        if (this.autoRefreshSec <= 0) return;
        const intervalMs = this.autoRefreshSec * 1000;
        this.autoRefreshTimer = setInterval(async () => {
            try {
                // Avoid overlapping loads
                if (this.isLoading) return;
                if (!zammadApi || !zammadApi.isInitialized || !zammadApi.isInitialized()) return;
                logger.debug('Auto-refresh: loading tickets');
                await this.loadTickets();
            } catch (e) {
                logger.warn('Auto-refresh cycle failed', e);
            }
        }, intervalMs);
    }

    /** Stop the interval timer */
    stopAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
        }
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

        // Group filter change
        if (this.groupFilter) {
            this.groupFilter.addEventListener('change', () => {
                const selectedGroup = this.groupFilter.value;
                logger.info(`Group filter changed to: ${selectedGroup}`);
                this.selectedGroup = selectedGroup;
                this.applyGroupFilter();
            });
        }
    }

    /**
     * Initialize drag and drop functionality
     */
    initDragAndDrop() {
        logger.info('Setting up drag and drop functionality');

        // Set up drop zones
        this.setupDropZone(this.openTickets, 'open');
        this.setupDropZone(this.progressTickets, 'progress');
        this.setupDropZone(this.waitingTickets, 'waiting');
        this.setupDropZone(this.closedTickets, 'closed');
    }

    /**
     * Set up a drop zone for a ticket container
     * @param {HTMLElement} container - The container element
     * @param {string} category - The category of the container (open, progress, waiting, closed)
     */
    setupDropZone(container, category) {
        if (!container) return;
        container.setAttribute('data-category', category);
        container.addEventListener('dragover', (event) => {
            event.preventDefault();
            container.classList.add('drag-over');
        });

        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });
        container.addEventListener('drop', (event) => {
            event.preventDefault();
            container.classList.remove('drag-over');

            // Get the dragged ticket ID
            if (!this.draggedTicket) return;

            const ticketId = this.draggedTicket.getAttribute('data-ticket-id');
            const currentCategory = this.getTicketCategory(this.tickets.find(t => t.id == ticketId));

            // If dropped in the same category, do nothing
            if (currentCategory === category) {
                logger.info(`Ticket #${ticketId} dropped in the same category (${category})`);
                return;
            }

            logger.info(`Ticket #${ticketId} dropped in ${category} category`);

            // Update the ticket state
            this.updateTicketState(ticketId, category);
        });
    }

    /**
     * Update a ticket's state via API
     * @param {string|number} ticketId - The ticket ID
     * @param {string} category - The new category (open, progress, waiting, closed)
     */
    async updateTicketState(ticketId, category) {
        try {
            logger.info(`Updating ticket #${ticketId} to ${category} state`);

            // Show loading indicator
            this.showLoading();

            // Map category to state name
            let stateName;
            switch (category) {
                case 'open':
                    stateName = 'new';
                    break;
                case 'progress':
                    stateName = 'in progress';
                    break;
                case 'waiting':
                    stateName = 'pending reminder';
                    break;
                case 'closed':
                    stateName = 'closed';
                    break;
                default:
                    throw new Error(`Unknown category: ${category}`);
            }

            // Prepare update data
            const updateData = {
                state: stateName
            };

            // Make API request to update ticket
            const endpoint = `/api/v1/tickets/${ticketId}`;
            await zammadApi.request(endpoint, 'PUT', updateData);

            logger.info(`Successfully updated ticket #${ticketId} to ${stateName} state`);

            // Reload tickets to reflect changes
            await this.loadTickets();

        } catch (error) {
            logger.error(`Error updating ticket state:`, error);
            this.showError(`Failed to update ticket: ${error.message}`);
        }
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
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading();

        try {
            logger.info('Loading tickets from API');

            // Check if API is initialized
            if (!zammadApi.isInitialized()) {
                throw new Error('API not initialized');
            }

            // Fetch groups from Zammad API
            try {
                const groups = await zammadApi.getAllGroups();
                this.groups = Array.isArray(groups) ? groups : [];
                logger.info(`Loaded ${this.groups.length} groups from API`);
            } catch (error) {
                logger.warn('Failed to load groups, continuing without group information:', error);
                this.groups = [];
            }

            // Get tickets based on selected user filter
            let tickets;
            if (this.selectedUserId === 'all') {
                tickets = await zammadApi.getAllTickets();
                logger.info(`Loaded ${tickets ? tickets.length : 0} tickets from all users`);
            } else if (this.selectedUserId === 'me') {
                tickets = await zammadApi.getAssignedTickets();
                logger.info(`Loaded ${tickets ? tickets.length : 0} tickets assigned to current user`);
            } else {
                tickets = await zammadApi.getAllTickets(this.selectedUserId);
                logger.info(`Loaded ${tickets ? tickets.length : 0} tickets for user ${this.selectedUserId}`);
            }

            // Store tickets
            this.tickets = Array.isArray(tickets) ? tickets : [];

            // Populate user filter with actual ticket owners
            await this.populateUserFilterFromTickets();

            // Process and display tickets
            this.processTickets();

            // Populate group filter from the active result set and apply current selection
            await this.populateGroupFilterFromTickets();
            this.applyGroupFilter();

            this.hideLoading();

        } catch (error) {
            logger.error('Error loading tickets:', error);
            this.showError('Failed to load tickets: ' + error.message);
        } finally {
            this.isLoading = false;
        }
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

        // Sort tickets by priority descending, then by updated_at descending
        const sortedTickets = this.tickets.slice().sort((a, b) => {
            // First, sort by priority descending (higher priority numbers first)
            const priorityA = a.priority_id || 0;
            const priorityB = b.priority_id || 0;
            
            if (priorityA !== priorityB) {
                return priorityB - priorityA; // Higher priority first
            }
            
            // If priorities are equal, sort by updated_at descending
            const dateA = new Date(a.updated_at || a.updatedAt || 0);
            const dateB = new Date(b.updated_at || b.updatedAt || 0);
            return dateB - dateA;
        });

        // Counters for each category
        let openCount = 0;
        let progressCount = 0;
        let waitingCount = 0;
        let closedCount = 0;

        // Process each ticket
        sortedTickets.forEach(ticket => {
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
    * Populate user filter dropdown with actual ticket owners
    */
    async populateUserFilterFromTickets() {
        const userFilter = document.getElementById('userFilter');
        if (!userFilter) return;

        // Get unique owner IDs from tickets
        const ownerIds = [...new Set(this.tickets.map(t => t.owner_id).filter(id => id))];

        if (ownerIds.length === 0) {
            console.log('No ticket owners found');
            return;
        }

        console.log(`Found ${ownerIds.length} unique ticket owners: ${ownerIds.join(', ')}`);

        // Preserve current selection
        const currentSelection = userFilter.value;

        // Clear existing user options (keep "All" and "Me")
        const optionsToRemove = Array.from(userFilter.options).filter(opt =>
          opt.value !== 'all' && opt.value !== 'me'
        );
        optionsToRemove.forEach(option => option.remove());

        // Fetch user information for all owners
        const userPromises = ownerIds.map(async (ownerId) => {
            try {
                // Check cache first
                if (this.userCache && this.userCache.has(ownerId)) {
                    return { id: ownerId, name: this.userCache.get(ownerId) };
                }

                // Fetch from API
                const user = await this.fetchUserInfo(ownerId);
                if (user) {
                    const fullName = `${user.firstname || ''} ${user.lastname || ''}`.trim() ||
                      user.login || user.email || `User ${user.id}`;

                    // Cache the result
                    if (this.userCache) {
                        this.userCache.set(ownerId, fullName);
                    }

                    return { id: ownerId, name: fullName };
                } else {
                    return { id: ownerId, name: `User ${ownerId}` };
                }
            } catch (error) {
                console.error(`Failed to fetch user ${ownerId}:`, error);
                return { id: ownerId, name: `User ${ownerId}` };
            }
        });

        // Wait for all user data to load
        const users = await Promise.all(userPromises);

        // Sort users by name
        users.sort((a, b) => a.name.localeCompare(b.name));

        // Add user options to dropdown
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            userFilter.appendChild(option);
        });

        // Restore previous selection if it still exists
        if (currentSelection && Array.from(userFilter.options).some(opt => opt.value === currentSelection)) {
            userFilter.value = currentSelection;
        }

        console.log(`Added ${users.length} users to filter dropdown`);
    }

    /**
     * Populate group filter dropdown with groups present in the active ticket result set
     */
    async populateGroupFilterFromTickets() {
        if (!this.groupFilter) return;

        // Collect unique group IDs from active tickets
        const groupIds = new Set();
        const nonePresent = this.tickets.some(t => !t.group_id);
        this.tickets.forEach(t => { if (t.group_id) groupIds.add(String(t.group_id)); });

        // Build list of group options from this.groups using IDs present in tickets
        const groupsById = new Map((this.groups || []).map(g => [String(g.id), g]));
        const options = [];

        // Special: include No Group if present in result set
        if (nonePresent) {
            options.push({ value: 'none', name: 'No Group' });
        }

        groupIds.forEach(id => {
            const g = groupsById.get(id);
            if (g && g.name) {
                options.push({ value: id, name: g.name });
            }
        });

        // Sort by name
        options.sort((a, b) => a.name.localeCompare(b.name));

        // Preserve current selection
        const currentSelection = this.groupFilter.value || 'all';

        // Clear existing dynamic options (keep 'all')
        const toRemove = Array.from(this.groupFilter.options).filter(opt => opt.value !== 'all');
        toRemove.forEach(opt => opt.remove());

        // Add new options
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.name;
            this.groupFilter.appendChild(o);
        });

        // Restore selection if still available; otherwise reset to 'all'
        if (currentSelection && Array.from(this.groupFilter.options).some(opt => opt.value === currentSelection)) {
            this.groupFilter.value = currentSelection;
        } else {
            this.groupFilter.value = 'all';
            this.selectedGroup = 'all';
        }
    }

    /**
     * Apply current group filter to the displayed tickets and update counts
     */
    applyGroupFilter() {
        if (!this.groupFilter) return;
        const selected = this.groupFilter.value || 'all';

        const lists = [this.openTickets, this.progressTickets, this.waitingTickets, this.closedTickets];
        lists.forEach(list => {
            if (!list) return;
            const items = list.querySelectorAll('.ticket-item');
            items.forEach(item => {
                const itemGroupId = item.getAttribute('data-group-id') || 'none';
                const match = (selected === 'all') ? true : (itemGroupId === selected);
                item.style.display = match ? '' : 'none';
            });
        });

        this.updateCountsFromDOM();
    }

    /**
     * Recalculate and set column counters based on currently visible tickets
     */
    updateCountsFromDOM() {
        const countVisible = (list) => list ? Array.from(list.querySelectorAll('.ticket-item')).filter(it => it.style.display !== 'none').length : 0;
        this.openCount.textContent = String(countVisible(this.openTickets));
        this.progressCount.textContent = String(countVisible(this.progressTickets));
        this.waitingCount.textContent = String(countVisible(this.waitingTickets));
        this.closedCount.textContent = String(countVisible(this.closedTickets));
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
            stateId === 12) { // warten
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
        let updated_at = ticket.updated_at || ticket.updatedAt || 'Unknown';
        // Format date if available
        if (updated_at && updated_at !== 'Unknown') {
            try {
                const dateObj = new Date(updated_at);
                if (!isNaN(dateObj)) {
                    updated_at = dateObj.toLocaleString('de-DE', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                    });
                }
            } catch (e) {
                // Fallback: keep as is
            }
        }

        // First try to get user info from owner_data (added by our API)
        if (ticket.owner_data && ticket.owner_data.fullname) {
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
                    // User not found in our limited users array - try to fetch from API
                    userName = this.getUserDisplayName(userId);
                }
            }
        }

        if (userName.trim() === '' || userName === undefined || userName === null) {
            // If no user information is available, use a fallback
            // Fallback if no user information is available
            userName = 'NOT ASSIGNED'
        }

        // Get group information
        let groupName = '';
        if (ticket.group_id && this.groups && this.groups.length > 0) {
            const group = this.groups.find(g => g.id == ticket.group_id);
            if (group) {
                groupName = group.name || '';
            }
        }

        // Create ticket item element
        const ticketItem = document.createElement('div');
        ticketItem.className = 'ticket-item';
        ticketItem.setAttribute('data-ticket-id', ticketId);
        if (userId) {
            ticketItem.setAttribute('data-user-id', userId);
        }
        if (ticket.group_id) {
            ticketItem.setAttribute('data-group-id', String(ticket.group_id));
        } else {
            ticketItem.setAttribute('data-group-id', 'none');
        }
        ticketItem.setAttribute('data-group-name', groupName || 'No Group');
        ticketItem.setAttribute('data-selectable', 'true');
        ticketItem.setAttribute('draggable', 'true');

        // Add drag events
        ticketItem.addEventListener('dragstart', (event) => {
            this.draggedTicket = ticketItem;
            ticketItem.classList.add('dragging');
            event.dataTransfer.setData('text/plain', ticketId);
            event.dataTransfer.effectAllowed = 'move';
            logger.info(`Started dragging ticket #${ticketId}`);
        });

        ticketItem.addEventListener('dragend', () => {
            ticketItem.classList.remove('dragging');
            this.draggedTicket = null;
            logger.info(`Stopped dragging ticket #${ticketId}`);
        });

        // Add ticket content - 3 row layout
        ticketItem.innerHTML = `
        <div class="ticket-row-1">
            <div class="ticket-item-title">${ticketTitle}</div>
        </div>
        <div class="ticket-row-2">
        <span class="ticket-number">#${ticketId}</span>
            <span class="ticket-item-group">${groupName ? `${groupName}` : 'No Group'}</span>
        </div>
        <div class="ticket-row-3">
            <span class="ticket-item-user">${userName || `User #${ticketId}`}</span>
            <span class="ticket-updated">${updated_at}</span>
            <span class="ticket-item-priority ${this.getPriorityClass(ticketPriority)}">${ticketPriority}</span>
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
     * Get user display name by ID, using cache or fetching from API
     * @param {string|number} userId - User ID
     * @returns {string} User display name
     */
    getUserDisplayName(userId) {
        // Check cache first
        if (this.userCache && this.userCache.has(userId)) {
            return this.userCache.get(userId);
        }

        // Start with fallback
        let displayName = `User ${userId}`;

        // Try to fetch user info from API asynchronously
        this.fetchUserInfo(userId).then(user => {
            if (user) {
                // More robust name extraction
                let fullName = '';

                // Try different name combinations
                if (user.firstname && user.lastname) {
                    fullName = `${user.firstname} ${user.lastname}`.trim();
                } else if (user.firstname) {
                    fullName = user.firstname;
                } else if (user.lastname) {
                    fullName = user.lastname;
                } else if (user.login) {
                    fullName = user.login;
                } else if (user.email) {
                    fullName = user.email;
                } else {
                    fullName = `User ${user.id}`;
                }

                console.log(`Resolved user ${userId} to: ${fullName}`, user);

                // Cache and update
                if (this.userCache) {
                    this.userCache.set(userId, fullName);
                }
                this.updateTicketElementsWithUserName(userId, fullName);
            } else {
                console.warn(`No user data returned for ${userId}`);
            }
        });


        return displayName;
    }

// Check if certain users are restricted
    async fetchUserInfo(userId) {
        try {
            const user = await zammadApi.request(`/api/v1/users/${userId}`);
            return user;
        } catch (error) {
            // Log specific error types
            if (error.message.includes('403')) {
                console.warn(`No permission to access user ${userId}`);
            } else if (error.message.includes('404')) {
                console.warn(`User ${userId} not found`);
            }
            logger.error(`Error fetching user ${userId}:`, error);
            return null;
        }
    }

    /**
     * Update all ticket elements that have a specific user ID with the user's name
     * @param {string|number} userId - User ID
     * @param {string} userName - User display name
     */
    updateTicketElementsWithUserName(userId, userName) {
        const ticketElements = document.querySelectorAll(`[data-user-id="${userId}"]`);

        ticketElements.forEach(element => {
            const userElement = element.querySelector('.ticket-item-id');
            if (userElement) {
                userElement.textContent = userName;
            }
        });
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
