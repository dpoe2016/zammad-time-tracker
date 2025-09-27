# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

**Build and Package:**
```bash
# Build extension without version increment
./build.sh

# Build with version increment
./build.sh --patch    # 1.0.3 -> 1.0.4
./build.sh --minor    # 1.0.3 -> 1.1.0
./build.sh --major    # 1.0.3 -> 2.0.0
```

**Installation for Development:**
1. Load unpacked extension from project root in Chrome at `chrome://extensions/`
2. Enable Developer Mode
3. The extension files are loaded directly from the project directory

**No Test Framework:** This project does not use automated tests. Manual testing is done by loading the extension in Chrome and testing with actual Zammad instances.

## Architecture Overview

This is a **Chrome Extension (Manifest V3)** for time tracking in Zammad ticket systems. The extension uses a multi-component architecture:

### Core Components

1. **popup.js/popup.html** - Main user interface popup
2. **background.js** - Service worker for state management and notifications  
3. **content.js** - Content script injected into Zammad pages
4. **api.js** - Zammad REST API client with fallback mechanisms
5. **dashboard.js/dashboard.html** - Full-page Kanban board view

### Supporting Modules

- **storage.js** - Chrome storage abstraction layer
- **logger.js** - Debugging and logging utilities
- **utilities.js** - Shared utility functions
- **translations.js** - Multi-language support (German/English)
- **options.js/options.html** - Extension configuration page

### Key Architectural Patterns

**Dual API Strategy:** The extension implements a sophisticated dual approach for Zammad integration:
- **Primary:** Direct REST API calls via `api.js` for reliability
- **Fallback:** DOM manipulation via `content.js` for compatibility

**Feature Detection:** The `api.js` includes extensive feature detection for different Zammad versions:
- Tests for `/api/v1/users/me` endpoint support
- Caches successful API endpoints to avoid repeated testing
- Gracefully degrades when API features are unavailable

**Message Passing Architecture:** Components communicate via Chrome extension message passing:
- Popup ↔ Background: tracking state updates
- Popup ↔ Content: ticket information and DOM operations
- Background: manages extension badge and notifications

**Persistent State:** Uses Chrome storage for:
- Active tracking sessions (survives browser restarts)
- User preferences and API configuration
- Cached API endpoint compatibility information

## Development Guidelines

**File Organization:**
- Main extension files are in the project root
- No package.json - this is a pure client-side Chrome extension
- Icons stored in `icons/` directory
- Test files prefixed with `test_` are for manual testing scenarios

**API Integration Notes:**
- Always check `api.js` for existing Zammad API patterns before adding new endpoints
- Use feature detection when adding new API functionality
- Implement fallback to content script DOM manipulation when API fails
- Cache successful API endpoints in `successfulEndpoints` for performance

**Content Script Injection:**
- Content script is automatically injected on Zammad domains via manifest
- Additional injection logic in popup.js for dynamic loading
- Always verify Zammad page detection in `content.js` before operations

**State Management:**
- Tracking state persists across browser sessions via Chrome storage
- Background script maintains badge state and notifications
- Use `storage.js` wrapper instead of direct Chrome storage API

**Debugging:**
- Enable debug mode by double-clicking popup header
- Extensive logging throughout all components via `logger.js`
- Test files provide isolated scenarios for debugging specific issues

## Common Development Patterns

**Adding New API Endpoints:**
1. Add to `api.js` with feature detection
2. Add fallback method in `content.js` if needed
3. Update `successfulEndpoints` cache structure
4. Test with multiple Zammad versions

**Extending UI:**
1. Update `popup.html` structure
2. Add corresponding JavaScript in `popup.js`
3. Add translations to `translations.js`
4. Update `updateUILanguage()` function

**Message Handling:**
Follow existing patterns in each component for Chrome extension message passing between popup, background, and content scripts.