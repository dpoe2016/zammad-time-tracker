# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning where possible.

## [1.0.3] - 2025-08-13
### Added
- Ticket hover tooltips on dashboard showing detailed information (ID, state, priority, user, group, updated date, and content preview)
- First article content fetching and caching for tickets
- New API method `getTicketArticles()` to retrieve ticket articles from Zammad

### Changed
- Enhanced dashboard UI with tooltip styling and animations
- Improved ticket display with article content preview functionality

## [1.0.2] - 2025-08-13
### Changed
- Updated changelog with latest release notes.
- add group filter to dashboard page

## [1.0.1] - 2025-08-12
### Changed
- Improved dashboard ticket sorting to prioritize tickets by priority level first, then by last updated date.

## [1.0] - 2025-08-12
### Added
- Initial public release of the Zammad Time Tracking Extension.
- Time tracking controls (start/stop) per Zammad ticket.
- Automatic detection of ticket IDs within Zammad.
- Persistent timers that continue running across tabs and page switches.
- Recording and display of time spent on tickets.
- Browser notifications for start/stop and important events.
- Direct integration with the Zammad REST API.
- Assigned tickets list with the ability to start tracking from the list.
- Time tracking history view.
- Dashboard with Kanban-style overview by status (Open, In Progress, Waiting, Closed).
- Debug mode with comprehensive logging for troubleshooting.

[1.0]: https://github.com/ (placeholder)