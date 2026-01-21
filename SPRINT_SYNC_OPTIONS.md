# Sprint Planning Sync Options Using Zammad API

This document outlines different approaches for syncing sprint planning data between users using Zammad as the central database.

## Overview

All users already have access to the same Zammad instance, so we can leverage Zammad's API to store and sync sprint assignments without needing a separate database.

---

## Option 1: Tags (✅ RECOMMENDED - Easiest to Implement)

### How it Works
- Use Zammad tags to mark which sprint a ticket belongs to
- Tag format: `sprint-{sprint-id}` (e.g., `sprint-1`, `sprint-2`)
- Store sprint metadata (name, dates, goal) in a special "configuration" ticket or internal article

### API Endpoints
```javascript
// Add ticket to sprint
POST /api/v1/tags/add
{
  "item": "sprint-1",
  "object": "Ticket",
  "o_id": 123
}

// Remove ticket from sprint
DELETE /api/v1/tags/remove
{
  "item": "sprint-1",
  "object": "Ticket",
  "o_id": 123
}

// Get tags for a ticket
GET /api/v1/tags?object=Ticket&o_id=123
```

### Pros
- ✅ **No admin setup required** - works immediately with existing API token
- ✅ **Simple to implement** - just add/remove tags
- ✅ **Fast** - tags are indexed in Zammad
- ✅ **Requires only `ticket.agent` permission**

### Cons
- ❌ Can't store time estimates on tickets (need separate storage)
- ❌ One tag per sprint (but that's usually what you want)
- ❌ Sprint metadata (name, dates) needs separate storage

### Best For
Quick implementation without admin access to Zammad configuration.

---

## Option 2: Custom Fields (✅ BEST - Most Proper Solution)

### How it Works
- Create custom ticket fields in Zammad Object Manager:
  - `sprint_id` (integer or text)
  - `sprint_estimated_hours` (decimal)
- Update tickets with sprint assignments using the Tickets API

### Setup Required
1. Login to Zammad as admin
2. Go to **Admin → Objects → Ticket**
3. Add new field: `sprint_id` (Type: Integer or Text)
4. Add new field: `sprint_estimated_hours` (Type: Decimal)
5. Click "Update Database" and restart Zammad

### API Endpoints
```javascript
// Assign ticket to sprint with estimate
PUT /api/v1/tickets/{ticket_id}
{
  "sprint_id": 1,
  "sprint_estimated_hours": 8.5
}

// Remove from sprint
PUT /api/v1/tickets/{ticket_id}
{
  "sprint_id": null,
  "sprint_estimated_hours": null
}

// Tickets automatically include custom fields in responses
GET /api/v1/tickets/{ticket_id}
// Response includes: { ..., "sprint_id": 1, "sprint_estimated_hours": 8.5 }
```

### Pros
- ✅ **Proper data structure** - custom fields are first-class attributes
- ✅ **Can store multiple fields** - sprint ID + estimates
- ✅ **Searchable** - can query tickets by sprint
- ✅ **Visible in Zammad UI** - agents can see sprint assignments
- ✅ **Real-time sync** - all users see same data immediately

### Cons
- ❌ **Requires admin access** to create custom fields
- ❌ **Needs Zammad restart** after adding fields
- ❌ Sprint metadata (name, dates, goal) still needs separate storage

### Best For
Production use when you have admin access to Zammad.

---

## Option 3: Internal Articles/Notes (⚠️ Workaround)

### How it Works
- Create a special "Sprint Dashboard" ticket in Zammad
- Store sprint metadata as JSON in internal articles
- Store ticket assignments in separate articles

### API Endpoints
```javascript
// Create internal note with sprint data
POST /api/v1/ticket_articles
{
  "ticket_id": 999,  // Special "Sprint Dashboard" ticket
  "body": JSON.stringify({
    sprint_id: 1,
    name: "Sprint 1",
    startDate: "2024-01-01",
    endDate: "2024-01-14",
    tickets: [123, 456, 789]
  }),
  "type": "note",
  "internal": true,
  "content_type": "text/plain"
}

// Get all articles (sprint data)
GET /api/v1/ticket_articles/by_ticket/999
```

### Pros
- ✅ **No admin setup required**
- ✅ **Can store unlimited metadata**
- ✅ **Works with existing API token**

### Cons
- ❌ **Not intended for this use case**
- ❌ **Articles accumulate over time** (need cleanup)
- ❌ **Not searchable** by sprint attributes
- ❌ **Messy** - parsing JSON from articles

### Best For
Emergency workaround when other options aren't available.

---

## Option 4: Hybrid Approach (✅ RECOMMENDED IF NO ADMIN ACCESS)

### How it Works
Combine Tags + IndexedDB for best of both worlds:

**For Sprint Assignments (synced):**
- Use Zammad tags (`sprint-1`, `sprint-2`) to mark which tickets are in which sprint
- All users see the same sprint assignments via Zammad API

**For Sprint Metadata (local):**
- Keep sprint metadata (name, dates, goal, status) in IndexedDB (current implementation)
- Export/import sprint definitions as JSON when needed

### Implementation
```javascript
// Assign ticket to sprint
async function assignToSprint(ticketId, sprintId) {
  // 1. Add Zammad tag
  await api.addTag(ticketId, `sprint-${sprintId}`);

  // 2. Store locally for time estimates (not synced)
  await sprintManager.assignTicketToSprint(ticketId, sprintId, estimatedHours);
}

// Load sprint tickets
async function loadSprintTickets(sprintId) {
  // Get all tickets with this sprint tag
  const allTickets = await api.getTickets();
  const sprintTickets = allTickets.filter(ticket =>
    ticket.tags?.includes(`sprint-${sprintId}`)
  );
  return sprintTickets;
}
```

### Pros
- ✅ **Sprint assignments synced** between users
- ✅ **No admin setup required**
- ✅ **Works immediately**
- ✅ **Sprint metadata kept simple**

### Cons
- ❌ Time estimates not synced (remain local)
- ❌ Sprint names/dates not synced (need manual export/import)

### Best For
Teams that want basic sprint sync without Zammad admin access.

---

## Comparison Table

| Feature | Tags | Custom Fields | Articles | Hybrid |
|---------|------|---------------|----------|--------|
| **Admin Access Required** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Sprint Assignments Synced** | ✅ Yes | ✅ Yes | ⚠️ Manual | ✅ Yes |
| **Time Estimates Synced** | ❌ No | ✅ Yes | ⚠️ Manual | ❌ No |
| **Sprint Metadata Synced** | ❌ No | ❌ No | ⚠️ Manual | ❌ No |
| **Easy to Implement** | ✅ Yes | ⚠️ Moderate | ❌ Complex | ✅ Yes |
| **Production Ready** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |

---

## Recommended Approach

### If you have Zammad admin access:
**Use Option 2 (Custom Fields)** - This is the proper, production-ready solution.

### If you DON'T have admin access:
**Use Option 4 (Hybrid)** - Sync sprint assignments via tags, keep metadata local.

---

## Next Steps

1. **Choose your approach** based on admin access
2. **Test with your Zammad instance** to verify permissions
3. **Implement API methods** in `api.js`
4. **Update SprintManager** to use Zammad as storage
5. **Add export/import** for sprint metadata if needed

---

## Code Examples

See the proof-of-concept implementation in:
- `/src/api-sprint-sync.js` - API methods for sprint sync
- `/src/sprint-manager-zammad.js` - Updated SprintManager using Zammad

