/**
 * Dashboard for Zammad Tickets
 * Displays tickets in a GitLab-like board with columns for different statuses
 */

class ZammadDashboard {
    constructor() {
        logger.info('Initializing Zammad Dashboard');

        try {
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
        this.optionsBtn = document.getElementById('optionsBtn');

        // Time tracking elements
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.ticketInfo = document.getElementById('ticketInfo');
        this.ticketTitle = document.getElementById('ticketTitle');
        this.ticketId = document.getElementById('ticketId');
        this.timeSpent = document.getElementById('timeSpent');
        this.timerDisplay = document.getElementById('timerDisplay');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');

        // Context menu elements
        this.contextMenu = document.getElementById('contextMenu');
        this.startTrackingItem = document.getElementById('startTrackingItem');
        this.stopTrackingItem = document.getElementById('stopTrackingItem');
        this.editTimeTrackingItem = document.getElementById('editTimeTrackingItem');
        this.currentTicketElement = null;

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
        this.versionDisplay = document.getElementById('versionDisplay');
        this.refreshBtnText = document.getElementById('refreshBtnText');
        this.optionsBtnText = document.getElementById('optionsBtnText');
        this.loadingText = document.getElementById('loadingText');
        this.newColumnTitle = document.getElementById('newColumnTitle');
        this.openColumnTitle = document.getElementById('openColumnTitle');
        this.progressColumnTitle = document.getElementById('progressColumnTitle');
        this.waitingColumnTitle = document.getElementById('waitingColumnTitle');
        this.closedColumnTitle = document.getElementById('closedColumnTitle');

        // Context menu text elements
        this.startTrackingText = document.getElementById('startTrackingText');
        this.stopTrackingText = document.getElementById('stopTrackingText');
        this.editTimeTrackingText = document.getElementById('editTimeTrackingText');

        // Debug context menu elements
        console.log('Context menu elements found:', {
            contextMenu: !!this.contextMenu,
            startTrackingItem: !!this.startTrackingItem,
            stopTrackingItem: !!this.stopTrackingItem,
            editTimeTrackingItem: !!this.editTimeTrackingItem,
            startTrackingText: !!this.startTrackingText,
            stopTrackingText: !!this.stopTrackingText,
            editTimeTrackingText: !!this.editTimeTrackingText
        });

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

        // Time tracking state
        this.isTracking = false;
        this.startTime = null;
        this.timerInterval = null;
        this.currentTicketId = null;
        this.currentTicketTitle = null;
        this.currentTimeSpent = 0;

        // Initialize
        this.updateUILanguage();
        this.initEventListeners();
        this.initializeApi();
        this.initDragAndDrop();
        this.initTimeTracking();

        // Auto-refresh setup
        this.autoRefreshTimer = null;
        this.autoRefreshSec = 0;
        this.initAutoRefresh();

        // Always show the dashboard UI, even if there are initialization errors
        this.showDashboard();

        } catch (error) {
            logger.error('Failed to initialize dashboard:', error);
            console.error('Dashboard initialization failed:', error);

            // Always show the dashboard UI, even on error
            this.showDashboard();

            // Show error message to user
            if (this.errorContainer) {
                this.errorContainer.textContent = 'Failed to load dashboard: ' + error.message;
                this.errorContainer.style.display = 'block';
            }
        }
    }

    /**
     * Show dashboard UI (hide loading, show dashboard container)
     */
    showDashboard() {
        try {
            if (this.loadingContainer) {
                this.loadingContainer.style.display = 'none';
            }
            if (this.dashboardContainer) {
                this.dashboardContainer.style.display = 'flex';
            }
            logger.info('Dashboard UI displayed');
        } catch (error) {
            logger.error('Failed to show dashboard UI:', error);
        }
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
        this.optionsBtnText.textContent = t('api_options') || 'Options';
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

        // Context menu text
        if (this.startTrackingText) {
            this.startTrackingText.textContent = t('start_tracking_text');
        }
        if (this.stopTrackingText) {
            this.stopTrackingText.textContent = t('stop_tracking_text');
        }
        if (this.editTimeTrackingText) {
            this.editTimeTrackingText.textContent = t('edit_time_tracking_text');
        }

        logger.info('UI language updated');
    }

