/**
 * Sprint Planning Module for Zammad Time Tracking Extension
 * Manages sprints, backlog, and sprint assignments
 */

class SprintManager {
  constructor() {
    this.sprints = [];
    this.currentSprint = null;
    this.dbName = 'ZammadTimeTracker';
    this.version = 2;
    this.db = null;
  }

  /**
   * Initialize IndexedDB (reuses shared database)
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Sprint DB initialization failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Sprint DB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = () => {
        // Schema is handled by indexdb.js
        console.log('Sprint DB upgrade handled by shared indexdb.js');
      };
    });
  }

  /**
   * Create a new sprint
   */
  async createSprint(name, startDate, endDate, goal = '') {
    await this.init();

    const sprint = {
      name,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      goal,
      status: 'planned', // planned, active, completed
      createdAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sprints'], 'readwrite');
      const store = transaction.objectStore('sprints');
      const request = store.add(sprint);

      request.onsuccess = () => {
        sprint.id = request.result;
        this.sprints.push(sprint);
        console.log('Sprint created:', sprint);
        resolve(sprint);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all sprints
   */
  async getSprints() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sprints'], 'readonly');
      const store = transaction.objectStore('sprints');
      const request = store.getAll();

      request.onsuccess = () => {
        this.sprints = request.result;
        resolve(this.sprints);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get sprint by ID
   */
  async getSprint(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sprints'], 'readonly');
      const store = transaction.objectStore('sprints');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update sprint
   */
  async updateSprint(id, updates) {
    await this.init();

    return new Promise(async (resolve, reject) => {
      const sprint = await this.getSprint(id);
      if (!sprint) {
        reject(new Error('Sprint not found'));
        return;
      }

      Object.assign(sprint, updates);

      const transaction = this.db.transaction(['sprints'], 'readwrite');
      const store = transaction.objectStore('sprints');
      const request = store.put(sprint);

      request.onsuccess = () => {
        console.log('Sprint updated:', sprint);
        resolve(sprint);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete sprint
   */
  async deleteSprint(id) {
    await this.init();

    return new Promise(async (resolve, reject) => {
      // First, remove all assignments
      await this.removeAllTicketsFromSprint(id);

      const transaction = this.db.transaction(['sprints'], 'readwrite');
      const store = transaction.objectStore('sprints');
      const request = store.delete(id);

      request.onsuccess = () => {
        this.sprints = this.sprints.filter(s => s.id !== id);
        console.log('Sprint deleted:', id);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Assign ticket to sprint
   */
  async assignTicketToSprint(ticketId, sprintId, estimatedHours = null) {
    await this.init();

    // Remove existing assignment if any
    await this.removeTicketFromSprint(ticketId);

    const assignment = {
      ticketId,
      sprintId,
      estimatedHours,
      assignedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sprintAssignments'], 'readwrite');
      const store = transaction.objectStore('sprintAssignments');
      const request = store.add(assignment);

      request.onsuccess = () => {
        assignment.id = request.result;
        console.log('Ticket assigned to sprint:', assignment);
        resolve(assignment);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove ticket from sprint
   */
  async removeTicketFromSprint(ticketId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sprintAssignments'], 'readwrite');
      const store = transaction.objectStore('sprintAssignments');
      const index = store.index('ticketId');
      const request = index.openCursor(IDBKeyRange.only(ticketId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove all tickets from sprint
   */
  async removeAllTicketsFromSprint(sprintId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sprintAssignments'], 'readwrite');
      const store = transaction.objectStore('sprintAssignments');
      const index = store.index('sprintId');
      const request = index.openCursor(IDBKeyRange.only(sprintId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get tickets in sprint
   */
  async getSprintTickets(sprintId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sprintAssignments'], 'readonly');
      const store = transaction.objectStore('sprintAssignments');
      const index = store.index('sprintId');
      const request = index.getAll(IDBKeyRange.only(sprintId));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get sprint for ticket
   */
  async getTicketSprint(ticketId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sprintAssignments'], 'readonly');
      const store = transaction.objectStore('sprintAssignments');
      const index = store.index('ticketId');
      const request = index.get(IDBKeyRange.only(ticketId));

      request.onsuccess = async () => {
        const assignment = request.result;
        if (assignment) {
          const sprint = await this.getSprint(assignment.sprintId);
          resolve({ sprint, assignment });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get active sprint
   */
  async getActiveSprint() {
    const sprints = await this.getSprints();
    return sprints.find(s => s.status === 'active') || null;
  }

  /**
   * Start sprint
   */
  async startSprint(id) {
    // End any currently active sprint
    const activeSprint = await this.getActiveSprint();
    if (activeSprint) {
      await this.updateSprint(activeSprint.id, { status: 'completed' });
    }

    return this.updateSprint(id, { status: 'active' });
  }

  /**
   * Complete sprint
   */
  async completeSprint(id) {
    return this.updateSprint(id, { status: 'completed' });
  }

  /**
   * Get sprint statistics
   */
  async getSprintStats(sprintId, tickets) {
    const assignments = await this.getSprintTickets(sprintId);
    const sprintTicketIds = new Set(assignments.map(a => a.ticketId));
    const sprintTickets = tickets.filter(t => sprintTicketIds.has(t.id));

    const stats = {
      totalTickets: sprintTickets.length,
      completedTickets: sprintTickets.filter(t => t.state_id === 4 || t.state === 'closed').length, // closed state
      estimatedHours: assignments.reduce((sum, a) => sum + (a.estimatedHours || 0), 0),
      actualHours: 0, // TODO: Calculate from time tracking data
      ticketsByState: {
        new: sprintTickets.filter(t => t.state === 'new').length,
        open: sprintTickets.filter(t => t.state === 'open').length,
        progress: sprintTickets.filter(t => t.state === 'pending reminder' || t.state === 'in progress').length,
        waiting: sprintTickets.filter(t => t.state === 'pending close').length,
        closed: sprintTickets.filter(t => t.state === 'closed').length
      }
    };

    return stats;
  }
}

// Create global instance
const sprintManager = new SprintManager();
