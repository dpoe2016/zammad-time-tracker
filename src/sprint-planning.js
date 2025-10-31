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
    const config = await storage.loadMultiple(['baseUrl', 'apiToken']);
    if (!config.baseUrl || !config.apiToken) {
      this.showError('API not configured. Please go to Options and set your Zammad URL and API token.');
      return;
    }
    
    this.api = new ZammadAPI(config.baseUrl, config.apiToken);
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
      
      // Load tickets from API or IndexedDB cache
      if (this.api) {
        try {
          this.tickets = await this.api.getTickets();
        } catch (apiError) {
          logger.warn('Failed to load from API, trying cache:', apiError);
          // Fallback to IndexedDB cache
          this.tickets = await this.loadTicketsFromCache();
        }
      } else {
        // No API configured, load from cache
        this.tickets = await this.loadTicketsFromCache();
      }
      
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
    logger.info('Loading tickets from IndexedDB cache');
    
    try {
      const db = await this.openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['ticketCache'], 'readonly');
        const store = transaction.objectStore('ticketCache');
        const request = store.getAll();
        
        request.onsuccess = () => {
          const cachedData = request.result;
          
          if (cachedData && cachedData.length > 0) {
            // Extract tickets from cache entries
            const allTickets = [];
            cachedData.forEach(entry => {
              if (entry.tickets && Array.isArray(entry.tickets)) {
                allTickets.push(...entry.tickets);
              }
            });
            
            // Remove duplicates by ticket ID
            const uniqueTickets = Array.from(
              new Map(allTickets.map(t => [t.id, t])).values()
            );
            
            logger.info(`Loaded ${uniqueTickets.length} tickets from cache`);
            resolve(uniqueTickets);
          } else {
            logger.warn('No tickets found in cache');
            resolve([]);
          }
        };
        
        request.onerror = () => {
          logger.error('Error reading ticket cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Error accessing IndexedDB:', error);
      return [];
    }
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
    const stats = await sprintManager.getSprintStats(sprint.id, this.tickets);
    
    this.statTotalTickets.textContent = stats.totalTickets;
    this.statCompletedTickets.textContent = stats.completedTickets;
    this.statEstimatedHours.textContent = stats.estimatedHours + 'h';
    
    const progress = stats.totalTickets > 0 
      ? Math.round((stats.completedTickets / stats.totalTickets) * 100)
      : 0;
    this.statProgress.textContent = progress + '%';
  }
  
  async renderTickets() {
    const sprintAssignments = this.currentSprintId !== 'backlog' 
      ? await sprintManager.getSprintTickets(parseInt(this.currentSprintId))
      : [];
    
    const sprintTicketIds = new Set(sprintAssignments.map(a => a.ticketId));
    const assignmentMap = new Map(sprintAssignments.map(a => [a.ticketId, a]));
    
    const backlogTickets = this.tickets.filter(t => !sprintTicketIds.has(t.id));
    const currentSprintTickets = this.tickets.filter(t => sprintTicketIds.has(t.id));
    
    this.renderTicketList(this.backlogTickets, backlogTickets, assignmentMap, false);
    this.renderTicketList(this.sprintTickets, currentSprintTickets, assignmentMap, true);
    
    this.backlogCount.textContent = backlogTickets.length;
    this.sprintCount.textContent = currentSprintTickets.length;
    
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
        await sprintManager.removeTicketFromSprint(ticketId);
        logger.info(`Ticket ${ticketId} removed from sprint`);
      } else if (targetZone === 'sprint' && this.currentSprintId !== 'backlog') {
        await sprintManager.assignTicketToSprint(ticketId, parseInt(this.currentSprintId));
        logger.info(`Ticket ${ticketId} assigned to sprint ${this.currentSprintId}`);
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