    /**
     * Update dashboard title with version from manifest
     */
    async updateDashboardTitle() {
        try {
            const manifest = chrome.runtime.getManifest();
            const version = manifest.version;
            this.versionDisplay.textContent = `v${version}`;
        } catch (error) {
            logger.error('Failed to get version from manifest:', error);
            this.versionDisplay.textContent = 'v?.?.?';
        }
        // Set dashboard title to translated text
        this.dashboardTitle.textContent = t('dashboard_title');
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

        // Handle page visibility changes - persist time tracking across tab switches
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden) {
                // Page is hidden (tab switched away or browser minimized)
                logger.info('Page hidden - ensuring time tracking state is saved');
                if (this.isTracking) {
                    this.saveTrackingState();
                }
            } else {
                // Page is visible again
                logger.info('Page visible - continuing time tracking if active');
                if (this.isTracking) {
                    // Resume timer display updates
                    this.startTimer();
                }
                // Check for updated tracking states when returning to the page
                await this.highlightAllActiveTrackingTickets();
            }
        });

        // Ensure time tracking persists on page navigation attempts
        window.addEventListener('beforeunload', (event) => {
            if (this.isTracking) {
                // Save state before page unloads
                this.saveTrackingState();
                logger.info('Page unloading - time tracking state saved');
            }
        });
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

        // Options button
        this.optionsBtn.addEventListener('click', () => {
            logger.info('Options button clicked');
            this.openOptions();
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
                this.saveFilterSettings();
                this.applyFilters();
            });
        }

        // State filter change
        if (this.stateFilter) {
            this.stateFilter.addEventListener('change', () => {
                const selectedState = this.stateFilter.value;
                logger.info(`State filter changed to: ${selectedState}`);
                this.selectedState = selectedState;
                this.saveFilterSettings();
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

        // Time tracking event listeners
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => {
                logger.info('Start button clicked');
                this.startTimeTracking();
            });
        }

        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => {
                logger.info('Stop button clicked');
                this.stopTimeTracking();
            });
        }

        // Context menu event listeners
        this.initContextMenu();
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
     * Initialize drag and drop after tickets have been created and added to the DOM
     */
    initializeDragAndDropAfterTickets() {
        logger.info('Re-initializing drag and drop after tickets are created');

        if (this.currentView === 'state') {
            // Re-initialize drop zones for state view
            this.initDragAndDrop();
        } else if (this.currentView === 'agent') {
            // Re-initialize drop zones for agent view
            this.initAgentDragAndDrop();
        }

        // Ensure all ticket elements have proper drag event listeners
        this.ensureTicketDragListeners();
    }

    /**
     * Ensure all ticket elements have proper drag event listeners
     */
    ensureTicketDragListeners() {
        const allTicketItems = document.querySelectorAll('.ticket-item');
        logger.info(`Ensuring drag listeners for ${allTicketItems.length} ticket items`);

        allTicketItems.forEach(ticketItem => {
            // Check if drag listeners are already attached
            if (ticketItem.hasAttribute('data-drag-initialized')) {
                return;
            }

            // Mark as initialized to avoid duplicate listeners
            ticketItem.setAttribute('data-drag-initialized', 'true');

            const ticketId = ticketItem.getAttribute('data-ticket-id');

            // Add the event listeners directly (simpler approach)
            ticketItem.addEventListener('dragstart', (event) => {
                this.draggedTicket = ticketItem;
                ticketItem.classList.add('dragging');
                event.dataTransfer.setData('text/plain', ticketId);
                event.dataTransfer.effectAllowed = 'move';

                // Store current category for performance optimization
                const ticket = this.tickets.find(t => t.id == ticketId);
                if (ticket) {
                    const currentCategory = this.getTicketCategory(ticket);
                    ticketItem.setAttribute('data-current-category', currentCategory);
                }

                logger.info(`Started dragging ticket #${ticketId}`);
            });

            ticketItem.addEventListener('dragend', () => {
                ticketItem.classList.remove('dragging');
                this.draggedTicket = null;
                logger.info(`Stopped dragging ticket #${ticketId}`);
            });
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

        // Track drag over state to prevent redundant class additions
        let isDragOver = false;

        container.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (!isDragOver) {
                container.classList.add('drag-over');
                isDragOver = true;
            }
        });

        container.addEventListener('dragleave', (event) => {
            // Only remove class if we're actually leaving the container
            if (!container.contains(event.relatedTarget)) {
                container.classList.remove('drag-over');
                isDragOver = false;
            }
        });

        container.addEventListener('drop', (event) => {
            event.preventDefault();
            container.classList.remove('drag-over');
            isDragOver = false;

            // Get the dragged ticket ID
            if (!this.draggedTicket) return;

            const ticketId = this.draggedTicket.getAttribute('data-ticket-id');
            // Use pre-stored category instead of searching through tickets array
            const currentCategory = this.draggedTicket.getAttribute('data-current-category');

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

        // Track drag over state to prevent redundant class additions
        let isDragOver = false;

        container.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (!isDragOver) {
                container.classList.add('drag-over');
                isDragOver = true;
            }
        });

        container.addEventListener('dragleave', (event) => {
            // Only remove class if we're actually leaving the container
            if (!container.contains(event.relatedTarget)) {
                container.classList.remove('drag-over');
                isDragOver = false;
            }
        });

        container.addEventListener('drop', (event) => {
            event.preventDefault();
            container.classList.remove('drag-over');
            isDragOver = false;

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
     * Initialize drag and drop functionality for group view
     */
    initGroupDragAndDrop() {
        logger.info('Setting up drag and drop functionality for group view');

        // Get unique groups and set up drop zones for each group column
        const groups = this.getUniqueGroups();
        groups.forEach(group => {
            const groupId = group.id || 'none';
            const columnId = `group-${groupId}`;
            const container = document.getElementById(columnId);
            if (container) {
                this.setupGroupDropZone(container, groupId, group.name);
            }
        });
    }

    /**
     * Set up a drop zone for a group column
     * @param {HTMLElement} container - The container element
     * @param {string} groupId - The group ID ('none' for unassigned tickets)
     * @param {string} groupName - The group name for display
     */
    setupGroupDropZone(container, groupId, groupName) {
        if (!container) return;

        container.setAttribute('data-group-id', groupId);

        // Track drag over state to prevent redundant class additions
        let isDragOver = false;

        container.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (!isDragOver) {
                container.classList.add('drag-over');
                isDragOver = true;
            }
        });

        container.addEventListener('dragleave', (event) => {
            // Only remove class if we're actually leaving the container
            if (!container.contains(event.relatedTarget)) {
                container.classList.remove('drag-over');
                isDragOver = false;
            }
        });

        container.addEventListener('drop', (event) => {
            event.preventDefault();
            container.classList.remove('drag-over');
            isDragOver = false;

            // Get the dragged ticket ID
            if (!this.draggedTicket) return;

            const ticketId = this.draggedTicket.getAttribute('data-ticket-id');
            const currentGroupId = this.draggedTicket.getAttribute('data-group-id');

            // Convert groupId for comparison
            const targetGroupId = groupId === 'none' ? null : groupId;
            const currentTicketGroupId = currentGroupId === 'none' || !currentGroupId ? null : currentGroupId;

            // If dropped on the same group, do nothing
            if (currentTicketGroupId == targetGroupId) {
                logger.info(`Ticket #${ticketId} dropped on the same group (${groupName})`);
                return;
            }

            logger.info(`Ticket #${ticketId} dropped on group: ${groupName} (${groupId})`);

            // Update the ticket group
            this.updateTicketGroup(ticketId, targetGroupId, groupName);
        });
    }

    /**
     * Update a ticket's group via API
     * @param {string|number} ticketId - The ticket ID
     * @param {string|number|null} newGroupId - The new group ID (null for no group)
     * @param {string} groupName - The group name for display
     */
    async updateTicketGroup(ticketId, newGroupId, groupName) {
        try {
            logger.info(`Updating ticket #${ticketId} group to: ${groupName} (${newGroupId || 'no group'})`);

            // Show loading indicator
            this.showLoading();

            // Prepare update data
            const updateData = {
                group_id: newGroupId || ''
            };

            // Make API request to update ticket
            const endpoint = `/api/v1/tickets/${ticketId}`;
            await zammadApi.request(endpoint, 'PUT', updateData);

            logger.info(`Successfully updated ticket #${ticketId} group to ${groupName}`);

            // Reload tickets to reflect changes
            await this.loadTickets();

        } catch (error) {
            logger.error(`Error updating ticket group:`, error);
            this.showError(`Failed to update ticket group: ${error.message}`);
        }
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

            // Highlight tickets with active time tracking
            await this.highlightAllActiveTrackingTickets();

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

        // Update dashboard container class for agent and group views
        if (this.currentView === 'agent' || this.currentView === 'group') {
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
        } else if (this.currentView === 'group') {
            this.setupGroupView();
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
     * Setup group-based view with group columns
     */
    setupGroupView() {
        // Get unique groups from tickets
        const groups = this.getUniqueGroups();

        groups.forEach(group => {
            const columnId = `group-${group.id || 'none'}`;
            const titleId = `group-title-${group.id || 'none'}`;
            const countId = `group-count-${group.id || 'none'}`;
            const columnElement = this.createColumnElement(columnId, titleId, countId, group.name);

            // Check if this column should be hidden
            if (this.hiddenColumns.has(columnId)) {
                columnElement.classList.add('hidden');
            }

            this.dashboardContainer.appendChild(columnElement);
        });

        // Initialize drag and drop for group view
        this.initGroupDragAndDrop();
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
        
        // Add toggle button for agent and group views with proper event listener
        if (this.currentView === 'agent' || this.currentView === 'group') {
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
     * Get unique groups from current tickets
     */
    getUniqueGroups() {
        const groupMap = new Map();

        // Add "No Group" category for tickets without groups
        groupMap.set('none', { id: null, name: 'No Group' });

        // Get unique groups from tickets
        this.tickets.forEach(ticket => {
            if (ticket.group_id && !groupMap.has(ticket.group_id)) {
                const groupName = this.getGroupName(ticket);
                groupMap.set(ticket.group_id, { id: ticket.group_id, name: groupName });
            }
        });

        return Array.from(groupMap.values());
    }

    /**
     * Get group name from ticket or groups data
     */
    getGroupName(ticket) {
        if (ticket.group_id && this.groups && this.groups.length > 0) {
            const group = this.groups.find(g => g.id == ticket.group_id);
            if (group) {
                return group.name || `Group ${ticket.group_id}`;
            }
        }
        return ticket.group_id ? `Group ${ticket.group_id}` : 'No Group';
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
        } else if (this.currentView === 'group') {
            this.processTicketsByGroup(sortedTickets);
        }

        // Re-initialize drag and drop after tickets are created
        this.initializeDragAndDropAfterTickets();

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
     * Process tickets organized by group
     */
    processTicketsByGroup(sortedTickets) {
        const groups = this.getUniqueGroups();
        const groupCounts = new Map();

        // Initialize counters
        groups.forEach(group => {
            groupCounts.set(group.id || 'none', 0);
        });

        // Process each ticket
        sortedTickets.forEach(ticket => {
            // Create ticket element
            const ticketElement = this.createTicketElement(ticket);

            // Determine which group column to use
            let groupId;
            if (!ticket.group_id) {
                groupId = 'none';
            } else {
                groupId = ticket.group_id;
            }

            const columnId = `group-${groupId}`;
            const container = document.getElementById(columnId);

            if (container) {
                container.appendChild(ticketElement);
                const currentCount = groupCounts.get(groupId) || 0;
                groupCounts.set(groupId, currentCount + 1);
            }
        });

        // Update counters
        groups.forEach(group => {
            const groupId = group.id || 'none';
            const countElement = document.getElementById(`group-count-${groupId}`);
            if (countElement) {
                countElement.textContent = groupCounts.get(groupId) || 0;
            }
        });

        const totalTickets = sortedTickets.length;
        logger.info(`Displayed ${totalTickets} tickets organized by group`);
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
        ticketItem.setAttribute('data-ticket-id', String(ticketId));
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

        // Note: Drag event listeners are now added centrally in ensureTicketDragListeners()

        // Add ticket content - 3 row layout with time tracking info
        ticketItem.innerHTML = `
        <div class="ticket-row-1">
            <div class="ticket-item-title">${ticketTitle}</div>
            <div class="ticket-time-info">
                <span class="ticket-time-display" id="time-${ticketId}">⏱️ --</span>
            </div>
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

        // Load time entries asynchronously to avoid blocking ticket display
        // Add a small delay to throttle API requests when loading many tickets
        setTimeout(() => {
            this.loadTicketTimeInfo(ticketId);
        }, Math.random() * 500); // Random delay up to 500ms to spread out API calls

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

        // Add right-click context menu for time tracking
        ticketItem.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();

            const ticketId = event.currentTarget.getAttribute('data-ticket-id');
            console.log('Right-click on ticket:', ticketId, typeof ticketId);
            console.log('Available tickets:', this.tickets.length);

            // Find ticket with proper type conversion
            const ticket = this.tickets.find(t => String(t.id) === String(ticketId) || t.id == ticketId);
            console.log('Found ticket:', ticket);

            // If we still can't find the ticket, create a minimal ticket object
            const ticketData = ticket || {
                id: ticketId,
                number: ticketId,
                title: 'Ticket #' + ticketId
            };
            console.log('Using ticket data:', ticketData);

            // Show context menu at mouse position
            this.showContextMenu(event.pageX, event.pageY, ticketItem, ticketData);
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
            // Check cache first for immediate response
            if (this.userCache && this.userCache.has(ticket.owner_id)) {
                userName = this.userCache.get(ticket.owner_id);
            } else {
                // Try to find in users array
                const user = this.users.find(u => u.id == ticket.owner_id);
                if (user) {
                    userName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.login || user.email || `User ${user.id}`;
                } else {
                    // Fetch user info from API
                    try {
                        const userInfo = await this.fetchUserInfo(ticket.owner_id);
                        if (userInfo) {
                            userName = `${userInfo.firstname || ''} ${userInfo.lastname || ''}`.trim() ||
                                      userInfo.login || userInfo.email || `User ${userInfo.id}`;
                            // Cache the result
                            if (this.userCache) {
                                this.userCache.set(ticket.owner_id, userName);
                            }
                        } else {
                            userName = `User ${ticket.owner_id}`;
                        }
                    } catch (error) {
                        logger.warn(`Failed to fetch user info for ${ticket.owner_id}:`, error);
                        userName = `User ${ticket.owner_id}`;
                    }
                }
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
                selectedOrganization: this.selectedOrganization,
                selectedPriority: this.selectedPriority,
                selectedState: this.selectedState
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
                selectedOrganization: 'all',
                selectedPriority: 'all',
                selectedState: 'all'
            });

            logger.info('Filter settings restored:', filterSettings);

            // Apply restored settings
            this.selectedUserId = filterSettings.selectedUserId || 'all';
            this.selectedGroup = filterSettings.selectedGroup || 'all';
            this.selectedOrganization = filterSettings.selectedOrganization || 'all';
            this.selectedPriority = filterSettings.selectedPriority || 'all';
            this.selectedState = filterSettings.selectedState || 'all';

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
            if (this.priorityFilter) {
                this.priorityFilter.value = this.selectedPriority;
            }
            if (this.stateFilter) {
                this.stateFilter.value = this.selectedState;
            }
        } catch (error) {
            logger.error('Error restoring filter settings:', error);
            // Fall back to defaults if restoration fails
            this.selectedUserId = 'all';
            this.selectedGroup = 'all';
            this.selectedOrganization = 'all';
            this.selectedPriority = 'all';
            this.selectedState = 'all';
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

        // Get all columns based on current view
        let columns = [];
        if (this.currentView === 'agent') {
            columns = this.getUniqueAgents().map(agent => ({
                id: `agent-${agent.id || 'unassigned'}`,
                name: agent.name
            }));
        } else if (this.currentView === 'group') {
            columns = this.getUniqueGroups().map(group => ({
                id: `group-${group.id || 'none'}`,
                name: group.name
            }));
        }

        if (columns.length === 0) {
            logger.warn('No columns found for column visibility menu');
            return;
        }

        // Create dropdown menu
        const menu = document.createElement('div');
        menu.id = 'columnVisibilityMenu';
        menu.className = 'column-visibility-menu';
        
        let menuItems = '<div class="menu-header">Spalten ein-/ausblenden:</div>';

        columns.forEach(column => {
            const isHidden = this.hiddenColumns.has(column.id);
            const checked = isHidden ? '' : 'checked';

            menuItems += `
                <label class="menu-item">
                    <input type="checkbox" ${checked} data-column-id="${column.id}">
                    <span>${column.name}</span>
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

    /**
     * Initialize time tracking functionality
     */
    initTimeTracking() {
        try {
            logger.info('Initializing time tracking functionality');
            this.loadTrackingState();
            this.updateTimeTrackingUI();
        } catch (error) {
            logger.error('Failed to initialize time tracking:', error);
            console.error('Time tracking initialization failed:', error);
        }
    }

    /**
     * Load time tracking state from storage
     */
    async loadTrackingState() {
        try {
            const result = await chrome.storage.local.get(['timetrackingState']);
            const state = result.timetrackingState;

            if (state && state.isTracking) {
                this.isTracking = true;
                this.startTime = new Date(state.startTime);
                this.currentTicketId = state.ticketId;
                this.currentTicketTitle = state.ticketTitle;
                this.currentTimeSpent = state.timeSpent || 0;

                // Start the timer
                this.startTimer();
                this.updateTimeTrackingUI();

                // Highlight the tracking ticket after a short delay to ensure tickets are loaded
                setTimeout(() => {
                    this.highlightTrackingTicket(this.currentTicketId);
                }, 1000);

                logger.info('Restored time tracking session', { ticketId: this.currentTicketId });
            }
        } catch (error) {
            logger.error('Failed to load tracking state:', error);
        }
    }

    /**
     * Save time tracking state to storage
     */
    async saveTrackingState() {
        try {
            const state = {
                isTracking: this.isTracking,
                startTime: this.startTime,
                ticketId: this.currentTicketId,
                ticketTitle: this.currentTicketTitle,
                timeSpent: this.currentTimeSpent
            };
            await chrome.storage.local.set({ timetrackingState: state });
        } catch (error) {
            logger.error('Failed to save tracking state:', error);
        }
    }

    /**
     * Start time tracking for current ticket
     */
    async startTimeTracking() {
        try {
            // Get current tab info
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (!activeTab?.url) {
                logger.warn('No active tab found');
                return;
            }

            // Check if we're on a Zammad ticket page
            const ticketMatch = activeTab.url.match(/\/tickets\/(\d+)/);
            if (!ticketMatch) {
                logger.warn('Not on a Zammad ticket page');
                this.showMessage('Please navigate to a Zammad ticket page to start tracking', 'warning');
                return;
            }

            this.currentTicketId = ticketMatch[1];
            this.isTracking = true;
            this.startTime = new Date();

            // Get ticket info
            await this.loadTicketInfo();

            // Start the timer
            this.startTimer();
            this.updateTimeTrackingUI();
            this.saveTrackingState();

            // Highlight the tracking ticket
            this.highlightTrackingTicket(this.currentTicketId);

            logger.info('Started time tracking', { ticketId: this.currentTicketId });
        } catch (error) {
            logger.error('Failed to start time tracking:', error);
        }
    }

    /**
     * Stop time tracking
     */
    async stopTimeTracking() {
        if (!this.isTracking) return;

        try {
            // Calculate elapsed time
            const elapsed = Math.floor((Date.now() - this.startTime.getTime()) / 60000); // minutes

            // Update time spent
            this.currentTimeSpent += elapsed;

            // Stop timer
            this.stopTimer();
            this.isTracking = false;

            // Clear state
            await chrome.storage.local.remove(['timetrackingState']);

            // Update UI
            this.updateTimeTrackingUI();

            // Clear ticket highlight
            this.clearTicketHighlights();

            logger.info('Stopped time tracking', {
                ticketId: this.currentTicketId,
                elapsed: elapsed,
                totalTime: this.currentTimeSpent
            });

            // Submit time if auto-submit is enabled
            await this.handleTimeSubmission();

        } catch (error) {
            logger.error('Failed to stop time tracking:', error);
        }
    }

    /**
     * Load ticket information
     */
    async loadTicketInfo() {
        try {
            if (zammadApi && zammadApi.isInitialized()) {
                const ticket = await zammadApi.getTicket(this.currentTicketId);
                if (ticket) {
                    this.currentTicketTitle = ticket.title;
                    this.updateTimeTrackingUI();
                }
            }
        } catch (error) {
            logger.error('Failed to load ticket info:', error);
            this.currentTicketTitle = `Ticket #${this.currentTicketId}`;
        }
    }

    /**
     * Handle time submission
     */
    async handleTimeSubmission() {
        if (this.currentTimeSpent === 0) return;

        let timeSubmissionSuccess = false;

        try {
            // Always attempt to submit time entry (like popup approach)
            if (zammadApi && zammadApi.isInitialized()) {
                const comment = 'Time tracked via Zammad Dashboard';
                await zammadApi.submitTimeEntry(this.currentTicketId, this.currentTimeSpent, comment);
                logger.info('Successfully submitted time entry', {
                    ticketId: this.currentTicketId,
                    time: this.currentTimeSpent
                });
                timeSubmissionSuccess = true;
            } else {
                logger.warn('API not initialized - time entry not submitted');
                timeSubmissionSuccess = false;
            }
        } catch (error) {
            logger.error('Failed to submit time entry:', error);
            timeSubmissionSuccess = false;
        }

        // Show user feedback about time submission
        if (timeSubmissionSuccess) {
            this.showTimeSubmissionFeedback(true, this.currentTimeSpent);
        } else {
            this.showTimeSubmissionFeedback(false, this.currentTimeSpent);
        }

        // Reset time spent
        this.currentTimeSpent = 0;
        this.currentTicketId = null;
        this.currentTicketTitle = null;
        this.updateTimeTrackingUI();
    }

    /**
     * Load time information for a specific ticket
     */
    async loadTicketTimeInfo(ticketId) {
        try {
            // Only load if API is initialized
            if (!zammadApi || !zammadApi.isInitialized()) {
                return;
            }

            const timeEntries = await zammadApi.getTimeEntries(ticketId);

            if (timeEntries && Array.isArray(timeEntries)) {
                // Calculate total time spent
                const totalTime = timeEntries.reduce((total, entry) => {
                    return total + (parseFloat(entry.time_unit) || 0);
                }, 0);

                // Update the display
                const timeDisplay = document.getElementById(`time-${ticketId}`);
                if (timeDisplay) {
                    if (totalTime > 0) {
                        const hours = Math.floor(totalTime / 60);
                        const minutes = Math.round(totalTime % 60);

                        if (hours > 0) {
                            timeDisplay.textContent = `⏱️ ${hours}h ${minutes}m`;
                        } else {
                            timeDisplay.textContent = `⏱️ ${minutes}m`;
                        }
                        timeDisplay.classList.add('has-time');
                        timeDisplay.title = `Total recorded time: ${Math.round(totalTime)} minutes`;
                    } else {
                        timeDisplay.textContent = '⏱️ --';
                        timeDisplay.classList.remove('has-time');
                        timeDisplay.title = 'No time recorded';
                    }
                }
            }
        } catch (error) {
            // Silently fail - don't log errors for missing permissions
            if (!error.message.includes('403') && !error.message.includes('404')) {
                logger.debug(`Failed to load time info for ticket ${ticketId}:`, error);
            }
        }
    }

    /**
     * Show feedback to user about time submission success/failure
     */
    showTimeSubmissionFeedback(success, timeSpent) {
        const message = success
            ? `Time entry created: ${timeSpent} minutes`
            : `Time recorded: ${timeSpent} minutes (manual entry required)`;

        const messageType = success ? 'success' : 'warning';

        logger.info(`Time submission feedback: ${message}`);

        // Show temporary toast notification in the UI
        this.showToastNotification(message, messageType);
    }

    /**
     * Show a temporary toast notification
     */
    showToastNotification(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // Add styles
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '4px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '9999',
            minWidth: '200px',
            maxWidth: '400px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out',
            backgroundColor: type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'
        });

        // Add to page
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);

        // Remove after delay
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }

    /**
     * Start the timer interval
     */
    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            this.updateTimerDisplay();
            // Periodically save state to ensure persistence across unexpected page closures
            if (this.isTracking && Date.now() % 30000 < 1000) { // Save every 30 seconds
                this.saveTrackingState();
            }
        }, 1000);
        this.updateTimerDisplay();
    }

    /**
     * Stop the timer interval
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Update timer display
     */
    updateTimerDisplay() {
        if (!this.isTracking || !this.startTime) {
            this.timerDisplay.textContent = '00:00:00';
            return;
        }

        const elapsed = Date.now() - this.startTime.getTime();
        const seconds = Math.floor(elapsed / 1000) % 60;
        const minutes = Math.floor(elapsed / 60000) % 60;
        const hours = Math.floor(elapsed / 3600000);

        this.timerDisplay.textContent =
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Update time tracking UI
     */
    updateTimeTrackingUI() {
        try {
            if (this.isTracking) {
                if (this.statusDot) {
                    this.statusDot.classList.remove('inactive');
                    this.statusDot.classList.add('active');
                }
                if (this.statusText) {
                    this.statusText.textContent = 'Active';
                }
                if (this.startBtn) {
                    this.startBtn.disabled = true;
                }
                if (this.stopBtn) {
                    this.stopBtn.disabled = false;
                }

                if (this.currentTicketId && this.currentTicketTitle) {
                    if (this.ticketInfo) {
                        this.ticketInfo.style.display = 'block';
                    }
                    if (this.ticketTitle) {
                        this.ticketTitle.textContent = this.currentTicketTitle;
                    }
                    if (this.ticketId) {
                        this.ticketId.textContent = `#${this.currentTicketId}`;
                    }
                    if (this.timeSpent) {
                        this.timeSpent.textContent = this.currentTimeSpent.toString();
                    }
                }
            } else {
                if (this.statusDot) {
                    this.statusDot.classList.remove('active');
                    this.statusDot.classList.add('inactive');
                }
                if (this.statusText) {
                    this.statusText.textContent = 'Inactive';
                }
                if (this.startBtn) {
                    this.startBtn.disabled = false;
                }
                if (this.stopBtn) {
                    this.stopBtn.disabled = true;
                }
                if (this.ticketInfo) {
                    this.ticketInfo.style.display = 'none';
                }
                if (this.timerDisplay) {
                    this.timerDisplay.textContent = '00:00:00';
                }
            }
        } catch (error) {
            logger.error('Failed to update time tracking UI:', error);
        }
    }


    /**
     * Open options page
     */
    openOptions() {
        chrome.runtime.openOptionsPage();
    }

    /**
     * Initialize context menu functionality
     */
    initContextMenu() {
        // Context menu item event listeners
        if (this.startTrackingItem) {
            this.startTrackingItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent click from closing menu
                logger.info('Start tracking context menu item clicked');

                // Don't handle click if disabled
                if (this.startTrackingItem.classList.contains('disabled')) {
                    logger.info('Start tracking item is disabled, ignoring click');
                    return;
                }

                this.startTimeTrackingForTicket();
            });
        }

        if (this.stopTrackingItem) {
            this.stopTrackingItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent click from closing menu
                logger.info('Stop tracking context menu item clicked');

                // Don't handle click if disabled
                if (this.stopTrackingItem.classList.contains('disabled')) {
                    logger.info('Stop tracking item is disabled, ignoring click');
                    return;
                }

                this.stopTimeTracking();
            });
        }

        if (this.editTimeTrackingItem) {
            console.log('Adding event listener to editTimeTrackingItem');
            this.editTimeTrackingItem.addEventListener('click', (e) => {
                console.log('Edit time tracking item clicked');
                e.preventDefault();
                e.stopPropagation(); // Prevent click from closing menu
                logger.info('Edit time tracking context menu item clicked');

                // Don't handle click if disabled
                if (this.editTimeTrackingItem.classList.contains('disabled')) {
                    console.log('Edit time tracking item is disabled, ignoring click');
                    logger.info('Edit time tracking item is disabled, ignoring click');
                    return;
                }

                this.editTimeTracking();
            });
        } else {
            console.error('editTimeTrackingItem not found in DOM');
        }

        // Hide context menu when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // Prevent default context menu on dashboard
        document.addEventListener('contextmenu', (e) => {
            // Only prevent default if clicking on a ticket
            if (e.target.closest('.ticket-item')) {
                e.preventDefault();
            }
        });
    }

    /**
     * Show context menu at specified position
     */
    showContextMenu(x, y, ticketElement, ticketData) {
        console.log('showContextMenu called with:', { x, y, ticketElement, ticketData });
        logger.info('showContextMenu called', {
            x, y,
            hasTicketElement: !!ticketElement,
            ticketData: ticketData
        });

        this.currentTicketElement = ticketElement;
        this.currentTicketData = ticketData;

        console.log('Set currentTicketData to:', this.currentTicketData);

        // Update context menu state based on current tracking status
        this.updateContextMenuState();

        // Position the menu
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        this.contextMenu.style.display = 'block';

        // Adjust position if menu would go off screen
        const rect = this.contextMenu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (rect.right > windowWidth) {
            this.contextMenu.style.left = (windowWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > windowHeight) {
            this.contextMenu.style.top = (windowHeight - rect.height - 10) + 'px';
        }
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        this.contextMenu.style.display = 'none';
        this.currentTicketElement = null;
        this.currentTicketData = null;
    }

    /**
     * Update context menu items based on tracking state
     */
    updateContextMenuState() {
        const isCurrentlyTracking = this.isTracking;
        const isTrackingThisTicket = isCurrentlyTracking &&
            this.currentTicketData &&
            this.currentTicketId === this.currentTicketData.id;

        // Enable/disable menu items based on state
        if (isCurrentlyTracking && !isTrackingThisTicket) {
            // Already tracking different ticket - only allow stop
            this.startTrackingItem.classList.add('disabled');
            this.stopTrackingItem.classList.remove('disabled');
            this.editTimeTrackingItem.classList.remove('disabled'); // Always allow edit
        } else if (isTrackingThisTicket) {
            // Already tracking this ticket - only allow stop
            this.startTrackingItem.classList.add('disabled');
            this.stopTrackingItem.classList.remove('disabled');
            this.editTimeTrackingItem.classList.remove('disabled'); // Always allow edit
        } else {
            // Not tracking or not tracking any ticket - allow start
            this.startTrackingItem.classList.remove('disabled');
            this.stopTrackingItem.classList.add('disabled');
            this.editTimeTrackingItem.classList.remove('disabled'); // Always allow edit
        }
    }

    /**
     * Start time tracking for the ticket from context menu
     */
    async startTimeTrackingForTicket() {
        logger.info('startTimeTrackingForTicket called', {
            hasCurrentTicketData: !!this.currentTicketData,
            currentTicketData: this.currentTicketData
        });

        if (!this.currentTicketData) {
            logger.error('No current ticket data available');
            return;
        }

        try {
            // Extract ticket ID and title with fallbacks
            const ticketId = this.currentTicketData.id || this.currentTicketData.number;
            const ticketTitle = this.currentTicketData.title || `Ticket #${ticketId}`;

            if (!ticketId) {
                logger.error('No ticket ID found in current ticket data', this.currentTicketData);
                return;
            }

            logger.info('Setting up tracking for ticket', { ticketId, ticketTitle });

            // Set up tracking for the selected ticket
            this.currentTicketId = String(ticketId);
            this.currentTicketTitle = ticketTitle;
            this.isTracking = true;
            this.startTime = new Date();
            this.currentTimeSpent = 0;

            // Start the timer
            this.startTimer();
            this.updateTimeTrackingUI();
            this.saveTrackingState();

            // Highlight the tracking ticket
            this.highlightTrackingTicket(this.currentTicketId);

            logger.info('Successfully started time tracking for ticket', {
                ticketId: this.currentTicketId,
                ticketTitle: this.currentTicketTitle
            });
        } catch (error) {
            logger.error('Failed to start time tracking for ticket:', error);
        }
    }

    /**
     * Edit time tracking for the ticket from context menu
     */
    editTimeTracking() {
        console.log('editTimeTracking called');
        logger.info('Edit time tracking context menu clicked');

        // Store the ticket data BEFORE hiding the context menu
        const ticketData = this.currentTicketData;
        console.log('Stored ticket data:', ticketData);

        this.hideContextMenu();

        if (!ticketData) {
            console.error('No current ticket data available for editing time tracking');
            logger.error('No current ticket data available for editing time tracking');
            alert('No ticket data available. Please try right-clicking on the ticket again.');
            return;
        }

        console.log('Using stored ticket data:', ticketData);

        try {
            const ticketId = ticketData.id || ticketData.number;

            if (!ticketId) {
                console.error('No ticket ID found in ticket data', ticketData);
                logger.error('No ticket ID found in ticket data', ticketData);
                alert('No ticket ID found. Please try again.');
                return;
            }

            console.log('Opening time tracking edit for ticket', ticketId);
            logger.info('Opening time tracking edit for ticket', { ticketId });

            // Create and show a modal for editing time tracking
            this.showTimeEditModal(ticketId);

        } catch (error) {
            console.error('Failed to edit time tracking for ticket:', error);
            logger.error('Failed to edit time tracking for ticket:', error);
            alert('Error opening time tracking editor: ' + error.message);
        }
    }

    /**
     * Show modal for editing time tracking
     */
    showTimeEditModal(ticketId) {
        console.log('showTimeEditModal called for ticket:', ticketId);

        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'timeEditModal';
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            min-width: 600px;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        `;

        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0;">Time Tracking - Ticket #${ticketId}</h3>
                <button id="closeModal" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 5px;">×</button>
            </div>

            <!-- Existing Time Entries Section -->
            <div id="existingEntriesSection" style="margin-bottom: 30px;">
                <h4 style="margin: 0 0 15px 0; color: #333;">Existing Time Entries</h4>
                <div id="existingEntriesList" style="border: 1px solid #ddd; border-radius: 4px; min-height: 100px; max-height: 300px; overflow-y: auto;">
                    <div style="padding: 20px; text-align: center; color: #666;">Loading existing time entries...</div>
                </div>
                <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 14px;">
                    <strong>Total Time:</strong> <span id="totalTimeDisplay">-- minutes</span>
                </div>
            </div>

            <!-- Add New Entry Section -->
            <div id="addNewEntrySection">
                <h4 style="margin: 0 0 15px 0; color: #333;">Add New Time Entry</h4>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Time (minutes):</label>
                    <input type="number" id="timeInput" min="0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Enter time in minutes">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Activity:</label>
                    <textarea id="activityInput" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Optional: describe the activity"></textarea>
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                <button id="cancelTimeEdit" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button id="addNewTimeEntry" style="padding: 8px 16px; border: none; background: #28a745; color: white; border-radius: 4px; cursor: pointer;">Add Entry</button>
            </div>
        `;

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        // Load existing time entries
        this.loadExistingTimeEntries(ticketId, modalContent);

        // Handle add new entry button
        modalContent.querySelector('#addNewTimeEntry').addEventListener('click', () => {
            const timeInput = modalContent.querySelector('#timeInput');
            const activityInput = modalContent.querySelector('#activityInput');
            const minutes = parseInt(timeInput.value);
            const activity = activityInput.value.trim();

            if (isNaN(minutes) || minutes <= 0) {
                alert('Please enter a valid time in minutes');
                return;
            }

            this.addNewTimeEntry(ticketId, minutes, activity, modalContent);
        });

        // Handle cancel button and close button
        modalContent.querySelector('#cancelTimeEdit').addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
        });

        modalContent.querySelector('#closeModal').addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
        });

        // Handle clicking outside modal
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                document.body.removeChild(modalOverlay);
            }
        });

        // Handle escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                if (document.body.contains(modalOverlay)) {
                    document.body.removeChild(modalOverlay);
                }
                document.removeEventListener('keydown', escapeHandler);
            }
        });

        console.log('Modal created and added to body');
    }

    /**
     * Load existing time entries for a ticket and display them
     */
    async loadExistingTimeEntries(ticketId, modalContent) {
        const entriesList = modalContent.querySelector('#existingEntriesList');
        const totalTimeDisplay = modalContent.querySelector('#totalTimeDisplay');

        // Check if API is available and initialized
        if (!zammadApi || !zammadApi.isInitialized || !zammadApi.isInitialized()) {
            console.warn('API not available, showing fallback message');
            entriesList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #856404; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; margin: 10px;">
                    <strong>API Configuration Required</strong><br>
                    <small>To view and edit existing time entries, please configure your Zammad API settings in the extension options.</small><br>
                    <small style="margin-top: 10px; display: block;">You can still add new time entries, but they will need to be entered manually in Zammad.</small>
                </div>
            `;
            totalTimeDisplay.textContent = 'API configuration required';
            return;
        }

        try {
            console.log('Loading time entries for ticket:', ticketId);
            const timeEntries = await zammadApi.getTimeEntries(ticketId);

            if (!timeEntries || timeEntries.length === 0) {
                entriesList.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #666;">
                        No time entries found for this ticket.
                    </div>
                `;
                totalTimeDisplay.textContent = '0 minutes';
                return;
            }

            // Calculate total time
            const totalMinutes = timeEntries.reduce((sum, entry) => sum + (parseFloat(entry.time_unit) || 0), 0);
            totalTimeDisplay.textContent = `${totalMinutes} minutes (${Math.round(totalMinutes / 60 * 100) / 100} hours)`;

            // Render time entries
            entriesList.innerHTML = timeEntries.map((entry, index) => {
                const date = entry.created_at ? new Date(entry.created_at).toLocaleString() : 'Unknown date';
                const minutes = parseFloat(entry.time_unit) || 0;
                const activity = entry.comment || entry.activity_type || 'No description';

                // Get creator name - try different fields that might contain user info
                let creatorName = 'Unknown user';
                if (entry.created_by_id) {
                    // Try to get user name from cache or fetch it
                    creatorName = this.getUserDisplayName(entry.created_by_id);
                } else if (entry.user_id) {
                    creatorName = this.getUserDisplayName(entry.user_id);
                } else if (entry.created_by) {
                    creatorName = entry.created_by;
                }

                return `
                    <div class="time-entry-item" data-entry-id="${entry.id}" data-index="${index}" style="
                        padding: 12px;
                        border-bottom: 1px solid #eee;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: white;
                    ">
                        <div style="flex-grow: 1;">
                            <div style="font-weight: bold; margin-bottom: 4px;">
                                ${minutes} minutes
                                <span style="color: #666; font-weight: normal; margin-left: 10px;">${date}</span>
                            </div>
                            <div style="color: #666; font-size: 14px; margin-bottom: 2px;">${activity}</div>
                            <div style="color: #888; font-size: 12px; font-style: italic;">Created by: ${creatorName}</div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="edit-entry-btn" data-entry-id="${entry.id}" data-index="${index}" style="
                                padding: 4px 8px;
                                border: 1px solid #007bff;
                                background: white;
                                color: #007bff;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 12px;
                            ">Edit</button>
                            <button class="delete-entry-btn" data-entry-id="${entry.id}" data-index="${index}" style="
                                padding: 4px 8px;
                                border: 1px solid #dc3545;
                                background: white;
                                color: #dc3545;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 12px;
                            ">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');

            // Add event listeners to edit and delete buttons
            entriesList.querySelectorAll('.edit-entry-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const entryIndex = parseInt(e.target.dataset.index);
                    this.editTimeEntry(timeEntries[entryIndex], ticketId, modalContent);
                });
            });

            entriesList.querySelectorAll('.delete-entry-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const entryIndex = parseInt(e.target.dataset.index);
                    this.deleteTimeEntry(timeEntries[entryIndex], ticketId, modalContent);
                });
            });

        } catch (error) {
            logger.error('Could not load existing time entries:', error);
            entriesList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #dc3545;">
                    Error loading time entries. Please check your API configuration.
                </div>
            `;
            totalTimeDisplay.textContent = '-- minutes';
        }
    }

    /**
     * Add new time entry for a ticket
     */
    async addNewTimeEntry(ticketId, minutes, activity, modalContent) {
        try {
            logger.info('Adding new time entry', { ticketId, minutes, activity });

            // Try to save via API first
            if (zammadApi && zammadApi.isInitialized && zammadApi.isInitialized()) {
                await zammadApi.submitTimeEntry(ticketId, minutes, activity);
                logger.info('Time entry saved successfully via API');

                // Clear the form
                modalContent.querySelector('#timeInput').value = '';
                modalContent.querySelector('#activityInput').value = '';

                // Reload the entries list
                this.loadExistingTimeEntries(ticketId, modalContent);

                // Update the UI to reflect the new time
                this.loadTicketTimeInfo(ticketId);
                this.showToastNotification(t('time_recorded'), 'success');
            } else {
                logger.warn('API not available, cannot save time entry automatically');
                this.showToastNotification(t('manual_entry_required', [minutes]), 'warning');
            }

        } catch (error) {
            logger.error('Failed to add time entry:', error);
            this.showToastNotification(t('time_update_error'), 'error');
        }
    }

    /**
     * Edit an existing time entry
     */
    editTimeEntry(entry, ticketId, modalContent) {
        // Create inline edit form
        const entryElement = modalContent.querySelector(`[data-entry-id="${entry.id}"]`);
        if (!entryElement) return;

        const originalHtml = entryElement.innerHTML;

        entryElement.innerHTML = `
            <div style="flex-grow: 1; display: flex; gap: 10px; align-items: center;">
                <input type="number" id="editTimeInput-${entry.id}" value="${entry.time_unit || 0}" min="0"
                       style="width: 80px; padding: 4px; border: 1px solid #ddd; border-radius: 3px;" />
                <span style="font-size: 14px;">minutes</span>
                <input type="text" id="editActivityInput-${entry.id}" value="${entry.comment || entry.activity_type || ''}"
                       placeholder="Activity description"
                       style="flex-grow: 1; padding: 4px; border: 1px solid #ddd; border-radius: 3px;" />
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="save-edit-btn" style="
                    padding: 4px 8px;
                    border: 1px solid #28a745;
                    background: #28a745;
                    color: white;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                ">Save</button>
                <button class="cancel-edit-btn" style="
                    padding: 4px 8px;
                    border: 1px solid #6c757d;
                    background: white;
                    color: #6c757d;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                ">Cancel</button>
            </div>
        `;

        // Handle save button
        entryElement.querySelector('.save-edit-btn').addEventListener('click', async () => {
            const newTime = parseInt(entryElement.querySelector(`#editTimeInput-${entry.id}`).value);
            const newActivity = entryElement.querySelector(`#editActivityInput-${entry.id}`).value.trim();

            if (isNaN(newTime) || newTime < 0) {
                alert('Please enter a valid time in minutes');
                return;
            }

            await this.saveEditedTimeEntry(entry, ticketId, newTime, newActivity, modalContent);
        });

        // Handle cancel button
        entryElement.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            entryElement.innerHTML = originalHtml;
            // Re-attach event listeners
            this.attachEntryButtonListeners(entryElement, entry, ticketId, modalContent);
        });

        // Focus on time input
        entryElement.querySelector(`#editTimeInput-${entry.id}`).focus();
    }

    /**
     * Save edited time entry
     */
    async saveEditedTimeEntry(entry, ticketId, newTime, newActivity, modalContent) {
        try {
            logger.info('Updating time entry', { entryId: entry.id, newTime, newActivity });

            const updatedEntryData = {
                time_unit: newTime,
                comment: newActivity || entry.comment || entry.activity_type || 'Time tracking via dashboard'
            };

            // Try to update via API
            if (zammadApi && zammadApi.isInitialized && zammadApi.isInitialized()) {
                await zammadApi.updateTimeEntry(entry.id, ticketId, updatedEntryData);
                logger.info('Time entry updated successfully via API');

                // Reload the entries list
                this.loadExistingTimeEntries(ticketId, modalContent);

                // Update the UI to reflect the changed time
                this.loadTicketTimeInfo(ticketId);
                this.showToastNotification(t('time_updated'), 'success');
            } else {
                logger.warn('API not available, cannot update time entry automatically');
                this.showToastNotification('API not available for updating entries', 'warning');
            }

        } catch (error) {
            logger.error('Failed to update time entry:', error);
            this.showToastNotification(t('time_update_error'), 'error');
            // Reload the entries to restore original state
            this.loadExistingTimeEntries(ticketId, modalContent);
        }
    }

    /**
     * Delete a time entry
     */
    async deleteTimeEntry(entry, ticketId, modalContent) {
        const confirmDelete = confirm(`Are you sure you want to delete this ${entry.time_unit || 0} minute time entry?`);
        if (!confirmDelete) return;

        try {
            logger.info('Deleting time entry', { entryId: entry.id });

            // Try to delete via API
            if (zammadApi && zammadApi.isInitialized && zammadApi.isInitialized()) {
                await zammadApi.deleteTimeEntry(entry.id, ticketId);
                logger.info('Time entry deleted successfully via API');

                // Reload the entries list
                this.loadExistingTimeEntries(ticketId, modalContent);

                // Update the UI to reflect the removed time
                this.loadTicketTimeInfo(ticketId);
                this.showToastNotification(t('entry_deleted'), 'success');
            } else {
                logger.warn('API not available, cannot delete time entry automatically');
                this.showToastNotification('API not available for deleting entries', 'warning');
            }

        } catch (error) {
            logger.error('Failed to delete time entry:', error);
            this.showToastNotification(t('delete_entry_error'), 'error');
        }
    }

    /**
     * Reattach event listeners to entry buttons after canceling edit
     */
    attachEntryButtonListeners(entryElement, entry, ticketId, modalContent) {
        const editBtn = entryElement.querySelector('.edit-entry-btn');
        const deleteBtn = entryElement.querySelector('.delete-entry-btn');

        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.editTimeEntry(entry, ticketId, modalContent);
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteTimeEntry(entry, ticketId, modalContent);
            });
        }
    }

    /**
     * Open time tracker popup for the selected ticket
     */

    /**
     * Highlight the ticket that's currently being tracked
     */
    async highlightTrackingTicket(ticketId) {
        if (!ticketId) {
            logger.warn('No ticket ID provided for highlighting');
            return;
        }

        try {
            logger.info('Attempting to highlight ticket and check for other active tracking:', ticketId, typeof ticketId);

            // Use the comprehensive highlighting that checks for all active tracking
            await this.highlightAllActiveTrackingTickets();

        } catch (error) {
            logger.error('Failed to highlight tracking ticket:', error);
        }
    }

    /**
     * Remove highlight from all tickets
     */
    clearTicketHighlights() {
        try {
            const highlightedTickets = document.querySelectorAll('.time-tracking-active, .time-tracking-other');
            highlightedTickets.forEach(ticket => {
                ticket.classList.remove('time-tracking-active', 'time-tracking-other');
            });
            logger.info('Cleared all ticket highlights, count:', highlightedTickets.length);
        } catch (error) {
            logger.error('Failed to clear ticket highlights:', error);
        }
    }

    /**
     * Get global tracking state to check if other tickets have active tracking
     */
    async getGlobalTrackingState() {
        try {
            const result = await chrome.storage.local.get(['zammadTrackingState']);
            return result.zammadTrackingState || null;
        } catch (error) {
            logger.error('Failed to get global tracking state:', error);
            return null;
        }
    }

    /**
     * Highlight tickets with active time tracking (orange for other tickets, blue for current)
     */
    async highlightAllActiveTrackingTickets() {
        try {
            // Clear existing highlights first
            this.clearTicketHighlights();

            // Get global tracking state
            const globalState = await this.getGlobalTrackingState();

            // First, highlight the current dashboard's tracking ticket (if any)
            if (this.isTracking && this.currentTicketId) {
                const currentTicketElement = document.querySelector(`[data-ticket-id="${String(this.currentTicketId)}"]`);
                if (currentTicketElement) {
                    currentTicketElement.classList.add('time-tracking-active');
                    logger.info('Highlighted current dashboard tracking ticket (blue):', this.currentTicketId);
                }
            }

            // Then, check for global tracking state that might be from other instances
            if (globalState && globalState.isTracking && globalState.ticketId) {
                const globalTicketId = String(globalState.ticketId);
                const currentTicketId = String(this.currentTicketId);

                // Only add orange highlighting if it's a different ticket than the current one
                if (globalTicketId !== currentTicketId || !this.isTracking) {
                    const ticketElement = document.querySelector(`[data-ticket-id="${globalTicketId}"]`);
                    if (ticketElement) {
                        // Remove blue highlight if it was added and this is from another instance
                        if (globalTicketId !== currentTicketId) {
                            ticketElement.classList.remove('time-tracking-active');
                            ticketElement.classList.add('time-tracking-other');
                            logger.info('Highlighted other instance tracking ticket (orange):', globalTicketId);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to highlight active tracking tickets:', error);
        }
    }

    /**
     * Test method - highlight first available ticket for debugging
     */
    testHighlightFirstTicket() {
        try {
            const allTickets = document.querySelectorAll('.ticket-item');
            if (allTickets.length > 0) {
                const firstTicket = allTickets[0];
                const ticketId = firstTicket.getAttribute('data-ticket-id');
                logger.info('Test highlighting first ticket:', ticketId);

                firstTicket.classList.add('time-tracking-active');

                // Also log all classes for debugging
                logger.info('Ticket classes after adding highlight:', firstTicket.className);

                return ticketId;
            } else {
                logger.warn('No ticket elements found for test highlighting');
                return null;
            }
        } catch (error) {
            logger.error('Test highlighting failed:', error);
            return null;
        }
    }

    /**
     * Show message to user
     */
    showMessage(message, type = 'info') {
        // Simple message display - could be enhanced with a toast notification
        logger.info(`Message (${type}): ${message}`);

        // Update error container if available
        if (this.errorContainer) {
            this.errorContainer.textContent = message;
            this.errorContainer.className = `error-message ${type}`;
            this.errorContainer.style.display = 'block';

            // Hide after 5 seconds
            setTimeout(() => {
                this.errorContainer.style.display = 'none';
            }, 5000);
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Enable debug mode in logger if needed
    // logger.enableDebug();

    // Create dashboard instance
    window.dashboard = new ZammadDashboard();
});
