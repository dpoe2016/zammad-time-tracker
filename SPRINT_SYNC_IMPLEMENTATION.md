# Sprint Sync Implementation Guide

This guide shows how to implement sprint syncing using Zammad tags.

## Quick Start

### 1. Add the Sprint Tags Extension

Add to your HTML files (after api.js):

```html
<!-- In sprint-planning.html -->
<script src="api.js"></script>
<script src="api-sprint-tags.js"></script>  <!-- New! -->
<script src="sprint.js"></script>
<script src="sprint-planning.js"></script>
```

### 2. Update Sprint Planning UI

The sprint planning UI needs to use Zammad tags for assignments:

```javascript
// In sprint-planning.js, update moveTicket method:
async moveTicket(ticketId, targetZone) {
  try {
    if (targetZone === 'backlog') {
      // Remove from sprint in Zammad
      await this.api.removeTicketFromSprint(ticketId);
      // Also remove local assignment for time estimates
      await sprintManager.removeTicketFromSprint(ticketId);
      logger.info(`Ticket ${ticketId} removed from sprint`);
    } else if (targetZone === 'sprint' && this.currentSprintId !== 'backlog') {
      // Assign to sprint in Zammad
      await this.api.assignTicketToSprint(ticketId, parseInt(this.currentSprintId));
      // Also create local assignment for time estimates
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
```

### 3. Update renderTickets Method

Change how tickets are filtered to use Zammad tags:

```javascript
// In sprint-planning.js, update renderTickets:
async renderTickets() {
  // Get sprint assignments from Zammad tags instead of IndexedDB
  let sprintTickets = [];
  let backlogTickets = [];

  if (this.currentSprintId !== 'backlog') {
    // Get tickets with this sprint tag
    sprintTickets = await this.api.getSprintTickets(
      parseInt(this.currentSprintId),
      this.tickets
    );
    // Backlog = all tickets without any sprint tag
    backlogTickets = await this.api.getBacklogTickets(this.tickets);
  } else {
    // Viewing backlog
    sprintTickets = [];
    backlogTickets = await this.api.getBacklogTickets(this.tickets);
  }

  // Get local assignments for time estimates
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
```

## Testing the Implementation

### Test 1: Add Tag to Ticket

Open browser console and run:

```javascript
// Initialize API
const api = new ZammadAPI();
await api.init();

// Add sprint tag to ticket #123
await api.assignTicketToSprint(123, 1);

// Check tags on ticket
const tags = await api.getTicketTags(123);
console.log('Tags:', tags); // Should include "sprint-1"
```

### Test 2: Get Sprint Tickets

```javascript
// Get all tickets in sprint 1
const tickets = await api.getSprintTickets(1);
console.log(`Found ${tickets.length} tickets in sprint 1`);
```

### Test 3: Get Backlog Tickets

```javascript
// Get all tickets not in any sprint
const backlog = await api.getBacklogTickets();
console.log(`Found ${backlog.length} tickets in backlog`);
```

## Data Flow

### Without Sync (Current - IndexedDB Only)
```
User A: Assigns ticket to sprint → Saved in User A's IndexedDB
User B: Does not see the assignment (different browser/computer)
```

### With Sync (Zammad Tags)
```
User A: Assigns ticket to sprint → Tag added in Zammad → Visible to all users
User B: Refreshes page → Loads tickets from Zammad → Sees the assignment
```

## Migration Strategy

If you already have sprint assignments in IndexedDB:

### Option 1: Migrate Existing Assignments

```javascript
// Migration script - run once
async function migrateSprintsToZammad() {
  const api = new ZammadAPI();
  await api.init();

  // Get all sprints from IndexedDB
  const sprints = await sprintManager.getSprints();

  for (const sprint of sprints) {
    console.log(`Migrating sprint ${sprint.id}: ${sprint.name}`);

    // Get tickets assigned to this sprint (IndexedDB)
    const assignments = await sprintManager.getSprintTickets(sprint.id);

    for (const assignment of assignments) {
      try {
        // Add tag in Zammad
        await api.assignTicketToSprint(assignment.ticketId, sprint.id);
        console.log(`✓ Migrated ticket ${assignment.ticketId} to sprint ${sprint.id}`);
      } catch (error) {
        console.error(`✗ Failed to migrate ticket ${assignment.ticketId}:`, error);
      }
    }
  }

  console.log('Migration complete!');
}

// Run migration
migrateSprintsToZammad();
```

### Option 2: Fresh Start

```javascript
// Clear all local sprint assignments and start using Zammad tags
async function clearLocalAssignments() {
  const sprints = await sprintManager.getSprints();

  for (const sprint of sprints) {
    await sprintManager.removeAllTicketsFromSprint(sprint.id);
  }

  console.log('Local assignments cleared. Use Zammad tags going forward.');
}
```

## Export/Import Sprint Metadata

Since sprint metadata (name, dates, goal) isn't synced, you can export/import:

### Export Sprints

```javascript
async function exportSprints() {
  const sprints = await sprintManager.getSprints();

  const exportData = {
    version: 1,
    exportDate: new Date().toISOString(),
    sprints: sprints
  };

  // Download as JSON
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sprints-export-${Date.now()}.json`;
  a.click();
}
```

### Import Sprints

```javascript
async function importSprints(jsonFile) {
  const text = await jsonFile.text();
  const data = JSON.parse(text);

  for (const sprint of data.sprints) {
    // Check if sprint already exists
    const existing = await sprintManager.getSprint(sprint.id);

    if (!existing) {
      // Create new sprint (will get new auto-increment ID)
      await sprintManager.createSprint(
        sprint.name,
        sprint.startDate,
        sprint.endDate,
        sprint.goal
      );
      console.log(`Imported sprint: ${sprint.name}`);
    } else {
      console.log(`Sprint ${sprint.name} already exists, skipping`);
    }
  }
}
```

## Permissions Required

Make sure your Zammad API token has:
- `ticket.agent` permission (for tag management)
- OR `admin.tag` permission

Test with:
```javascript
const api = new ZammadAPI();
await api.init();

try {
  await api.addTag(123, 'test-tag');
  console.log('✓ Tag permissions OK');
  await api.removeTag(123, 'test-tag');
} catch (error) {
  console.error('✗ Missing tag permissions:', error);
}
```

## Troubleshooting

### Tags not showing up
- Check API token permissions
- Verify ticket ID is correct
- Check browser console for errors

### Different users see different assignments
- Make sure both users refresh the page
- Verify both are using the same Zammad instance
- Check that tags are actually being added (inspect ticket in Zammad UI)

### Performance issues with many tickets
- Tags are indexed, so filtering should be fast
- Consider adding pagination for large datasets
- Cache ticket data with timestamp-based refresh

## Next Steps

1. **Test the tag API** with your Zammad instance
2. **Update sprint-planning.js** to use tag-based assignments
3. **Add export/import** UI for sprint metadata
4. **Document for your team** how to use the synced sprints

