/**
 * Sprint Tag Management Extension for ZammadAPI
 *
 * This adds tag-based sprint assignment methods to the Zammad API client.
 * Tags provide a simple way to sync sprint assignments between users without
 * requiring Zammad admin access for custom fields.
 *
 * Usage:
 * - Tag format: "sprint-{id}" (e.g., "sprint-1", "sprint-2")
 * - Requires: ticket.agent or admin.tag permission
 * - Real-time sync: All users see same sprint assignments via Zammad
 */

/**
 * Add tag-based sprint methods to ZammadAPI
 * Call this to extend the API with sprint tag functionality
 */
function extendZammadAPIWithSprintTags() {
  if (typeof ZammadAPI === 'undefined') {
    console.error('ZammadAPI not found. Make sure api.js is loaded first.');
    return;
  }

  /**
   * Add a tag to a ticket
   * @param {number} ticketId - Ticket ID
   * @param {string} tagName - Tag name to add
   * @returns {Promise} Resolves when tag is added
   */
  ZammadAPI.prototype.addTag = async function(ticketId, tagName) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }
    if (!tagName || typeof tagName !== 'string') {
      throw new Error('Tag name is required and must be a string');
    }

    console.log(`Adding tag "${tagName}" to ticket ${ticketId}`);

    const endpoint = '/api/v1/tags/add';
    const data = {
      item: tagName,
      object: 'Ticket',
      o_id: ticketId
    };

    try {
      const result = await this.request(endpoint, 'POST', data);
      console.log(`Successfully added tag "${tagName}" to ticket ${ticketId}`);
      return result;
    } catch (error) {
      console.error(`Error adding tag to ticket ${ticketId}:`, error);
      throw error;
    }
  };

  /**
   * Remove a tag from a ticket
   * @param {number} ticketId - Ticket ID
   * @param {string} tagName - Tag name to remove
   * @returns {Promise} Resolves when tag is removed
   */
  ZammadAPI.prototype.removeTag = async function(ticketId, tagName) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }
    if (!tagName || typeof tagName !== 'string') {
      throw new Error('Tag name is required and must be a string');
    }

    console.log(`Removing tag "${tagName}" from ticket ${ticketId}`);

    const endpoint = '/api/v1/tags/remove';
    const data = {
      item: tagName,
      object: 'Ticket',
      o_id: ticketId
    };

    try {
      const result = await this.request(endpoint, 'DELETE', data);
      console.log(`Successfully removed tag "${tagName}" from ticket ${ticketId}`);
      return result;
    } catch (error) {
      console.error(`Error removing tag from ticket ${ticketId}:`, error);
      throw error;
    }
  };

  /**
   * Get all tags for a ticket
   * @param {number} ticketId - Ticket ID
   * @returns {Promise<Array<string>>} Array of tag names
   */
  ZammadAPI.prototype.getTicketTags = async function(ticketId) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    console.log(`Getting tags for ticket ${ticketId}`);

    const endpoint = `/api/v1/tags?object=Ticket&o_id=${ticketId}`;

    try {
      const result = await this.request(endpoint, 'GET');

      // Ensure result is an array
      if (!result) {
        console.log(`No tags found for ticket ${ticketId}`);
        return [];
      }

      if (!Array.isArray(result)) {
        console.warn(`API returned non-array for ticket ${ticketId} tags:`, result);
        // If it's an object with tags property, try to use that
        if (result.tags && Array.isArray(result.tags)) {
          return result.tags;
        }
        return [];
      }

      console.log(`Got ${result.length} tags for ticket ${ticketId}`);
      return result;
    } catch (error) {
      console.error(`Error getting tags for ticket ${ticketId}:`, error);
      throw error;
    }
  };

  /**
   * Assign a ticket to a sprint using tags
   * @param {number} ticketId - Ticket ID
   * @param {number} sprintId - Sprint ID
   * @returns {Promise} Resolves when ticket is assigned
   */
  ZammadAPI.prototype.assignTicketToSprint = async function(ticketId, sprintId) {
    if (!ticketId || !sprintId) {
      throw new Error('Ticket ID and Sprint ID are required');
    }

    console.log(`Assigning ticket ${ticketId} to sprint ${sprintId}`);

    // First, remove any existing sprint tags
    let existingTags = await this.getTicketTags(ticketId);

    // Ensure existingTags is an array
    if (!Array.isArray(existingTags)) {
      console.warn(`getTicketTags returned non-array for ticket ${ticketId}:`, existingTags);
      existingTags = [];
    }

    const sprintTags = existingTags.filter(tag => tag.startsWith('sprint-'));

    for (const tag of sprintTags) {
      await this.removeTag(ticketId, tag);
    }

    // Add new sprint tag
    const newTag = `sprint-${sprintId}`;
    await this.addTag(ticketId, newTag);

    console.log(`Successfully assigned ticket ${ticketId} to sprint ${sprintId}`);
  };

  /**
   * Remove a ticket from its sprint
   * @param {number} ticketId - Ticket ID
   * @returns {Promise} Resolves when ticket is removed from sprint
   */
  ZammadAPI.prototype.removeTicketFromSprint = async function(ticketId) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    console.log(`Removing ticket ${ticketId} from sprint`);

    let existingTags = await this.getTicketTags(ticketId);

    // Ensure existingTags is an array
    if (!Array.isArray(existingTags)) {
      console.warn(`getTicketTags returned non-array for ticket ${ticketId}:`, existingTags);
      existingTags = [];
    }

    const sprintTags = existingTags.filter(tag => tag.startsWith('sprint-'));

    for (const tag of sprintTags) {
      await this.removeTag(ticketId, tag);
    }

    console.log(`Successfully removed ticket ${ticketId} from sprint`);
  };

  /**
   * Get the sprint ID for a ticket (from tags)
   * @param {number} ticketId - Ticket ID
   * @returns {Promise<number|null>} Sprint ID or null if not in a sprint
   */
  ZammadAPI.prototype.getTicketSprintId = async function(ticketId) {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    let tags = await this.getTicketTags(ticketId);

    // Ensure tags is an array
    if (!Array.isArray(tags)) {
      console.warn(`getTicketTags returned non-array for ticket ${ticketId}:`, tags);
      return null;
    }

    const sprintTag = tags.find(tag => tag.startsWith('sprint-'));

    if (sprintTag) {
      const sprintId = parseInt(sprintTag.replace('sprint-', ''));
      return isNaN(sprintId) ? null : sprintId;
    }

    return null;
  };

  /**
   * Get all tickets for a sprint (from tags)
   * @param {number} sprintId - Sprint ID
   * @param {Array} allTickets - Optional: array of tickets to filter (avoids API call)
   * @returns {Promise<Array>} Array of tickets in the sprint
   */
  ZammadAPI.prototype.getSprintTickets = async function(sprintId, allTickets = null) {
    if (!sprintId) {
      throw new Error('Sprint ID is required');
    }

    console.log(`Getting tickets for sprint ${sprintId}`);

    // Get all tickets if not provided
    const tickets = allTickets || await this.getTickets();

    // Filter tickets by sprint tag
    const sprintTag = `sprint-${sprintId}`;
    const sprintTickets = tickets.filter(ticket => {
      // Ensure tags is an array
      if (!ticket.tags) {
        return false;
      }
      if (typeof ticket.tags === 'string') {
        // Handle case where tags might be a string
        return ticket.tags === sprintTag;
      }
      if (Array.isArray(ticket.tags)) {
        return ticket.tags.includes(sprintTag);
      }
      return false;
    });

    console.log(`Found ${sprintTickets.length} tickets in sprint ${sprintId}`);
    return sprintTickets;
  };

  /**
   * Get all tickets NOT in any sprint (backlog)
   * @param {Array} allTickets - Optional: array of tickets to filter (avoids API call)
   * @returns {Promise<Array>} Array of backlog tickets
   */
  ZammadAPI.prototype.getBacklogTickets = async function(allTickets = null) {
    console.log('Getting backlog tickets (not in any sprint)');

    // Get all tickets if not provided
    const tickets = allTickets || await this.getTickets();

    // Filter tickets without sprint tags
    const backlogTickets = tickets.filter(ticket => {
      // No tags = backlog ticket
      if (!ticket.tags) {
        return true;
      }

      // Handle string tags (shouldn't happen, but be safe)
      if (typeof ticket.tags === 'string') {
        return !ticket.tags.startsWith('sprint-');
      }

      // Handle array tags (normal case)
      if (Array.isArray(ticket.tags)) {
        return !ticket.tags.some(tag => tag.startsWith('sprint-'));
      }

      // Unknown format, treat as backlog
      return true;
    });

    console.log(`Found ${backlogTickets.length} tickets in backlog`);
    return backlogTickets;
  };

  console.log('ZammadAPI extended with sprint tag methods');
}

// Auto-extend if ZammadAPI is already loaded
if (typeof ZammadAPI !== 'undefined') {
  extendZammadAPIWithSprintTags();
}
