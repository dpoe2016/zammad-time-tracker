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
        this.newTickets = document.getElementById('newTickets');
        this.openTickets = document.getElementById('openTickets');
        this.progressTickets = document.getElementById('progressTickets');
        this.waitingTickets = document.getElementById('waitingTickets');
        this.closedTickets = document.getElementById('closedTickets');

        // Counters
        this.newCount = document.getElementById('newCount');
        this.openCount = document.getElementById('openCount');
        this.progressCount = document.getElementById('progressCount');
        this.waitingCount = document.getElementById('waitingCount');
        this.closedCount = document.getElementById('closedCount');

        // Buttons
        this.refreshBtn = document.getElementById('refreshBtn');
        this.backToPopupBtn = document.getElementById('backToPopupBtn');

        // Filter elements
        this.viewToggle = document.getElementById('viewToggle');
        this.viewToggleLabel = document.getElementById('viewToggleLabel');
        this.userFilter = document.getElementById('userFilter');
        this.userFilterLabel = document.getElementById('userFilterLabel');
        this.groupFilter = document.getElementById('groupFilter');
        this.groupFilterLabel = document.getElementById('groupFilterLabel');
        this.organizationFilter = document.getElementById('organizationFilter');
        this.organizationFilterLabel = document.getElementById('organizationFilterLabel');
        this.priorityFilter = document.getElementById('priorityFilter');
        this.priorityFilterLabel = document.getElementById('priorityFilterLabel');
        this.stateFilter = document.getElementById('stateFilter');
        this.stateFilterLabel = document.getElementById('stateFilterLabel');
        
        // Column visibility elements
        this.columnVisibilityContainer = document.getElementById('columnVisibilityContainer');
        this.columnVisibilityBtn = document.getElementById('columnVisibilityBtn');
        this.columnVisibilityText = document.getElementById('columnVisibilityText');

        // Text elements
        this.dashboardTitle = document.getElementById('dashboardTitle');
        this.refreshBtnText = document.getElementById('refreshBtnText');
        this.backBtnText = document.getElementById('backBtnText');
        this.loadingText = document.getElementById('loadingText');
        this.newColumnTitle = document.getElementById('newColumnTitle');
        this.openColumnTitle = document.getElementById('openColumnTitle');
        this.progressColumnTitle = document.getElementById('progressColumnTitle');
        this.waitingColumnTitle = document.getElementById('waitingColumnTitle');
        this.closedColumnTitle = document.getElementById('closedColumnTitle');

        // Ticket data
        this.tickets = [];
        this.users = [];
        this.groups = [];
        this.organizations = [];
        this.isLoading = false;
        this.currentView = 'state'; // Default to state view
        this.selectedUserId = 'all'; // Default to all users
        this.selectedGroup = 'all'; // Default to all groups
        this.selectedOrganization = 'all'; // Default to all organizations
        this.selectedPriority = 'all'; // Default to all priorities
        this.selectedState = 'all'; // Default to all states
        this.draggedTicket = null; // Track the currently dragged ticket
        this.userCache = new Map(); // Cache user data to avoid repeated API calls
        this.baseUrl = '';
        this.token = '';
        this.hiddenColumns = new Set(); // Track hidden columns in agent view

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
        this.updateDashboardTitle();
        this.refreshBtnText.textContent = t('dashboard_refresh');
        this.backBtnText.textContent = t('dashboard_back');
        this.loadingText.textContent = t('dashboard_loading');
        this.userFilterLabel.textContent = t('dashboard_user_filter') || 'User:';
        this.groupFilterLabel.textContent = t('dashboard_group_filter') || 'Group:';
        this.organizationFilterLabel.textContent = t('dashboard_org_filter') || 'Organization:';

        // Column titles
        this.newColumnTitle.textContent = t('dashboard_new');
        this.openColumnTitle.textContent = t('dashboard_open');
        this.progressColumnTitle.textContent = t('dashboard_in_progress');
        this.waitingColumnTitle.textContent = t('dashboard_waiting');
        this.closedColumnTitle.textContent = t('dashboard_closed');

        logger.info('UI language updated');
    }

    /**
     * Update dashboard title with version from manifest
     */
    async updateDashboardTitle() {
        try {
            const manifest = chrome.runtime.getManifest();
            const version = manifest.version;
            this.dashboardTitle.textContent = `v${version}`;
        } catch (error) {
            logger.error('Failed to get version from manifest:', error);
            this.dashboardTitle.textContent = t('dashboard_title');
        }
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

        // View toggle change
        this.viewToggle.addEventListener('change', () => {
            const selectedView = this.viewToggle.value;
            logger.info(`View changed to: ${selectedView}`);
            this.currentView = selectedView;
            
            // Set default state filter to 'open' when agent view is selected
            if (selectedView === 'agent' && this.stateFilter) {
                this.stateFilter.value = 'open';
                this.selectedState = 'open';
                logger.info('Default state filter set to "open" for agent view');
            }
            
            this.updateDashboardLayout();
            this.processTickets();
        });

        // User filter change
        this.userFilter.addEventListener('change', () => {
            const selectedValue = this.userFilter.value;
            logger.info(`User filter changed to: ${selectedValue}`);
            this.selectedUserId = selectedValue;
            this.saveFilterSettings();
            this.loadTickets();
        });

        // Group filter change
        if (this.groupFilter) {
            this.groupFilter.addEventListener('change', () => {
                const selectedGroup = this.groupFilter.value;
                logger.info(`Group filter changed to: ${selectedGroup}`);
                this.selectedGroup = selectedGroup;
                this.saveFilterSettings();
                this.applyFilters();
            });
        }

        // Organization filter change
        if (this.organizationFilter) {
            this.organizationFilter.addEventListener('change', () => {
                const selectedOrg = this.organizationFilter.value;
                logger.info(`Organization filter changed to: ${selectedOrg}`);
                this.selectedOrganization = selectedOrg;
                this.saveFilterSettings();
                this.applyFilters();
            });
        }

        // Priority filter change
        if (this.priorityFilter) {
            this.priorityFilter.addEventListener('change', () => {
                const selectedPriority = this.priorityFilter.value;
                logger.info(`Priority filter changed to: ${selectedPriority}`);
                this.selectedPriority = selectedPriority;
                this.applyFilters();
            });
        }

        // State filter change
        if (this.stateFilter) {
            this.stateFilter.addEventListener('change', () => {
                const selectedState = this.stateFilter.value;
                logger.info(`State filter changed to: ${selectedState}`);
                this.selectedState = selectedState;
                this.applyFilters();
            });
        }

        // Column visibility button
        if (this.columnVisibilityBtn) {
            this.columnVisibilityBtn.addEventListener('click', () => {
                logger.info('Column visibility button clicked');
                this.showColumnVisibilityMenu();
            });
        }
    }

    /**
     * Initialize drag and drop functionality
     */
    initDragAndDrop() {
        logger.info('Setting up drag and drop functionality');

        // Set up drop zones
        this.setupDropZone(this.newTickets, 'new');
        this.setupDropZone(this.openTickets, 'open');
        this.setupDropZone(this.progressTickets, 'progress');
        this.setupDropZone(this.waitingTickets, 'waiting');
        this.setupDropZone(this.closedTickets, 'closed');
    }

    /**
     * Initialize drag and drop functionality for agent view
     */
    initAgentDragAndDrop() {
        logger.info('Setting up drag and drop functionality for agent view');

        // Get unique agents and set up drop zones for each agent column
        const agents = this.getUniqueAgents();
        agents.forEach(agent => {
            const agentId = agent.id || 'unassigned';
            const columnId = `agent-${agentId}`;
            const container = document.getElementById(columnId);
            if (container) {
                this.setupAgentDropZone(container, agentId, agent.name);
            }
        });
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
     * Set up a drop zone for an agent column
     * @param {HTMLElement} container - The container element
     * @param {string} agentId - The agent ID ('unassigned' for unassigned tickets)
     * @param {string} agentName - The agent name for display
     */
    setupAgentDropZone(container, agentId, agentName) {
        if (!container) return;
        
        container.setAttribute('data-agent-id', agentId);
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
            const currentOwnerId = this.draggedTicket.getAttribute('data-user-id');
            
            // Convert agentId for comparison (null/undefined becomes 'unassigned')
            const targetAgentId = agentId === 'unassigned' ? null : agentId;
            const currentAgentId = currentOwnerId === 'null' || !currentOwnerId ? null : currentOwnerId;

            // If dropped on the same agent, do nothing
            if (currentAgentId == targetAgentId) {
                logger.info(`Ticket #${ticketId} dropped on the same agent (${agentName})`);
                return;
            }

            logger.info(`Ticket #${ticketId} dropped on agent: ${agentName} (${agentId})`);

            // Update the ticket owner
            this.updateTicketOwner(ticketId, targetAgentId, agentName);
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
                case 'new':
                    stateName = 'new';
                    break;
                case 'open':
                    stateName = 'open';
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
     * Update a ticket's owner via API
     * @param {string|number} ticketId - The ticket ID
     * @param {string|number|null} newOwnerId - The new owner ID (null for unassigned)
     * @param {string} agentName - The agent name for display
     */
    async updateTicketOwner(ticketId, newOwnerId, agentName) {
        try {
            logger.info(`Updating ticket #${ticketId} owner to: ${agentName} (${newOwnerId || 'unassigned'})`);

            // Show loading indicator
            this.showLoading();

            // Prepare update data
            const updateData = {
                owner_id: newOwnerId || ''
            };

            // Make API request to update ticket
            const endpoint = `/api/v1/tickets/${ticketId}`;
            await zammadApi.request(endpoint, 'PUT', updateData);

            logger.info(`Successfully updated ticket #${ticketId} owner to ${agentName}`);

            // Reload tickets to reflect changes
            await this.loadTickets();

        } catch (error) {
            logger.error(`Error updating ticket owner:`, error);
            this.showError(`Failed to update ticket owner: ${error.message}`);
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

            // Fetch organizations from Zammad API
            try {
                const orgs = await zammadApi.getAllOrganizations();
                this.organizations = Array.isArray(orgs) ? orgs : [];
                logger.info(`Loaded ${this.organizations.length} organizations from API`);
            } catch (error) {
                logger.warn('Failed to load organizations, continuing without organization information:', error);
                this.organizations = [];
            }

            // Get tickets based on selected user filter
            let tickets;
            if (this.selectedUserId === 'all') {
                tickets = await zammadApi.getAllTickets();
                logger.info(`Loaded ${tickets ? tickets.length : 0} tickets from all users`);
            } else if (this.selectedUserId === 'me') {
                tickets = await zammadApi.getAssignedTickets();
                logger.info(`Loaded ${tickets ? tickets.length : 0} tickets assigned to current user`);
            } else if (this.selectedUserId === 'unassigned') {
                // Get all tickets and filter for unassigned ones
                tickets = await zammadApi.getAllTickets();
                if (Array.isArray(tickets)) {
                    tickets = tickets.filter(ticket => !ticket.owner_id && ticket.state_id !== 9); // Exclude merged tickets
                }
                logger.info(`Loaded ${tickets ? tickets.length : 0} unassigned tickets`);
            } else {
                tickets = await zammadApi.getAllTickets(this.selectedUserId);
                logger.info(`Loaded ${tickets ? tickets.length : 0} tickets for user ${this.selectedUserId}`);
            }

            // Store tickets
            this.tickets = Array.isArray(tickets) ? tickets : [];

            // Customer data enhancement is now handled automatically in the API layer
            // The tickets returned by getAssignedTickets() and getAllTickets() are already enhanced with customer data

            // Populate user filter with actual ticket owners
            await this.populateUserFilterFromTickets();

            // Update dashboard layout and process tickets
            this.updateDashboardLayout();
            this.processTickets();

            // Populate group filter from the active result set and apply current selection
            await this.populateGroupFilterFromTickets();
            this.applyGroupFilter();

            // Populate organization filter from the active result set and apply current selection
            await this.populateOrganizationFilterFromTickets();
            this.applyOrganizationFilter();

            this.hideLoading();

        } catch (error) {
            logger.error('Error loading tickets:', error);
            this.showError('Failed to load tickets: ' + error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Fetch first article content for all tickets
     */
    async fetchFirstArticleForTickets() {
        if (!this.tickets || this.tickets.length === 0) {
            return;
        }

        logger.info(`Fetching first article content for ${this.tickets.length} tickets`);

        // Process tickets in batches to avoid overwhelming the API
        const batchSize = 5;
        const batches = [];

        for (let i = 0; i < this.tickets.length; i += batchSize) {
            batches.push(this.tickets.slice(i, i + batchSize));
        }

        for (const batch of batches) {
            const promises = batch.map(async (ticket) => {
                try {
                    const articles = await zammadApi.getTicketArticles(ticket.id);
                    if (articles && articles.length > 0) {
                        // Get the first article (usually the original message)
                        const firstArticle = articles[0];
                        ticket.first_article_content = firstArticle.body || firstArticle.content || '';
                        logger.debug(`Added first article content to ticket ${ticket.id}`);
                    }
                } catch (error) {
                    logger.warn(`Failed to fetch articles for ticket ${ticket.id}:`, error);
                    // Continue with other tickets
                }
            });

            // Wait for current batch to complete before processing next batch
            await Promise.all(promises);
        }

        logger.info('Finished fetching article content for all tickets');
    }

    /**
     * Update dashboard layout based on current view
     */
    updateDashboardLayout() {
        logger.info(`Updating dashboard layout for ${this.currentView} view`);

        // Clear existing dashboard content
        this.dashboardContainer.innerHTML = '';

        // Update dashboard container class for agent view
        if (this.currentView === 'agent') {
            this.dashboardContainer.classList.add('agent-horizontal');
            // Show column visibility button
            if (this.columnVisibilityContainer) {
                this.columnVisibilityContainer.style.display = 'block';
            }
        } else {
            this.dashboardContainer.classList.remove('agent-horizontal');
            // Hide column visibility button
            if (this.columnVisibilityContainer) {
                this.columnVisibilityContainer.style.display = 'none';
            }
        }

        if (this.currentView === 'state') {
            this.setupStateView();
        } else if (this.currentView === 'agent') {
            this.setupAgentView();
        }
    }

    /**
     * Setup state-based view with status columns
     */
    setupStateView() {
        // Create state columns
        const stateColumns = [
            { id: 'newTickets', titleId: 'newColumnTitle', countId: 'newCount', title: 'New' },
            { id: 'openTickets', titleId: 'openColumnTitle', countId: 'openCount', title: 'Open' },
            { id: 'progressTickets', titleId: 'progressColumnTitle', countId: 'progressCount', title: 'In Progress' },
            { id: 'waitingTickets', titleId: 'waitingColumnTitle', countId: 'waitingCount', title: 'Waiting' },
            { id: 'closedTickets', titleId: 'closedColumnTitle', countId: 'closedCount', title: 'Closed' }
        ];

        stateColumns.forEach(column => {
            const columnElement = this.createColumnElement(column.id, column.titleId, column.countId, column.title);
            this.dashboardContainer.appendChild(columnElement);
        });

        // Re-reference DOM elements for state view
        this.newTickets = document.getElementById('newTickets');
        this.openTickets = document.getElementById('openTickets');
        this.progressTickets = document.getElementById('progressTickets');
        this.waitingTickets = document.getElementById('waitingTickets');
        this.closedTickets = document.getElementById('closedTickets');
        this.newCount = document.getElementById('newCount');
        this.openCount = document.getElementById('openCount');
        this.progressCount = document.getElementById('progressCount');
        this.waitingCount = document.getElementById('waitingCount');
        this.closedCount = document.getElementById('closedCount');

        // Re-initialize drag and drop for state view
        this.initDragAndDrop();
    }

    /**
     * Setup agent-based view with agent columns
     */
    setupAgentView() {
        // Get unique agents from tickets
        const agents = this.getUniqueAgents();
        
        agents.forEach(agent => {
            const columnId = `agent-${agent.id || 'unassigned'}`;
            const titleId = `agent-title-${agent.id || 'unassigned'}`;
            const countId = `agent-count-${agent.id || 'unassigned'}`;
            const columnElement = this.createColumnElement(columnId, titleId, countId, agent.name);
            
            // Check if this column should be hidden
            if (this.hiddenColumns.has(columnId)) {
                columnElement.classList.add('hidden');
            }
            
            this.dashboardContainer.appendChild(columnElement);
        });

        // Initialize drag and drop for agent view
        this.initAgentDragAndDrop();
    }

    /**
     * Create a column element for the dashboard
     */
    createColumnElement(columnId, titleId, countId, title) {
        const columnElement = document.createElement('div');
        columnElement.className = 'ticket-column';
        
        columnElement.innerHTML = `
            <div class="column-header">
                <span id="${titleId}">${title}</span>
                <span class="count" id="${countId}">0</span>
            </div>
            <div class="ticket-list" id="${columnId}"></div>
        `;
        
        // Add toggle button for agent view with proper event listener
        if (this.currentView === 'agent') {
            const header = columnElement.querySelector('.column-header');
            const toggleButton = document.createElement('button');
            toggleButton.className = 'column-toggle';
            toggleButton.innerHTML = '×';
            toggleButton.title = 'Spalte ausblenden';
            toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleColumn(columnId);
            });
            header.insertBefore(toggleButton, header.firstChild);
        }
        
        return columnElement;
    }

    /**
     * Get unique agents from current tickets
     */
    getUniqueAgents() {
        const agentMap = new Map();
        
        // Add unassigned category
        agentMap.set('unassigned', { id: null, name: 'Unassigned' });
        
        // Get unique agents from tickets
        this.tickets.forEach(ticket => {
            if (ticket.owner_id && !agentMap.has(ticket.owner_id)) {
                const agentName = this.getAgentName(ticket);
                // If agent name is '-' or 'NOT ASSIGNED', don't create a separate column for them
                if (agentName !== '-' && agentName !== 'NOT ASSIGNED') {
                    agentMap.set(ticket.owner_id, { id: ticket.owner_id, name: agentName });
                }
            }
        });
        
        return Array.from(agentMap.values());
    }

    /**
     * Get agent name from ticket
     */
    getAgentName(ticket) {
        // Try to get name from various ticket properties
        if (ticket.owner_data && ticket.owner_data.firstname && ticket.owner_data.lastname) {
            return `${ticket.owner_data.firstname} ${ticket.owner_data.lastname}`;
        }
        if (ticket.owner_data && ticket.owner_data.login) {
            return ticket.owner_data.login;
        }
        if (ticket.owner_name) {
            return ticket.owner_name;
        }
        // Use getUserDisplayName for consistent user name resolution
        if (ticket.owner_id) {
            return this.getUserDisplayName(ticket.owner_id);
        }
        return 'NOT ASSIGNED';
    }

    /**
     * Process tickets and categorize by status or agent based on current view
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

        // Filter tickets based on all active filters
        const filteredTickets = this.applyTicketFilters(this.tickets);
        logger.info(`Filtered to ${filteredTickets.length} tickets from ${this.tickets.length} total`);

        // Sort tickets by priority descending, then by updated_at descending
        const sortedTickets = filteredTickets.slice().sort((a, b) => {
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

        if (this.currentView === 'state') {
            this.processTicketsByState(sortedTickets);
        } else if (this.currentView === 'agent') {
            this.processTicketsByAgent(sortedTickets);
        }

        // Show dashboard
        this.dashboardContainer.style.display = 'grid';
    }

    /**
     * Process tickets organized by state
     */
    processTicketsByState(sortedTickets) {
        // Counters for each category
        let newCount = 0;
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
                case 'new':
                    this.newTickets.appendChild(ticketElement);
                    newCount++;
                    break;
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
        this.newCount.textContent = newCount;
        this.openCount.textContent = openCount;
        this.progressCount.textContent = progressCount;
        this.waitingCount.textContent = waitingCount;
        this.closedCount.textContent = closedCount;

        logger.info(`Displayed tickets: ${newCount} new, ${openCount} open, ${progressCount} in progress, ${waitingCount} waiting, ${closedCount} closed`);
    }

    /**
     * Process tickets organized by agent
     */
    processTicketsByAgent(sortedTickets) {
        const agents = this.getUniqueAgents();
        const agentCounts = new Map();

        // Initialize counters
        agents.forEach(agent => {
            agentCounts.set(agent.id || 'unassigned', 0);
        });

        // Process each ticket
        sortedTickets.forEach(ticket => {
            // Create ticket element
            const ticketElement = this.createTicketElement(ticket);

            // Determine which agent column to use
            // Check if the agent name is '-' or if there's no owner_id
            const agentName = this.getAgentName(ticket);
            let agentId;
            
            if (!ticket.owner_id || agentName === '-' || agentName === 'NOT ASSIGNED') {
                agentId = 'unassigned';
            } else {
                agentId = ticket.owner_id;
            }
            
            const columnId = `agent-${agentId}`;
            const container = document.getElementById(columnId);

            if (container) {
                container.appendChild(ticketElement);
                const currentCount = agentCounts.get(agentId) || 0;
                agentCounts.set(agentId, currentCount + 1);
            }
        });

        // Update counters
        agents.forEach(agent => {
            const agentId = agent.id || 'unassigned';
            const countElement = document.getElementById(`agent-count-${agentId}`);
            if (countElement) {
                countElement.textContent = agentCounts.get(agentId) || 0;
            }
        });

        const totalTickets = sortedTickets.length;
        logger.info(`Displayed ${totalTickets} tickets organized by agent`);
    }

    /**
     * Apply all active ticket filters
     */
    applyTicketFilters(tickets) {
        if (!tickets || tickets.length === 0) return [];

        let filtered = tickets.filter(ticket => {
            // Always filter out merged tickets (state_id === 9)
            if (ticket.state_id === 9) return false;

            // User filter
            if (this.selectedUserId !== 'all') {
                if (this.selectedUserId === 'me') {
                    // Filter for current user's tickets
                    const currentUserId = this.getCurrentUserId();
                    if (ticket.owner_id !== currentUserId) return false;
                } else if (this.selectedUserId === 'unassigned') {
                    // Filter for unassigned tickets
                    if (ticket.owner_id) return false;
                } else {
                    // Filter for specific user
                    if (ticket.owner_id.toString() !== this.selectedUserId) return false;
                }
            }

            // Group filter
            if (this.selectedGroup !== 'all') {
                if (ticket.group_id.toString() !== this.selectedGroup) return false;
            }

            // Organization filter
            if (this.selectedOrganization !== 'all') {
                const orgId = ticket.organization_id || (ticket.customer && ticket.customer.organization_id);
                if (this.selectedOrganization === 'none') {
                    // Filter for tickets with no organization
                    if (orgId) return false;
                } else {
                    // Filter for specific organization
                    if (!orgId || orgId.toString() !== this.selectedOrganization) return false;
                }
            }

            // Priority filter
            if (this.selectedPriority !== 'all') {
                const ticketPriority = ticket.priority_id || 2; // Default to normal priority
                if (ticketPriority.toString() !== this.selectedPriority) return false;
            }

            // State filter
            if (this.selectedState !== 'all') {
                const ticketCategory = this.getTicketCategory(ticket);
                if (ticketCategory !== this.selectedState) return false;
            }

            return true;
        });

        return filtered;
    }

    /**
     * Apply filters and refresh display
     */
    applyFilters() {
        logger.info('Applying filters and refreshing display');
        this.processTickets();
    }

    /**
     * Populate user filter dropdown with actual ticket owners
     */
    async populateUserFilterFromTickets() {
        const userFilter = document.getElementById('userFilter');
        if (!userFilter) return;

        // Get unique owner IDs from tickets
        const ownerIds = [...new Set(this.tickets.map(t => t.owner_id).filter(id => id))];

        // Check if there are unassigned tickets
        const hasUnassignedTickets = this.tickets.some(t => !t.owner_id);

        console.log(`Found ${ownerIds.length} unique ticket owners: ${ownerIds.join(', ')}`);
        if (hasUnassignedTickets) {
            console.log('Found unassigned tickets');
        }

        // Preserve current selection
        const currentSelection = userFilter.value;

        // Clear existing user options (keep "All", "Me", and "Unassigned")
        const optionsToRemove = Array.from(userFilter.options).filter(opt =>
            opt.value !== 'all' && opt.value !== 'me' && opt.value !== 'unassigned'
        );
        optionsToRemove.forEach(option => option.remove());

        // Add "Unassigned" option if there are unassigned tickets and it doesn't exist
        if (hasUnassignedTickets && !Array.from(userFilter.options).some(opt => opt.value === 'unassigned')) {
            const unassignedOption = document.createElement('option');
            unassignedOption.value = 'unassigned';
            unassignedOption.textContent = 'Unassigned';
            // Insert after "Me" option
            const meOption = Array.from(userFilter.options).find(opt => opt.value === 'me');
            if (meOption && meOption.nextSibling) {
                userFilter.insertBefore(unassignedOption, meOption.nextSibling);
            } else {
                userFilter.appendChild(unassignedOption);
            }
        }

        // Remove "Unassigned" option if there are no unassigned tickets
        if (!hasUnassignedTickets) {
            const unassignedOption = Array.from(userFilter.options).find(opt => opt.value === 'unassigned');
            if (unassignedOption) {
                unassignedOption.remove();
            }
        }

        if (ownerIds.length === 0 && !hasUnassignedTickets) {
            console.log('No ticket owners found');
            return;
        }

        // Fetch user information for all owners
        const userPromises = ownerIds.map(async (ownerId) => {
            try {
                // Check cache first
                if (this.userCache && this.userCache.has(ownerId)) {
                    return {id: ownerId, name: this.userCache.get(ownerId)};
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

                    return {id: ownerId, name: fullName};
                } else {
                    return {id: ownerId, name: `User ${ownerId}`};
                }
            } catch (error) {
                console.error(`Failed to fetch user ${ownerId}:`, error);
                return {id: ownerId, name: `User ${ownerId}`};
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
        this.tickets.forEach(t => {
            if (t.group_id) groupIds.add(String(t.group_id));
        });

        // Build list of group options from this.groups using IDs present in tickets
        const groupsById = new Map((this.groups || []).map(g => [String(g.id), g]));
        const options = [];

        // Special: include No Group if present in result set
        if (nonePresent) {
            options.push({value: 'none', name: 'No Group'});
        }

        groupIds.forEach(id => {
            const g = groupsById.get(id);
            if (g && g.name) {
                options.push({value: id, name: g.name});
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
        
        // Restore saved filter settings now that both filters are populated
        await this.restoreFilterSettings();
    }

    /**
     * Apply current group filter to the displayed tickets and update counts
     */
    applyGroupFilter() {
        if (!this.groupFilter) return;
        const selectedGroup = this.groupFilter.value || 'all';
        const selectedOrg = this.organizationFilter ? (this.organizationFilter.value || 'all') : 'all';

        const lists = [this.newTickets, this.openTickets, this.progressTickets, this.waitingTickets, this.closedTickets];
        lists.forEach(list => {
            if (!list) return;
            const items = list.querySelectorAll('.ticket-item');
            items.forEach(item => {
                const itemGroupId = item.getAttribute('data-group-id') || 'none';
                const itemOrgId = item.getAttribute('data-organization-id') || 'none';
                const groupMatch = (selectedGroup === 'all') ? true : (itemGroupId === selectedGroup);
                const orgMatch = (selectedOrg === 'all') ? true : (itemOrgId === selectedOrg);
                item.style.display = (groupMatch && orgMatch) ? '' : 'none';
            });
        });

        this.updateCountsFromDOM();
    }

    /**
     * Apply current organization filter to the displayed tickets and update counts
     */
    applyOrganizationFilter() {
        if (!this.organizationFilter) return;
        const selectedOrg = this.organizationFilter.value || 'all';
        const selectedGroup = this.groupFilter ? (this.groupFilter.value || 'all') : 'all';

        const lists = [this.newTickets, this.openTickets, this.progressTickets, this.waitingTickets, this.closedTickets];
        lists.forEach(list => {
            if (!list) return;
            const items = list.querySelectorAll('.ticket-item');
            items.forEach(item => {
                const itemOrgId = item.getAttribute('data-organization-id') || 'none';
                const itemGroupId = item.getAttribute('data-group-id') || 'none';
                const orgMatch = (selectedOrg === 'all') ? true : (itemOrgId === selectedOrg);
                const groupMatch = (selectedGroup === 'all') ? true : (itemGroupId === selectedGroup);
                item.style.display = (groupMatch && orgMatch) ? '' : 'none';
            });
        });

        this.updateCountsFromDOM();
    }

    /**
     * Recalculate and set column counters based on currently visible tickets
     */
    updateCountsFromDOM() {
        const countVisible = (list) => list ? Array.from(list.querySelectorAll('.ticket-item')).filter(it => it.style.display !== 'none').length : 0;
        this.newCount.textContent = String(countVisible(this.newTickets));
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
        if (stateId === 1) { // new
            return 'new';
        }
        if (stateId === 4) { // open
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

        if (userName.trim() === '-' || userName === undefined || userName === null) {
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

        // Get organization information
        let organizationName = '';
        if (ticket.organization_id && this.organizations && this.organizations.length > 0) {
            const org = this.organizations.find(o => o.id == ticket.organization_id);
            if (org) {
                organizationName = org.name || '';
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
        if (ticket.organization_id) {
            ticketItem.setAttribute('data-organization-id', String(ticket.organization_id));
        } else {
            ticketItem.setAttribute('data-organization-id', 'none');
        }
        ticketItem.setAttribute('data-organization-name', organizationName || 'No Organization');
        ticketItem.setAttribute('data-selectable', 'true');
        ticketItem.setAttribute('draggable', 'true');

        // Add special styling for unassigned tickets
        if (userName === 'NOT ASSIGNED') {
            ticketItem.classList.add('not-assigned');
        }

        // Add special styling for tickets created today
        if (this.isTicketCreatedToday(ticket)) {
            ticketItem.classList.add('new-today');
        }

        // Add special styling for tickets older than 180 days
        if (this.isTicketOld(ticket)) {
            ticketItem.classList.add('ticket-old');
        }

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
<!--            <span class="ticket-item-organization">${organizationName ? `${organizationName}` : 'No Organization'}</span>-->
        </div>
        <div class="ticket-row-3">
            <span class="ticket-item-user">${userName || `User #${ticketId}`}</span>
            <span class="ticket-updated">${updated_at}</span>
            <span class="ticket-item-priority ${this.getPriorityClass(ticketPriority)}">${ticketPriority}</span>
        </div>
    `;

        // Add hover tooltip functionality
        let tooltipElement = null;
        let hoverTimeout = null;

        ticketItem.addEventListener('mouseenter', (event) => {
            // Clear any existing timeout
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }

            // Show tooltip after a brief delay
            hoverTimeout = setTimeout(() => {
                this.showTicketTooltip(event.target, ticket);
            }, 500); // 500ms delay before showing tooltip
        });

        ticketItem.addEventListener('mouseleave', (event) => {
            // Clear timeout if mouse leaves before delay
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }

            // Hide tooltip
            this.hideTicketTooltip();
        });

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
     * Show tooltip with ticket details on hover
     * @param {HTMLElement} ticketElement - The ticket element being hovered
     * @param {Object} ticket - The ticket data object
     */
    async showTicketTooltip(ticketElement, ticket) {
        // Remove any existing tooltip
        this.hideTicketTooltip();

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'ticket-tooltip enhanced-tooltip';
        tooltip.id = 'ticket-tooltip';

        // Get ticket details for tooltip
        const ticketId = ticket.id || ticket.number || 'N/A';
        const ticketTitle = ticket.title || 'No title available';
        const ticketState = ticket.state || ticket.state_id || 'Unknown';
        const ticketPriority = this.getTicketPriority(ticket);

        // Get formatted dates
        let updatedDate = ticket.updated_at || ticket.updatedAt || 'Unknown';
        let createdDate = ticket.created_at || ticket.createdAt || 'Unknown';

        if (updatedDate && updatedDate !== 'Unknown') {
            try {
                const dateObj = new Date(updatedDate);
                if (!isNaN(dateObj)) {
                    updatedDate = dateObj.toLocaleString('de-DE', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                    });
                }
            } catch (e) {
                // Keep original value
            }
        }

        if (createdDate && createdDate !== 'Unknown') {
            try {
                const dateObj = new Date(createdDate);
                if (!isNaN(dateObj)) {
                    createdDate = dateObj.toLocaleString('de-DE', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                    });
                }
            } catch (e) {
                // Keep original value
            }
        }

        // Get user and group info
        let userName = 'Not assigned';
        if (ticket.owner_data && ticket.owner_data.fullname) {
            userName = ticket.owner_data.fullname;
        } else if (ticket.owner_id) {
            const user = this.users.find(u => u.id == ticket.owner_id);
            if (user) {
                userName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.login || user.email || `User ${user.id}`;
            }
        }

        let groupName = 'No Group';
        if (ticket.group_id && this.groups && this.groups.length > 0) {
            const group = this.groups.find(g => g.id == ticket.group_id);
            if (group) {
                groupName = group.name || 'No Group';
            }
        }

        // Get organization info
        let organizationName = 'No Organization';
        if (ticket.organization_id && this.organizations && this.organizations.length > 0) {
            const org = this.organizations.find(o => o.id == ticket.organization_id);
            if (org) {
                organizationName = org.name || 'No Organization';
            }
        }

        // Get customer info with debugging
        let customerName = 'Unknown Customer';
        let customerEmail = '';
        console.log(`Tooltip for ticket ${ticketId}: customer_id=${ticket.customer_id}, customer_data=`, ticket.customer_data, 'customer=', ticket.customer);

        if (ticket.customer_id || ticket.customer) {
            if (ticket.customer_data) {
                const customer = ticket.customer_data;
                customerName = `${customer.firstname || ''} ${customer.lastname || ''}`.trim() || customer.login || customer.email || 'Unknown Customer';
                customerEmail = customer.email || '';
                console.log(`Using customer_data: name=${customerName}, email=${customerEmail}`);
            } else if (ticket.customer && typeof ticket.customer === 'object') {
                const customer = ticket.customer;
                customerName = `${customer.firstname || ''} ${customer.lastname || ''}`.trim() || customer.login || customer.email || 'Unknown Customer';
                customerEmail = customer.email || '';
            }
        }

        // Calculate ticket age
        let ticketAge = '';
        if (createdDate && createdDate !== 'Unknown') {
            try {
                const created = new Date(ticket.created_at || ticket.createdAt);
                const now = new Date();
                const diffMs = now - created;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                if (diffDays > 0) {
                    ticketAge = `${diffDays} day${diffDays > 1 ? 's' : ''} ${diffHours > 0 ? `${diffHours}h` : ''}`;
                } else if (diffHours > 0) {
                    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    ticketAge = `${diffHours}h ${diffMinutes > 0 ? `${diffMinutes}m` : ''}`;
                } else {
                    const diffMinutes = Math.floor(diffMs / (1000 * 60));
                    ticketAge = `${diffMinutes}m`;
                }
                ticketAge = ticketAge.trim() + ' ago';
            } catch (e) {
                ticketAge = 'Unknown age';
            }
        }

        // Fetch article content and additional details if not already cached
        let firstArticleContent = '';
        let lastArticleContent = '';
        let articleCount = 0;
        let articleSummary = '';
        let hasAttachments = false;

        if (!ticket.enhanced_content_cache && ticket.id) {
            try {
                const articles = await zammadApi.getTicketArticles(ticket.id);
                if (articles && articles.length > 0) {
                    articleCount = articles.length;

                    // Process first article (original request)
                    const firstArticle = articles[0];
                    const firstContent = firstArticle.body || firstArticle.content || '';
                    let processedFirstContent = firstContent.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '').trim();
                    if (processedFirstContent.length > 400) {
                        processedFirstContent = processedFirstContent.substring(0, 400) + '...';
                    }
                    firstArticleContent = processedFirstContent;

                    // Process last article if there are multiple articles
                    if (articles.length > 1) {
                        const lastArticle = articles[articles.length - 1];
                        const lastContent = lastArticle.body || lastArticle.content || '';
                        let processedLastContent = lastContent.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '').trim();
                        if (processedLastContent.length > 300) {
                            processedLastContent = processedLastContent.substring(0, 300) + '...';
                        }
                        lastArticleContent = processedLastContent;
                    }

                    // Check for attachments across all articles
                    hasAttachments = articles.some(article =>
                        article.attachments && article.attachments.length > 0
                    );

                    // Create article summary
                    const publicArticles = articles.filter(article => !article.internal);
                    const internalArticles = articles.filter(article => article.internal);
                    const customerArticles = articles.filter(article =>
                        article.type_id === 1 || article.from && article.from.includes('@')
                    );

                    let summaryParts = [];
                    if (publicArticles.length > 0) {
                        summaryParts.push(`${publicArticles.length} public`);
                    }
                    if (internalArticles.length > 0) {
                        summaryParts.push(`${internalArticles.length} internal`);
                    }
                    if (customerArticles.length > 0) {
                        summaryParts.push(`${customerArticles.length} from customer`);
                    }

                    articleSummary = summaryParts.length > 0 ? summaryParts.join(', ') : `${articleCount} total`;

                    // Cache the enhanced content
                    ticket.enhanced_content_cache = {
                        firstArticleContent,
                        lastArticleContent,
                        articleCount,
                        articleSummary,
                        hasAttachments
                    };
                }
            } catch (error) {
                logger.warn(`Failed to fetch articles for ticket ${ticket.id}:`, error);
                firstArticleContent = 'Failed to load content';
            }
        } else if (ticket.enhanced_content_cache) {
            // Use cached enhanced content
            const cache = ticket.enhanced_content_cache;
            firstArticleContent = cache.firstArticleContent || '';
            lastArticleContent = cache.lastArticleContent || '';
            articleCount = cache.articleCount || 0;
            articleSummary = cache.articleSummary || '';
            hasAttachments = cache.hasAttachments || false;
        }

        // Build tooltip content with enhanced information
        tooltip.innerHTML = `
            <div class="ticket-tooltip-header">
                <div class="ticket-tooltip-title">${ticketTitle}</div>
                <div class="ticket-tooltip-id">#${ticketId}</div>
            </div>
            <div class="ticket-tooltip-body">
                <div class="ticket-tooltip-section">
                    <div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">State:</span>
                        <span class="ticket-tooltip-value state-${this.getTicketCategory(ticket)}">${ticketState}</span>
                    </div>
                    <div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">Priority:</span>
                        <span class="ticket-tooltip-value ${this.getPriorityClass(ticketPriority)}">${ticketPriority}</span>
                    </div>
                    <div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">Age:</span>
                        <span class="ticket-tooltip-value">${ticketAge}</span>
                    </div>
                </div>

                <div class="ticket-tooltip-section">
                    <div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">Assigned to:</span>
                        <span class="ticket-tooltip-value">${userName}</span>
                    </div>
                    <div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">Group:</span>
                        <span class="ticket-tooltip-value">${groupName}</span>
                    </div>
                    ${organizationName !== 'No Organization' ? `<div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">Organization:</span>
                        <span class="ticket-tooltip-value">${organizationName}</span>
                    </div>` : ''}
                </div>

                <div class="ticket-tooltip-section">
                    <div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">Customer:</span>
                        <span class="ticket-tooltip-value">${customerName}</span>
                    </div>
                    ${customerEmail ? `<div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">Email:</span>
                        <span class="ticket-tooltip-value">${customerEmail}</span>
                    </div>` : ''}
                </div>

                <div class="ticket-tooltip-section">
                    <div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">Created:</span>
                        <span class="ticket-tooltip-value">${createdDate}</span>
                    </div>
                    <div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">Updated:</span>
                        <span class="ticket-tooltip-value">${updatedDate}</span>
                    </div>
                    ${articleCount > 0 ? `<div class="ticket-tooltip-field">
                        <span class="ticket-tooltip-label">Articles:</span>
                        <span class="ticket-tooltip-value">${articleCount} (${articleSummary}) ${hasAttachments ? '📎' : ''}</span>
                    </div>` : ''}
                </div>

                ${firstArticleContent ? `<div class="ticket-tooltip-section content-section">
                    <div class="ticket-tooltip-field content-field">
                        <span class="ticket-tooltip-label">Original Request:</span>
                        <div class="ticket-tooltip-content original-content">${firstArticleContent}</div>
                    </div>
                    ${lastArticleContent && lastArticleContent !== firstArticleContent ? `<div class="ticket-tooltip-field content-field">
                        <span class="ticket-tooltip-label">Latest Update:</span>
                        <div class="ticket-tooltip-content latest-content">${lastArticleContent}</div>
                    </div>` : ''}
                </div>` : ''}
            </div>
        `;

        // Add to document
        document.body.appendChild(tooltip);

        // Highlight the ticket
        ticketElement.classList.add('tooltip-highlighted');

        // Position tooltip
        this.positionTooltip(tooltip, ticketElement);

        // Show with animation
        requestAnimationFrame(() => {
            tooltip.classList.add('visible');
        });
    }

    /**
     * Hide the ticket tooltip
     */
    hideTicketTooltip() {
        const existingTooltip = document.getElementById('ticket-tooltip');
        if (existingTooltip) {
            existingTooltip.classList.remove('visible');
            setTimeout(() => {
                if (existingTooltip.parentNode) {
                    existingTooltip.parentNode.removeChild(existingTooltip);
                }
            }, 200); // Match transition duration
        }

        // Remove highlighting from all tickets
        const highlightedTickets = document.querySelectorAll('.tooltip-highlighted');
        highlightedTickets.forEach(ticket => {
            ticket.classList.remove('tooltip-highlighted');
        });
    }

    /**
     * Position tooltip to the side of the ticket element to avoid covering it
     * @param {HTMLElement} tooltip - The tooltip element
     * @param {HTMLElement} ticketElement - The ticket element
     */
    positionTooltip(tooltip, ticketElement) {
        const ticketRect = ticketElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        // Initial positioning - make tooltip visible to get its dimensions
        tooltip.style.visibility = 'hidden';
        tooltip.style.display = 'block';

        const tooltipRect = tooltip.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width;
        const tooltipHeight = tooltipRect.height;

        const margin = 20; // Margin from viewport edges
        const gap = 15; // Gap between ticket and tooltip

        let left, top;
        let arrowPosition = 'left'; // Default arrow pointing left (tooltip on right side)

        // Try positioning to the right of the ticket first
        const rightPosition = ticketRect.right + gap;
        if (rightPosition + tooltipWidth + margin <= viewportWidth) {
            // Enough space on the right
            left = rightPosition;
            arrowPosition = 'left';
        } else {
            // Try positioning to the left of the ticket
            const leftPosition = ticketRect.left - tooltipWidth - gap;
            if (leftPosition >= margin) {
                // Enough space on the left
                left = leftPosition;
                arrowPosition = 'right';
            } else {
                // Not enough space on either side, position below but offset to avoid covering
                if (ticketRect.left + tooltipWidth + margin <= viewportWidth) {
                    // Position to the right edge of the ticket
                    left = ticketRect.right - tooltipWidth;
                } else {
                    // Position to the left edge of the ticket
                    left = ticketRect.left;
                }
                // Ensure it doesn't go off screen
                left = Math.max(margin, Math.min(left, viewportWidth - tooltipWidth - margin));
                arrowPosition = 'top';
            }
        }

        // Vertical positioning
        if (arrowPosition === 'left' || arrowPosition === 'right') {
            // Positioning to the side - center vertically relative to ticket
            top = ticketRect.top + (ticketRect.height / 2) - (tooltipHeight / 2);

            // Ensure tooltip doesn't go off screen vertically
            if (top < margin) {
                top = margin;
            } else if (top + tooltipHeight > viewportHeight - margin) {
                top = viewportHeight - tooltipHeight - margin;
            }
        } else {
            // Positioning below - place below ticket
            top = ticketRect.bottom + gap;

            // If it goes off the bottom, try above
            if (top + tooltipHeight > viewportHeight - margin) {
                const topAlternative = ticketRect.top - tooltipHeight - gap;
                if (topAlternative >= margin) {
                    top = topAlternative;
                    arrowPosition = 'bottom';
                } else {
                    // Keep below but adjust
                    top = Math.max(margin, viewportHeight - tooltipHeight - margin);
                }
            }
        }

        // Convert to absolute positioning (account for scroll)
        const absoluteLeft = left + scrollX;
        const absoluteTop = top + scrollY;

        // Apply positioning
        tooltip.style.position = 'absolute';
        tooltip.style.left = `${absoluteLeft}px`;
        tooltip.style.top = `${absoluteTop}px`;
        tooltip.style.visibility = 'visible';

        // Calculate arrow position for side positioning
        let arrowTop = 50; // Default center
        if (arrowPosition === 'left' || arrowPosition === 'right') {
            // Calculate where the arrow should point relative to the tooltip
            const ticketCenter = ticketRect.top + (ticketRect.height / 2);
            const tooltipTopPosition = top;
            arrowTop = Math.max(15, Math.min(85, ((ticketCenter - tooltipTopPosition) / tooltipHeight) * 100));
        }

        // Update arrow position using CSS custom properties
        tooltip.style.setProperty('--arrow-position', arrowPosition);
        tooltip.style.setProperty('--arrow-top', `${arrowTop}%`);

        // Add class for arrow positioning
        tooltip.className = tooltip.className.replace(/arrow-(top|bottom|left|right)/g, '');
        tooltip.classList.add(`arrow-${arrowPosition}`);

        logger.debug(`Positioned tooltip at (${absoluteLeft}, ${absoluteTop}) with arrow ${arrowPosition} at ${arrowTop}%`);
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

    /**
     * Get current user ID from the API
     * @returns {string|number|null} Current user ID
     */
    getCurrentUserId() {
        return zammadApi && zammadApi.currentUserId ? zammadApi.currentUserId : null;
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
            const userElement = element.querySelector('.ticket-item-user');
            if (userElement) {
                userElement.textContent = userName;
            }
        });
    }

    /**
     * Check if a ticket was created today
     * @param {Object} ticket - Ticket object
     * @returns {boolean} True if ticket was created today
     */
    isTicketCreatedToday(ticket) {
        if (!ticket.created_at) {
            return false;
        }

        try {
            const createdDate = new Date(ticket.created_at);
            const today = new Date();
            
            // Compare year, month, and day
            return (
                createdDate.getFullYear() === today.getFullYear() &&
                createdDate.getMonth() === today.getMonth() &&
                createdDate.getDate() === today.getDate()
            );
        } catch (error) {
            logger.warn(`Failed to parse created_at date for ticket ${ticket.id}:`, error);
            return false;
        }
    }

    /**
     * Check if a ticket is older than 180 days (not updated in 180+ days)
     * Excludes tickets with "closed" state
     * @param {Object} ticket - Ticket object
     * @returns {boolean} True if ticket hasn't been updated in 180+ days and is not closed
     */
    isTicketOld(ticket) {
        const updated_at = ticket.updated_at || ticket.updatedAt;
        if (!updated_at) {
            return false;
        }

        // Don't highlight closed tickets (state_id 2, 3, or 9)
        const stateId = ticket.state_id || ticket.state;
        if (stateId === 2 || // closed successful
            stateId === 3 || // closed unsuccessful
            stateId === 9) { // merged
            return false;
        }

        try {
            const updatedDate = new Date(updated_at);
            const now = new Date();
            const daysDiff = Math.floor((now - updatedDate) / (1000 * 60 * 60 * 24));
            
            return daysDiff >= 180;
        } catch (error) {
            logger.warn(`Failed to parse updated_at date for ticket ${ticket.id}:`, error);
            return false;
        }
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
        this.newTickets.innerHTML = '';
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

        this.newTickets.innerHTML = emptyState;
        this.openTickets.innerHTML = emptyState;
        this.progressTickets.innerHTML = emptyState;
        this.waitingTickets.innerHTML = emptyState;
        this.closedTickets.innerHTML = emptyState;

        // Update counters
        this.newCount.textContent = '0';
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

    /**
     * Save current filter settings to local storage
     */
    async saveFilterSettings() {
        try {
            const filterSettings = {
                selectedUserId: this.selectedUserId,
                selectedGroup: this.selectedGroup,
                selectedOrganization: this.selectedOrganization
            };
            
            await storage.save('dashboardFilterSettings', filterSettings);
            logger.info('Filter settings saved:', filterSettings);
        } catch (error) {
            logger.error('Error saving filter settings:', error);
        }
    }

    /**
     * Restore filter settings from local storage
     */
    async restoreFilterSettings() {
        try {
            const filterSettings = await storage.load('dashboardFilterSettings', {
                selectedUserId: 'all',
                selectedGroup: 'all',
                selectedOrganization: 'all'
            });
            
            logger.info('Filter settings restored:', filterSettings);
            
            // Apply restored settings
            this.selectedUserId = filterSettings.selectedUserId || 'all';
            this.selectedGroup = filterSettings.selectedGroup || 'all';
            this.selectedOrganization = filterSettings.selectedOrganization || 'all';
            
            // Update UI elements if they exist
            if (this.userFilter) {
                this.userFilter.value = this.selectedUserId;
            }
            if (this.groupFilter) {
                this.groupFilter.value = this.selectedGroup;
            }
            if (this.organizationFilter) {
                this.organizationFilter.value = this.selectedOrganization;
            }
        } catch (error) {
            logger.error('Error restoring filter settings:', error);
            // Fall back to defaults if restoration fails
            this.selectedUserId = 'all';
            this.selectedGroup = 'all';
            this.selectedOrganization = 'all';
        }
    }

    async populateOrganizationFilterFromTickets() {
        if (!this.organizationFilter) return;

        // Collect unique organization IDs from active tickets
        const organizationIds = new Set();
        const nonePresent = this.tickets.some(t => !t.organization_id);
        this.tickets.forEach(t => {
            if (t.organization_id) organizationIds.add(String(t.organization_id));
        });

        // Build list of organization options from this.organizations using IDs present in tickets
        const organizationsById = new Map((this.organizations || []).map(o => [String(o.id), o]));
        const options = [];

        // Special: include No Organization if present in result set
        if (nonePresent) {
            options.push({value: 'none', name: 'No Organization'});
        }

        organizationIds.forEach(id => {
            const org = organizationsById.get(id);
            if (org && org.name) {
                options.push({value: id, name: org.name});
            }
        });

        // Sort by name
        options.sort((a, b) => a.name.localeCompare(b.name));

        // Preserve current selection
        const currentSelection = this.organizationFilter.value || 'all';

        // Clear existing dynamic options (keep 'all')
        const toRemove = Array.from(this.organizationFilter.options).filter(opt => opt.value !== 'all');
        toRemove.forEach(opt => opt.remove());

        // Add new options
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.name;
            this.organizationFilter.appendChild(o);
        });

        // Restore selection if still available; otherwise reset to 'all'
        if (currentSelection && Array.from(this.organizationFilter.options).some(opt => opt.value === currentSelection)) {
            this.organizationFilter.value = currentSelection;
        } else {
            this.organizationFilter.value = 'all';
            this.selectedOrganization = 'all';
        }
    }

    /**
     * Toggle column visibility in agent view
     */
    toggleColumn(columnId) {
        const ticketList = document.getElementById(columnId);
        if (!ticketList) {
            logger.error(`Column with ID ${columnId} not found`);
            return;
        }
        
        const column = ticketList.parentElement; // This is the .ticket-column div
        
        if (this.hiddenColumns.has(columnId)) {
            // Show column
            column.classList.remove('hidden');
            this.hiddenColumns.delete(columnId);
            logger.info(`Showed column ${columnId}`);
        } else {
            // Hide column
            column.classList.add('hidden');
            this.hiddenColumns.add(columnId);
            logger.info(`Hidden column ${columnId}`);
        }
        
        logger.info(`Hidden columns: ${Array.from(this.hiddenColumns)}`);
        
        // Update column visibility button text
        this.updateColumnVisibilityButton();
    }

    /**
     * Update column visibility button text based on hidden columns
     */
    updateColumnVisibilityButton() {
        if (!this.columnVisibilityText || this.currentView !== 'agent') return;
        
        const hiddenCount = this.hiddenColumns.size;
        if (hiddenCount === 0) {
            this.columnVisibilityText.textContent = 'Alle Spalten sichtbar';
            if (this.columnVisibilityBtn) {
                this.columnVisibilityBtn.disabled = true;
            }
        } else {
            this.columnVisibilityText.textContent = `${hiddenCount} Spalte${hiddenCount > 1 ? 'n' : ''} versteckt`;
            if (this.columnVisibilityBtn) {
                this.columnVisibilityBtn.disabled = false;
            }
        }
    }

    /**
     * Show column visibility menu as dropdown
     */
    showColumnVisibilityMenu() {
        // Remove existing menu if any
        const existingMenu = document.getElementById('columnVisibilityMenu');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }

        // Get all agent columns (both visible and hidden)
        const agents = this.getUniqueAgents();
        
        if (agents.length === 0) {
            logger.warn('No agents found for column visibility menu');
            return;
        }

        // Create dropdown menu
        const menu = document.createElement('div');
        menu.id = 'columnVisibilityMenu';
        menu.className = 'column-visibility-menu';
        
        let menuItems = '<div class="menu-header">Spalten ein-/ausblenden:</div>';
        
        agents.forEach(agent => {
            const columnId = `agent-${agent.id || 'unassigned'}`;
            const isHidden = this.hiddenColumns.has(columnId);
            const checked = isHidden ? '' : 'checked';
            
            menuItems += `
                <label class="menu-item">
                    <input type="checkbox" ${checked} data-column-id="${columnId}">
                    <span>${agent.name}</span>
                </label>
            `;
        });
        
        menuItems += `
            <div class="menu-actions">
                <button class="menu-btn" onclick="dashboard.showAllColumns()">Alle anzeigen</button>
                <button class="menu-btn" onclick="dashboard.closeColumnVisibilityMenu()">Schließen</button>
            </div>
        `;
        
        menu.innerHTML = menuItems;
        
        // Position menu relative to button
        const btnRect = this.columnVisibilityBtn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${btnRect.bottom + 5}px`;
        menu.style.left = `${btnRect.left}px`;
        menu.style.zIndex = '1000';
        
        // Add to document
        document.body.appendChild(menu);
        
        // Add event listeners to checkboxes
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const columnId = e.target.getAttribute('data-column-id');
                const shouldShow = e.target.checked;
                
                if (shouldShow && this.hiddenColumns.has(columnId)) {
                    // Show column
                    this.toggleColumn(columnId);
                } else if (!shouldShow && !this.hiddenColumns.has(columnId)) {
                    // Hide column
                    this.toggleColumn(columnId);
                }
            });
        });
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.closeColumnMenuOnClickOutside.bind(this));
        }, 100);
    }

    /**
     * Close column visibility menu when clicking outside
     */
    closeColumnMenuOnClickOutside(event) {
        const menu = document.getElementById('columnVisibilityMenu');
        if (menu && !menu.contains(event.target) && !this.columnVisibilityBtn.contains(event.target)) {
            this.closeColumnVisibilityMenu();
        }
    }

    /**
     * Close column visibility menu
     */
    closeColumnVisibilityMenu() {
        const menu = document.getElementById('columnVisibilityMenu');
        if (menu) {
            menu.remove();
            document.removeEventListener('click', this.closeColumnMenuOnClickOutside.bind(this));
        }
    }

    /**
     * Show all hidden columns
     */
    showAllColumns() {
        const hiddenColumnsCopy = new Set(this.hiddenColumns);
        hiddenColumnsCopy.forEach(columnId => {
            this.toggleColumn(columnId);
        });
        this.closeColumnVisibilityMenu();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Enable debug mode in logger if needed
    // logger.enableDebug();

    // Create dashboard instance
    window.dashboard = new ZammadDashboard();
});
