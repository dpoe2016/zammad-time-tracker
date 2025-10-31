# Sprint Planning Feature

## Overview

The Sprint Planning feature extends the Zammad Time Tracker with agile sprint management capabilities. You can now organize your Zammad tickets into sprints, estimate work, and track sprint progress directly from the extension.

## Features

### 🎯 Sprint Management
- **Create Sprints** - Define sprints with name, start/end dates, and goals
- **Active Sprint** - Mark one sprint as active at a time
- **Sprint States** - Planned → Active → Completed lifecycle
- **Sprint History** - Keep track of completed sprints

### 📋 Backlog & Planning
- **Backlog View** - All tickets not assigned to a sprint
- **Drag & Drop** - Intuitive ticket assignment to sprints
- **Sprint View** - See all tickets in the current sprint
- **Real-time Filtering** - Filter by state and search tickets

### ⏱️ Time Estimation
- **Estimate Hours** - Set estimated hours for each ticket in sprint
- **Capacity Planning** - Track total estimated hours per sprint
- **Progress Tracking** - Monitor completion percentage

### 📊 Sprint Statistics
- **Total Tickets** - Count of tickets in sprint
- **Completed Tickets** - Track finished work
- **Estimated Hours** - Sum of all estimates
- **Progress Percentage** - Visual progress indicator

## How to Use

### Creating a Sprint

1. Click **"📋 Sprint Planning"** button in the dashboard
2. Click **"+ New Sprint"** button
3. Fill in the sprint details:
   - **Sprint Name** (required) - e.g., "Sprint 1", "Week 45"
   - **Start Date** (required)
   - **End Date** (required)
   - **Sprint Goal** (optional) - What you want to achieve
4. Click **"Save Sprint"**

### Adding Tickets to Sprint

1. Select a sprint from the dropdown (or leave on "Backlog")
2. **Drag tickets** from the **Backlog** column to the **Sprint** column
3. Tickets automatically get assigned to the selected sprint

### Setting Time Estimates

1. Click the **"Edit"** button on any ticket in the sprint
2. Enter estimated hours (supports decimals like 2.5)
3. Click **"Save"**

### Starting a Sprint

1. Select a planned sprint from the dropdown
2. Click **"Start Sprint"** button
3. Confirm the action (this ends any currently active sprint)

### Completing a Sprint

1. Select the active sprint
2. Click **"Complete Sprint"** button
3. Confirm completion
4. Unfinished tickets return to the backlog

## Data Storage

Sprint data is stored locally in IndexedDB:
- **Sprints** - Sprint definitions and metadata
- **Sprint Assignments** - Ticket-to-sprint mappings with estimates

All data is stored in your browser and syncs across extension pages.

## Workflow Example

### Two-Week Sprint Cycle

1. **Planning Phase** (Day 0)
   - Create sprint: "Sprint 23 - Feature Development"
   - Drag high-priority tickets from backlog
   - Estimate hours for each ticket
   - Review total capacity

2. **Active Sprint** (Days 1-10)
   - Start the sprint
   - Work on tickets (use time tracking as usual)
   - Monitor progress in dashboard
   - Update tickets in Zammad

3. **Sprint Completion** (Day 10)
   - Complete the sprint
   - Unfinished tickets auto-return to backlog
   - Review sprint statistics
   - Plan next sprint

## Tips & Best Practices

### Estimation
- Start with rough estimates (1h, 2h, 4h, 8h)
- Refine estimates as you learn more
- Include testing and review time

### Sprint Length
- 1-2 weeks is typical
- Keep it consistent
- Shorter sprints = faster feedback

### Backlog Management
- Keep backlog organized by priority
- Use Zammad's priority field (P1-P4)
- Review backlog regularly

### Sprint Goals
- Make goals specific and measurable
- Focus on business value
- Share with your team

## Integration with Time Tracking

Sprint Planning works seamlessly with existing time tracking:
- Track time on sprint tickets as usual
- View time spent in ticket details
- All historical data is preserved
- Sprint view is additive, not replacement

## Keyboard Shortcuts

- **Search in Backlog** - Type in search box to filter
- **Filter by State** - Use dropdown to filter by ticket state
- **Drag & Drop** - Click and hold to drag tickets

## Troubleshooting

### Tickets not appearing in backlog
- Check that tickets are loaded in main dashboard first
- Verify API connection in Options
- Refresh the page

### Can't drag tickets
- Ensure JavaScript is enabled
- Try refreshing the page
- Check browser console for errors

### Sprint stats not updating
- Click Refresh button
- Verify ticket states in Zammad
- Check that estimates are saved

### Lost sprint data
- Data is stored in browser's IndexedDB
- Clearing browser data will remove sprints
- Consider exporting sprint data regularly

## Future Enhancements

Potential future features:
- 📈 Burndown charts
- 📊 Velocity tracking
- 🔄 Sprint retrospectives
- 📤 Export sprint reports
- 👥 Team capacity planning
- 🔔 Sprint deadline reminders

## Technical Details

### Storage Structure

**Sprints Table:**
```javascript
{
  id: 1,
  name: "Sprint 1",
  startDate: "2024-10-31T00:00:00.000Z",
  endDate: "2024-11-14T00:00:00.000Z",
  goal: "Implement user authentication",
  status: "active", // planned, active, completed
  createdAt: "2024-10-31T12:00:00.000Z"
}
```

**Sprint Assignments Table:**
```javascript
{
  id: 1,
  ticketId: 12345,
  sprintId: 1,
  estimatedHours: 8,
  assignedAt: "2024-10-31T12:00:00.000Z"
}
```

### IndexedDB Schema

- Database: `ZammadTimeTracker`
- Version: 2
- New Stores:
  - `sprints` (keyPath: id, indexes: status, startDate)
  - `sprintAssignments` (keyPath: id, indexes: sprintId, ticketId)

## Feedback & Support

Found a bug or have a feature request?
- Enable debug mode in Options
- Check browser console for errors
- Create an issue on GitHub
