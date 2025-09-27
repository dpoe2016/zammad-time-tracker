# Zammad Time Tracker Chrome Extension

A comprehensive Chrome extension for tracking time on Zammad tickets with advanced features including dual API integration, intelligent caching, and a full-featured Kanban dashboard.

## 🚀 Features

### ⏱️ Core Time Tracking
- **Start/Stop Timer** - Manual time tracking with live HH:MM:SS display
- **Automatic Ticket Detection** - Automatically recognizes Zammad ticket IDs from current page
- **Persistent Tracking** - Timer continues across tab switches, browser restarts, and page reloads
- **Visual Status Indicator** - Red badge (⏱) on extension icon during active tracking
- **Auto-Submit Time** - Automatically submit tracked time to Zammad when stopping
- **Editable Time Entries** - Click to edit tracked time with date picker
- **Time History** - Complete history of all time entries with detailed view

### 📊 Dashboard & Interface
- **Tabbed Interface** - Organized into Current, Tickets, and History tabs
- **Full-Page Kanban Board** - Comprehensive ticket management with drag & drop
- **Multiple View Modes**:
  - State View (by ticket status: New, Open, In Progress, Waiting, Closed)
  - Agent View (by assigned user)
  - Group View (by ticket group)
- **Advanced Filtering**:
  - User Filter (specific users or "My Tickets")
  - Group Filter (by ticket groups)
  - Organization Filter (by customer organizations)
  - Priority Filter (Low, Normal, High, Urgent)
  - State Filter (by ticket status)
- **Real-time Updates** - Instant filtering and updates without page reload

### 🔗 Integration Capabilities
- **Dual API Strategy**:
  - Primary: Direct REST API integration with Zammad
  - Fallback: DOM manipulation for compatibility
- **Smart Feature Detection** - Automatic Zammad version capability detection
- **Content Script Integration** - Seamless injection into Zammad pages
- **Token-Based Authentication** - Secure API token management
- **Cross-Version Compatibility** - Works with various Zammad versions

### ⚙️ Configuration & Settings
- **API Configuration** - Set Zammad instance URL and API tokens
- **User Preferences**:
  - Notification settings (toggle browser notifications)
  - Auto-submit toggle
  - Language selection (German/English)
  - Debug mode for troubleshooting
- **Multi-User Support** - Filter and manage tickets for multiple users
- **Customizable Refresh Intervals** - Configure dashboard auto-refresh timing

### 🗄️ Data Management
- **Intelligent Caching System**:
  - Multi-level caching (customers, tickets, time entries)
  - Different expiry times based on data volatility
  - Smart cache invalidation on data changes
- **Secure Storage** - API tokens and preferences stored securely
- **Request Deduplication** - Prevents duplicate API calls
- **Memory Optimization** - Efficient cache and state management

### 🛠️ Advanced Features
- **Error Handling & Recovery**:
  - Graceful degradation when API fails
  - Automatic retry mechanisms
  - Clear error messages and status indicators
- **Performance Optimizations**:
  - Lazy loading of data
  - Background processing via service worker
  - Intelligent request batching
- **Multi-Language Support** - Complete German/English translations
- **Debug Mode** - Comprehensive logging and diagnostics

## 📋 Requirements

- Chrome browser (Manifest V3 compatible)
- Zammad instance with API access
- Valid Zammad API token

## 🔧 Installation

### From Source
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/zammad-time-tracker.git
   cd zammad-time-tracker
   ```

2. Build the extension:
   ```bash
   ./build.sh
   ```

3. Install in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory

### From Release
1. Download the latest release ZIP file
2. Extract to a folder
3. Follow step 3 above to load the unpacked extension

## ⚡ Quick Start

1. **Configure API Settings**:
   - Click the extension icon and go to "Options"
   - Enter your Zammad base URL (e.g., `https://your-zammad.com`)
   - Add your API token (found in Zammad under Profile → Token Access)

2. **Start Tracking Time**:
   - Navigate to any Zammad ticket
   - Click the extension icon
   - Click "Start" to begin tracking
   - The timer will run persistently in the background

3. **View Dashboard**:
   - Click "Open Dashboard" for full Kanban board view
   - Filter tickets by user, group, priority, or status
   - Drag tickets between states (where permissions allow)

## 🎯 Usage

### Time Tracking Workflow
1. Navigate to a Zammad ticket page
2. Click the extension icon to open the popup
3. Click "Start" to begin tracking time
4. Work on the ticket (timer continues across tabs/reloads)
5. Click "Stop" to end tracking
6. Time is automatically submitted to Zammad (if auto-submit is enabled)
7. View and edit time entries in the History tab

### Dashboard Management
- **State View**: Organize tickets by their current status
- **Agent View**: See all tickets assigned to specific users
- **Group View**: View tickets organized by support groups
- Use filters to focus on specific ticket sets
- Drag and drop tickets to change their status

### Advanced Configuration
- **User Filtering**: Configure which users appear in dashboard filters
- **Notifications**: Enable/disable browser notifications for tracking events
- **Language**: Switch between German and English interface
- **Debug Mode**: Enable for troubleshooting and detailed logging

## 🔒 Permissions

The extension requires the following Chrome permissions:
- `activeTab` - Access current tab for ticket detection
- `tabs` - Cross-tab state synchronization
- `storage` - Persistent data storage
- `scripting` - Content script injection into Zammad pages
- `notifications` - Browser notifications for tracking events
- `cookies` - Session management with Zammad

## 🐛 Troubleshooting

### Common Issues

**Timer not starting:**
- Verify API token is valid and has proper permissions
- Check that the current page is a valid Zammad ticket
- Enable debug mode to view detailed error messages

**Dashboard not loading tickets:**
- Confirm API URL is correct and accessible
- Verify API token has read permissions for tickets
- Check browser console for detailed error information

**Time not submitting:**
- Ensure API token has write permissions for time tracking
- Verify the ticket allows time tracking entries
- Check if auto-submit is enabled in options

### Debug Mode
Enable debug mode in Options for comprehensive logging:
- API call tracing
- State inspection
- Cache status
- Error diagnostics

## 🏗️ Development

### Project Structure
```
├── manifest.json          # Extension manifest
├── popup.html/js          # Main popup interface
├── dashboard.html/js      # Kanban board dashboard
├── options.html/js        # Configuration page
├── background.js          # Service worker
├── content.js            # Content script for Zammad pages
├── api.js                # Zammad API client
├── build.sh              # Build script
└── README.md             # This file
```

### Building
```bash
./build.sh
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with different Zammad versions
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Support

For support and feature requests:
- Open an issue on GitHub
- Check the troubleshooting section above
- Enable debug mode for detailed error information

## 🔄 Version History

See the [releases page](https://github.com/your-username/zammad-time-tracker/releases) for detailed version history and changelog.