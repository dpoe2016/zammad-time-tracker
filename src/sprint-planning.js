/**
 * Sprint Planning UI Controller
 */

class SprintPlanningUI {
  constructor() {
    logger.info('Initializing Sprint Planning UI');

    // UI Elements
    this.backToDashboardBtn = document.getElementById('backToDashboardBtn');
    this.createSprintBtn = document.getElementById('createSprintBtn');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.sprintSelect = document.getElementById('sprintSelect');
    this.sprintInfo = document.getElementById('sprintInfo');
    this.sprintStats = document.getElementById('sprintStats');
    this.editSprintBtn = document.getElementById('editSprintBtn');
    this.startSprintBtn = document.getElementById('startSprintBtn');
    this.completeSprintBtn = document.getElementById('completeSprintBtn');
    
    // Board elements
    this.sprintBoard = document.getElementById('sprintBoard');
    this.backlogTickets = document.getElementById('backlogTickets');
    this.sprintTickets = document.getElementById('sprintTickets');
    this.loadingContainer = document.getElementById('loadingContainer');
    this.errorContainer = document.getElementById('errorContainer');
    
    // Counters
    this.backlogCount = document.getElementById('backlogCount');
    this.sprintCount = document.getElementById('sprintCount');
    
    // Stats
    this.statTotalTickets = document.getElementById('statTotalTickets');
    this.statCompletedTickets = document.getElementById('statCompletedTickets');
    this.statEstimatedHours = document.getElementById('statEstimatedHours');
    this.statProgress = document.getElementById('statProgress');
    
    // Filters
    this.backlogSearch = document.getElementById('backlogSearch');
    this.backlogFilter = document.getElementById('backlogFilter');
    this.sprintSearch = document.getElementById('sprintSearch');
    this.sprintStateFilter = document.getElementById('sprintStateFilter');
    
    // Modals
    this.sprintModal = document.getElementById('sprintModal');
    this.closeSprintModal = document.getElementById('closeSprintModal');
    this.cancelSprintBtn = document.getElementById('cancelSprintBtn');
    this.saveSprintBtn = document.getElementById('saveSprintBtn');
    this.sprintName = document.getElementById('sprintName');
    this.sprintStartDate = document.getElementById('sprintStartDate');
    this.sprintEndDate = document.getElementById('sprintEndDate');
    this.sprintGoal = document.getElementById('sprintGoal');
    
    this.estimationModal = document.getElementById('estimationModal');
    this.closeEstimationModal = document.getElementById('closeEstimationModal');
    this.cancelEstimationBtn = document.getElementById('cancelEstimationBtn');
    this.saveEstimationBtn = document.getElementById('saveEstimationBtn');
    this.estimatedHours = document.getElementById('estimatedHours');
    this.estimationTicketId = document.getElementById('estimationTicketId');
    
    // State
    this.tickets = [];
    this.currentSprintId = 'backlog';
    this.currentSprintTickets = null; // Cache of filtered sprint tickets for stats
    this.editingSprintId = null;
    this.editingTicketId = null;
    this.draggedTicketId = null;
    this.api = null;
    
    this.init();
  }
  
  async init() {
    await this.initAPI();
    this.initEventListeners();
    await this.loadData();
  }
  
  async initAPI() {
    // Load API settings from storage (same way as dashboard.js)
    const apiSettings = await storage.load('zammadApiSettings');

    logger.info('Loaded API settings from storage:', {
      hasSettings: !!apiSettings,
      hasBaseUrl: !!(apiSettings && apiSettings.baseUrl),
      hasToken: !!(apiSettings && apiSettings.token),
      baseUrl: (apiSettings && apiSettings.baseUrl) ? apiSettings.baseUrl.substring(0, 20) + '...' : 'undefined',
      tokenLength: (apiSettings && apiSettings.token) ? apiSettings.token.length : 0
    });

    if (!apiSettings || !apiSettings.baseUrl || !apiSettings.token) {
      logger.warn('API not configured - cannot load tickets');
      this.showError('ERROR: Zammad API is not configured. Please go to Options and configure your Zammad URL and API token. Sprint planning requires API access to load tickets.');
      // Leave API as null so loadData() will try to load from cache
      return;
    }

    try {
      this.api = new ZammadAPI();
      await this.api.init(apiSettings.baseUrl, apiSettings.token);

      // Verify that sprint tag methods are available
      if (!this.api.assignTicketToSprint || !this.api.removeTicketFromSprint) {
        logger.error('Sprint tag methods not available on ZammadAPI - api-sprint-tags.js may not be loaded');
        throw new Error('Sprint tag functionality not available. Please reload the extension.');
      }

      logger.info('Zammad API initialized for sprint planning with tag sync support');
    } catch (error) {
      logger.error('Failed to initialize Zammad API:', error);
      this.showError(`Failed to initialize API: ${error.message}. Tag sync will not work.`);
      this.api = null; // Ensure it's null on failure
    }
  }
  
  initEventListeners() {
    // Navigation
    this.backToDashboardBtn?.addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
    
    // Sprint management
    this.createSprintBtn?.addEventListener('click', () => this.openSprintModal());
    this.editSprintBtn?.addEventListener('click', () => this.editCurrentSprint());
    this.startSprintBtn?.addEventListener('click', () => this.startSprint());
    this.completeSprintBtn?.addEventListener('click', () => this.completeSprint());
    this.refreshBtn?.addEventListener('click', () => this.loadData());
    
    // Sprint selection
    this.sprintSelect?.addEventListener('change', (e) => {
      this.currentSprintId = e.target.value;
      this.updateSprintView();
    });
    
    // Modal controls
    this.closeSprintModal?.addEventListener('click', () => this.closeModals());
    this.cancelSprintBtn?.addEventListener('click', () => this.closeModals());
    this.saveSprintBtn?.addEventListener('click', () => this.saveSprint());
    
    this.closeEstimationModal?.addEventListener('click', () => this.closeModals());
    this.cancelEstimationBtn?.addEventListener('click', () => this.closeModals());
    this.saveEstimationBtn?.addEventListener('click', () => this.saveEstimation());
    
    // Close modal on background click
    this.sprintModal?.addEventListener('click', (e) => {
      if (e.target === this.sprintModal) this.closeModals();
    });
    this.estimationModal?.addEventListener('click', (e) => {
      if (e.target === this.estimationModal) this.closeModals();
    });
    
    // Filters
    this.backlogSearch?.addEventListener('input', () => this.filterTickets());
    this.backlogFilter?.addEventListener('change', () => this.filterTickets());
    this.sprintSearch?.addEventListener('input', () => this.filterTickets());
    this.sprintStateFilter?.addEventListener('change', () => this.filterTickets());
    
    // Drag and drop
    this.setupDragAndDrop();
  }
  
  setupDragAndDrop() {
    [this.backlogTickets, this.sprintTickets].forEach(container => {
      if (!container) return;
      
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        container.classList.add('drag-over');
      });
      
      container.addEventListener('dragleave', () => {
        container.classList.remove('drag-over');
      });
      
      container.addEventListener('drop', async (e) => {
        e.preventDefault();
        container.classList.remove('drag-over');
        
        const ticketId = parseInt(e.dataTransfer.getData('text/plain'));
        const targetZone = container.dataset.droppable;
        
        await this.moveTicket(ticketId, targetZone);
      });
    });
  }
  
  async loadData() {
    this.showLoading(true);
    this.showError('');

    try {
      // Load sprints
      const sprints = await sprintManager.getSprints();
      this.populateSprintSelect(sprints);

      // Load tickets from cache first (populated by dashboard or previous API calls)
      logger.info('Attempting to load tickets from cache first...');
      this.tickets = await this.loadTicketsFromCache();

      // Ensure all cached tickets have a tags property (may not be set in cache)
      if (this.tickets && Array.isArray(this.tickets)) {
        this.tickets.forEach(ticket => {
          if (!ticket.tags) {
            ticket.tags = [];
          }
        });
      }

      // If cache is empty and API is available, fetch from API
      if ((!this.tickets || this.tickets.length === 0) && this.api) {
        try {
          logger.info('Cache is empty, loading tickets from Zammad API...');
          logger.info('API object exists:', {
            initialized: this.api.initialized,
            validated: this.api.validated,
            hasBaseUrl: !!this.api.baseUrl,
            hasToken: !!this.api.token
          });
          this.tickets = await this.api.getTickets();
          logger.info(`Loaded ${this.tickets ? this.tickets.length : 'null/undefined'} tickets from API`);

          // Ensure tickets is an array
          if (!this.tickets) {
            logger.warn('API returned null/undefined, setting to empty array');
            this.tickets = [];
          }
        } catch (apiError) {
          logger.warn('Failed to load from API:', apiError);
          // tickets already set from cache (might be empty)
        }
      } else {
        logger.info(`Using ${this.tickets.length} tickets from cache`);
      }

      // Only load tags if we have API and tickets
      if (this.api && this.tickets && this.tickets.length > 0) {
        // Try to enrich tickets with tags for sprint filtering
        // This is optional - if it fails, all tickets will be considered backlog tickets
        try {
          logger.info('Loading tags for tickets...');
          await this.loadTagsForTickets();
          logger.info('Tags loaded successfully - sprint assignments will sync via Zammad');
        } catch (tagError) {
          logger.warn('Failed to load tags from Zammad, tickets without tags will be in backlog:', tagError);

          // Check if it's an authentication error
          if (tagError.message && (tagError.message.includes('403') || tagError.message.includes('authorization') || tagError.message.includes('Access denied'))) {
            this.showError('Warning: Cannot access Zammad tags - authentication failed. Your API token may not have permission to read/write tags. All tickets will appear in the backlog. Please check your Zammad permissions.');
          } else {
            this.showError('Warning: Could not load sprint tags from Zammad. All tickets will appear in backlog. ' + tagError.message);
          }

          // Don't set api to null - just ensure all tickets have empty tags array
          // so they'll be filtered as backlog tickets by getBacklogTickets()
          this.tickets.forEach(ticket => {
            if (!ticket.tags) {
              ticket.tags = [];
            }
          });
        }
      } else if (!this.api) {
        logger.info('No API available - tickets loaded from cache without tag filtering');
      }
      
      // Check if we have any tickets loaded
      if (!this.tickets || this.tickets.length === 0) {
        logger.warn('No tickets loaded - showing detailed message to user');
        logger.warn('Debug info:', {
          hasApi: !!this.api,
          ticketsValue: this.tickets,
          ticketsIsArray: Array.isArray(this.tickets)
        });

        let errorMsg = 'No tickets found. ';
        if (!this.api) {
          errorMsg += 'The Zammad API is not configured or failed to initialize. Please check Options and ensure your Zammad URL and API token are correct. ';
        } else {
          errorMsg += 'The API is configured but returned no tickets. This could mean: (1) You have no tickets assigned to you in Zammad, (2) Your API token does not have permission to read tickets, or (3) No user IDs are configured in Options. ';
        }
        errorMsg += 'Check the browser console (F12) for more details.';

        this.showError(errorMsg);
        this.showLoading(false);
        return;
      }

      logger.info(`Total tickets loaded: ${this.tickets.length}`);
      await this.renderTickets();

      this.showLoading(false);
      this.sprintBoard.style.display = 'grid';
    } catch (error) {
      logger.error('Error loading sprint data:', error);
      this.showError('Failed to load data: ' + error.message);
      this.showLoading(false);
    }
  }
  
  async loadTicketsFromCache() {
    logger.info('Loading tickets from Chrome storage (zammadTicketCache)');

    try {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(['zammadTicketCache'], (result) => {
          if (chrome.runtime.lastError) {
            logger.error('Error reading from storage:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }

          if (result.zammadTicketCache) {
            // zammadTicketCache is an object with cache keys
            // Collect all tickets from all cache keys
            const allTickets = [];
            for (const key in result.zammadTicketCache) {
              const tickets = result.zammadTicketCache[key];
              if (Array.isArray(tickets)) {
                allTickets.push(...tickets);
              }
            }

            // Remove duplicates by ticket ID
            const uniqueTickets = Array.from(
              new Map(allTickets.map(t => [t.id, t])).values()
            );

            logger.info(`Loaded ${uniqueTickets.length} unique tickets from Chrome storage`);
            resolve(uniqueTickets);
          } else {
            logger.warn('No zammadTicketCache found in Chrome storage');
            resolve([]);
          }
        });
      });
    } catch (error) {
      logger.error('Error accessing Chrome storage:', error);
      return [];
    }
  }

  /**
   * Load tags for all tickets from Zammad API
   * This enriches ticket objects with their tags for sprint filtering
   */
  async loadTagsForTickets() {
    if (!this.api || !this.tickets || this.tickets.length === 0) {
      logger.warn('Cannot load tags: API not initialized or no tickets');
      return;
    }

    logger.info(`Loading tags for ${this.tickets.length} tickets...`);

    // Test with first ticket to fail fast on auth errors
    if (this.tickets.length > 0) {
      try {
        logger.info(`Testing tag access with ticket ${this.tickets[0].id}...`);
        const testTags = await this.api.getTicketTags(this.tickets[0].id);
        this.tickets[0].tags = testTags || [];
        logger.info(`✓ Tag access confirmed, proceeding with remaining ${this.tickets.length - 1} tickets`);
      } catch (testError) {
        logger.error('Failed to load tags for test ticket - aborting tag loading:', testError);
        throw new Error(`Tag loading failed: ${testError.message}`);
      }
    }

    // Process remaining tickets in batches to avoid overwhelming the API
    const batchSize = 10;
    const batches = [];
    const remainingTickets = this.tickets.slice(1); // Skip first ticket (already loaded)

    for (let i = 0; i < remainingTickets.length; i += batchSize) {
      batches.push(remainingTickets.slice(i, i + batchSize));
    }

    let processedCount = 1; // Start at 1 since we already loaded the first ticket
    for (const batch of batches) {
      await Promise.all(batch.map(async (ticket) => {
        try {
          const tags = await this.api.getTicketTags(ticket.id);
          ticket.tags = tags || [];
          processedCount++;
        } catch (error) {
          logger.warn(`Failed to load tags for ticket ${ticket.id}:`, error);
          ticket.tags = []; // Set empty tags array on failure
        }
      }));

      if (batches.length > 5) { // Only log progress for large batches
        logger.info(`Loaded tags for ${processedCount}/${this.tickets.length} tickets`);
      }
    }

    logger.info(`✓ Finished loading tags for all ${this.tickets.length} tickets`);
  }
  
  
  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ZammadTimeTracker', 2);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
  
  populateSprintSelect(sprints) {
    // Clear existing options except backlog
    while (this.sprintSelect.options.length > 1) {
      this.sprintSelect.remove(1);
    }
    
    // Add sprints
    sprints.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    sprints.forEach(sprint => {
      const option = document.createElement('option');
      option.value = sprint.id;
      option.textContent = `${sprint.name} (${sprint.status})`;
      this.sprintSelect.appendChild(option);
    });
    
    // Select active sprint or backlog
    const activeSprint = sprints.find(s => s.status === 'active');
    if (activeSprint) {
      this.currentSprintId = activeSprint.id;
      this.sprintSelect.value = activeSprint.id;
    }
    
    this.updateSprintView();
  }
  
  async updateSprintView() {
    if (this.currentSprintId === 'backlog') {
      this.sprintInfo.style.display = 'none';
      this.sprintStats.style.display = 'none';
    } else {
      const sprint = await sprintManager.getSprint(parseInt(this.currentSprintId));
      if (sprint) {
        this.sprintInfo.style.display = 'flex';
        this.sprintStats.style.display = 'flex';
        
        const startDate = new Date(sprint.startDate).toLocaleDateString();
        const endDate = new Date(sprint.endDate).toLocaleDateString();
        document.getElementById('sprintDates').textContent = `${startDate} - ${endDate}`;
        
        // Show/hide action buttons based on status
        this.startSprintBtn.style.display = sprint.status === 'planned' ? 'inline-block' : 'none';
        this.completeSprintBtn.style.display = sprint.status === 'active' ? 'inline-block' : 'none';
        
        // Update stats
        await this.updateStats(sprint);
      }
    }
    
    await this.renderTickets();
  }
  
  async updateStats(sprint) {
    // Use pre-filtered sprint tickets if available (from Zammad tags)
    const ticketsPreFiltered = this.currentSprintTickets ? true : false;
    const ticketsToUse = this.currentSprintTickets || this.tickets;

    const stats = await sprintManager.getSprintStats(
      sprint.id,
      ticketsToUse,
      ticketsPreFiltered
    );

    this.statTotalTickets.textContent = stats.totalTickets;
    this.statCompletedTickets.textContent = stats.completedTickets;
    this.statEstimatedHours.textContent = stats.estimatedHours + 'h';

    const progress = stats.totalTickets > 0
      ? Math.round((stats.completedTickets / stats.totalTickets) * 100)
      : 0;
    this.statProgress.textContent = progress + '%';
  }
  
  async renderTickets() {
    // Use Zammad tags to filter tickets by sprint (synced across users)
    let sprintTickets = [];
    let backlogTickets = [];

    logger.info(`renderTickets called with ${this.tickets.length} total tickets, API available: ${!!this.api}, currentSprintId: ${this.currentSprintId}`);

    if (this.api) {
      // Filter tickets using Zammad tags
      logger.info('Using API-based tag filtering for tickets');
      if (this.currentSprintId !== 'backlog') {
        // Get tickets with this sprint tag from Zammad
        sprintTickets = await this.api.getSprintTickets(
          parseInt(this.currentSprintId),
          this.tickets
        );
        // Backlog = all tickets without any sprint tag
        backlogTickets = await this.api.getBacklogTickets(this.tickets);
      } else {
        // Viewing backlog - show only untagged tickets
        sprintTickets = [];
        backlogTickets = await this.api.getBacklogTickets(this.tickets);
      }
      logger.info(`After API filtering: ${backlogTickets.length} backlog tickets, ${sprintTickets.length} sprint tickets`);
    } else {
      // Fallback: use IndexedDB if API not available
      logger.warn('API not available, using local IndexedDB for ticket filtering');
      const sprintAssignments = this.currentSprintId !== 'backlog'
        ? await sprintManager.getSprintTickets(parseInt(this.currentSprintId))
        : [];
      const allAssignments = this.currentSprintId === 'backlog'
        ? await sprintManager.getAllSprintAssignments()
        : sprintAssignments;

      const sprintTicketIds = new Set(sprintAssignments.map(a => a.ticketId));
      const allAssignedTicketIds = new Set(allAssignments.map(a => a.ticketId));

      backlogTickets = this.tickets.filter(t => !allAssignedTicketIds.has(t.id));
      sprintTickets = this.tickets.filter(t => sprintTicketIds.has(t.id));
      logger.info(`After IndexedDB filtering: ${backlogTickets.length} backlog tickets, ${sprintTickets.length} sprint tickets`);
    }

    // Store current sprint tickets for stats calculation
    this.currentSprintTickets = sprintTickets;

    // Get local assignments for time estimates only
    const localAssignments = this.currentSprintId !== 'backlog'
      ? await sprintManager.getSprintTickets(parseInt(this.currentSprintId))
      : [];
    const assignmentMap = new Map(localAssignments.map(a => [a.ticketId, a]));

    this.renderTicketList(this.backlogTickets, backlogTickets, assignmentMap, false);
    this.renderTicketList(this.sprintTickets, sprintTickets, assignmentMap, true);

    this.backlogCount.textContent = backlogTickets.length;
    this.sprintCount.textContent = sprintTickets.length;

    this.filterTickets();
  }
  
  renderTicketList(container, tickets, assignmentMap, inSprint) {
    container.innerHTML = '';
    
    if (tickets.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = inSprint 
        ? 'Drag tickets here to add to sprint'
        : 'No tickets in backlog';
      container.appendChild(emptyState);
      return;
    }
    
    tickets.forEach(ticket => {
      const card = this.createTicketCard(ticket, assignmentMap.get(ticket.id), inSprint);
      container.appendChild(card);
    });
  }
  
  createTicketCard(ticket, assignment, inSprint) {
    const card = document.createElement('div');
    card.className = 'sprint-ticket-card' + (inSprint ? ' in-sprint' : '');
    card.draggable = true;
    card.dataset.ticketId = ticket.id;
    card.dataset.state = this.getTicketState(ticket);
    card.dataset.title = ticket.title.toLowerCase();
    
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', ticket.id);
      card.classList.add('dragging');
      this.draggedTicketId = ticket.id;
    });
    
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      this.draggedTicketId = null;
    });
    
    const state = this.getTicketState(ticket);
    const priority = ticket.priority_id || ticket.priority || 2;
    
    card.innerHTML = `
      <div class="ticket-header">
        <span class="ticket-number">#${ticket.number}</span>
        <span class="ticket-state-badge state-${state}">${state}</span>
      </div>
      <div class="ticket-title-text">${this.escapeHtml(ticket.title)}</div>
      <div class="ticket-meta">
        <span class="ticket-meta-item">
          <span class="priority-badge priority-${priority}">P${priority}</span>
        </span>
        ${ticket.owner ? `<span class="ticket-meta-item">👤 ${this.escapeHtml(ticket.owner.firstname || 'Unassigned')}</span>` : ''}
        ${ticket.group ? `<span class="ticket-meta-item">📁 ${this.escapeHtml(ticket.group.name || '')}</span>` : ''}
      </div>
      ${inSprint ? `
        <div class="ticket-estimate">
          <span>⏱️ Estimate:</span>
          <span class="estimate-value">${assignment?.estimatedHours || 0}h</span>
          <button class="estimate-edit-btn" data-ticket-id="${ticket.id}">Edit</button>
        </div>
      ` : ''}
    `;
    
    // Add click handler for estimate button
    if (inSprint) {
      const editBtn = card.querySelector('.estimate-edit-btn');
      editBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEstimationModal(ticket.id, assignment?.estimatedHours || 0);
      });
    }
    
    return card;
  }
  
  getTicketState(ticket) {
    const state = ticket.state?.toLowerCase() || '';
    if (state.includes('new')) return 'new';
    if (state.includes('open')) return 'open';
    if (state.includes('progress') || state.includes('pending reminder')) return 'progress';
    if (state.includes('waiting') || state.includes('pending close')) return 'waiting';
    if (state.includes('closed')) return 'closed';
    return 'open';
  }
  
  filterTickets() {
    const backlogQuery = this.backlogSearch?.value.toLowerCase() || '';
    const backlogState = this.backlogFilter?.value || 'all';
    const sprintQuery = this.sprintSearch?.value.toLowerCase() || '';
    const sprintState = this.sprintStateFilter?.value || 'all';
    
    this.filterTicketList(this.backlogTickets, backlogQuery, backlogState);
    this.filterTicketList(this.sprintTickets, sprintQuery, sprintState);
  }
  
  filterTicketList(container, query, stateFilter) {
    const cards = container.querySelectorAll('.sprint-ticket-card');
    let visibleCount = 0;
    
    cards.forEach(card => {
      const title = card.dataset.title || '';
      const state = card.dataset.state || '';
      
      const matchesQuery = !query || title.includes(query);
      const matchesState = stateFilter === 'all' || state === stateFilter;
      
      if (matchesQuery && matchesState) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });
    
    // Show/hide empty state
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }
  
  async moveTicket(ticketId, targetZone) {
    try {
      if (targetZone === 'backlog') {
        // Remove from sprint in Zammad (synced across users)
        if (this.api) {
          try {
            logger.info(`Removing sprint tag from ticket ${ticketId} in Zammad...`);
            await this.api.removeTicketFromSprint(ticketId);
            logger.info(`✓ Sprint tag removed from ticket ${ticketId} in Zammad`);
          } catch (tagError) {
            logger.error(`Failed to remove sprint tag from ticket ${ticketId} in Zammad:`, tagError);
            this.showError(`Warning: Failed to remove tag from Zammad for ticket #${ticketId}. ${tagError.message}. The ticket is removed locally only.`);
            // Continue with local assignment removal even if Zammad fails
          }
        } else {
          logger.warn('API not initialized - ticket removed locally only, not synced to Zammad');
          this.showError(`Warning: API not configured. Ticket #${ticketId} removed from sprint locally only. Configure API in Options to sync tags to Zammad.`);
        }
        // Also remove local assignment for time estimates
        await sprintManager.removeTicketFromSprint(ticketId);
        logger.info(`Ticket ${ticketId} removed from sprint (local)`);
      } else if (targetZone === 'sprint' && this.currentSprintId !== 'backlog') {
        // Assign to sprint in Zammad (synced across users)
        if (this.api) {
          try {
            logger.info(`Adding tag sprint-${this.currentSprintId} to ticket ${ticketId} in Zammad...`);
            await this.api.assignTicketToSprint(ticketId, parseInt(this.currentSprintId));
            logger.info(`✓ Tag sprint-${this.currentSprintId} added to ticket ${ticketId} in Zammad`);
          } catch (tagError) {
            logger.error(`Failed to add tag to ticket ${ticketId} in Zammad:`, tagError);
            this.showError(`Warning: Failed to sync tag to Zammad for ticket #${ticketId}. ${tagError.message}. The ticket is assigned locally only.`);
            // Continue with local assignment even if Zammad fails
          }
        } else {
          logger.warn('API not initialized - ticket assigned locally only, not synced to Zammad');
          this.showError(`Warning: API not configured. Ticket #${ticketId} assigned locally only. Configure API in Options to sync tags to Zammad.`);
        }
        // Also create local assignment for time estimates
        await sprintManager.assignTicketToSprint(ticketId, parseInt(this.currentSprintId));
        logger.info(`Ticket ${ticketId} assigned to sprint ${this.currentSprintId} (local)`);
      }

      await this.renderTickets();
      if (this.currentSprintId !== 'backlog') {
        const sprint = await sprintManager.getSprint(parseInt(this.currentSprintId));
        await this.updateStats(sprint);
      }
    } catch (error) {
      logger.error('Error moving ticket:', error);
      this.showError('Failed to move ticket: ' + error.message);
    }
  }
  
  openSprintModal(sprint = null) {
    this.editingSprintId = sprint?.id || null;
    
    if (sprint) {
      document.getElementById('sprintModalTitle').textContent = 'Edit Sprint';
      this.sprintName.value = sprint.name;
      this.sprintStartDate.value = sprint.startDate.split('T')[0];
      this.sprintEndDate.value = sprint.endDate.split('T')[0];
      this.sprintGoal.value = sprint.goal || '';
    } else {
      document.getElementById('sprintModalTitle').textContent = 'Create New Sprint';
      this.sprintName.value = '';
      this.sprintStartDate.value = '';
      this.sprintEndDate.value = '';
      this.sprintGoal.value = '';
    }
    
    this.sprintModal.style.display = 'flex';
  }
  
  async editCurrentSprint() {
    if (this.currentSprintId !== 'backlog') {
      const sprint = await sprintManager.getSprint(parseInt(this.currentSprintId));
      this.openSprintModal(sprint);
    }
  }
  
  async saveSprint() {
    const name = this.sprintName.value.trim();
    const startDate = this.sprintStartDate.value;
    const endDate = this.sprintEndDate.value;
    const goal = this.sprintGoal.value.trim();
    
    if (!name || !startDate || !endDate) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      if (this.editingSprintId) {
        await sprintManager.updateSprint(this.editingSprintId, { name, startDate, endDate, goal });
      } else {
        await sprintManager.createSprint(name, startDate, endDate, goal);
      }
      
      this.closeModals();
      await this.loadData();
    } catch (error) {
      logger.error('Error saving sprint:', error);
      alert('Failed to save sprint: ' + error.message);
    }
  }
  
  async startSprint() {
    if (confirm('Start this sprint? This will end any currently active sprint.')) {
      try {
        await sprintManager.startSprint(parseInt(this.currentSprintId));
        await this.loadData();
      } catch (error) {
        logger.error('Error starting sprint:', error);
        this.showError('Failed to start sprint: ' + error.message);
      }
    }
  }
  
  async completeSprint() {
    if (confirm('Complete this sprint? Unfinished tickets will return to the backlog.')) {
      try {
        await sprintManager.completeSprint(parseInt(this.currentSprintId));
        this.currentSprintId = 'backlog';
        this.sprintSelect.value = 'backlog';
        await this.loadData();
      } catch (error) {
        logger.error('Error completing sprint:', error);
        this.showError('Failed to complete sprint: ' + error.message);
      }
    }
  }
  
  openEstimationModal(ticketId, currentEstimate) {
    this.editingTicketId = ticketId;
    this.estimationTicketId.textContent = ticketId;
    this.estimatedHours.value = currentEstimate || '';
    this.estimationModal.style.display = 'flex';
  }
  
  async saveEstimation() {
    const hours = parseFloat(this.estimatedHours.value) || 0;
    
    try {
      await sprintManager.assignTicketToSprint(
        this.editingTicketId,
        parseInt(this.currentSprintId),
        hours
      );
      
      this.closeModals();
      await this.renderTickets();
      
      const sprint = await sprintManager.getSprint(parseInt(this.currentSprintId));
      await this.updateStats(sprint);
    } catch (error) {
      logger.error('Error saving estimation:', error);
      alert('Failed to save estimation: ' + error.message);
    }
  }
  
  closeModals() {
    this.sprintModal.style.display = 'none';
    this.estimationModal.style.display = 'none';
    this.editingSprintId = null;
    this.editingTicketId = null;
  }
  
  showLoading(show) {
    this.loadingContainer.style.display = show ? 'block' : 'none';
  }
  
  showError(message) {
    if (message) {
      this.errorContainer.textContent = message;
      this.errorContainer.style.display = 'block';
    } else {
      this.errorContainer.style.display = 'none';
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SprintPlanningUI();
});
