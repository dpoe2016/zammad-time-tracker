# Zammad Timetracking Extension

A Chrome extension for time tracking in Zammad tickets.

**Current Version: 3.0.2**

## 📋 Features

- ⏱️ **Time Tracking** - Start/Stop timer for Zammad tickets
- 🎯 **Automatic Ticket Detection** - Automatically recognizes ticket IDs
- 💾 **Persistent Time Tracking** - Timer continues running even when switching tabs
- 🔧 **Time Recording** - Tracks and displays time spent on tickets
- 🔔 **Browser Notifications** - Informs about start/stop events
- 🌐 **Direct Zammad API Integration** - Reliable communication via the Zammad REST API
- 📋 **Assigned Tickets List** - View and start tracking for any of your assigned tickets
- 📊 **Time Tracking History** - View all your time tracking entries
- 🗂️ **Dashboard** - Kanban-style overview of tickets by status (New, Open, In Progress, Waiting, Closed)
- 🔄 **Auto-Refresh** - Automatic detection of new tickets with intelligent cache management
- 📊 **Improved Sorting** - Dashboard tickets sorted by most recent updates for better workflow
- 🐛 **Debug Mode** - Comprehensive logging for troubleshooting

## 🚀 Installation

### Prerequisites

- Google Chrome Browser (Version 88+)
- Access to a Zammad installation
- Activated time tracking in Zammad

### Step 1: Download Extension Files

Clone or download this repository. The most important files are:

```
zammad-time-tracker/
├── manifest.json          # Extension configuration
├── background.js          # Background Service Worker
├── content.js             # Content Script for Zammad integration
├── api.js                 # API Service for direct Zammad connection
├── popup.html             # Popup interface
├── popup.js               # Popup logic and time tracking
├── options.html           # Options page for API settings
├── options.js             # Options page logic
├── translations.js        # Multilingual translations
├── style.css              # Styling
└── icons/                 # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Step 2: Create Icons

**Option A: Automatically generate**
1. Open the icon generator (if provided)
2. Download all three PNG icons
3. Save them in the `icons/` folder

**Option B: Use your own icons**
- Create PNG icons in sizes 16x16, 48x48, and 128x128 pixels
- Name them: `icon16.png`, `icon48.png`, `icon128.png`

### Step 3: Install Extension in Chrome

1. **Open Chrome Extensions page:**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode:**
   - Toggle "Developer mode" in the top right corner

3. **Load Extension:**
   - Click on "Load unpacked"
   - Select the `zammad-time-tracker` folder
   - Click "Select Folder"

4. **Verify Installation:**
   - Extension should appear in the list
   - Icon should be visible in the Chrome toolbar
   - Status should show "Enabled"

## 🏗️ Build and Packaging

You can build a distributable ZIP of the extension using the provided build script:

```bash
./build.sh
```

What it does:
- Cleans previous build artifacts
- Copies all necessary files into a fresh dist/ directory
- Creates zammad-time-tracker-extension.zip at the project root for distribution or manual install

Notes:
- The script excludes Markdown files, the build script itself, and VCS/system artifacts.
- You can still load the unpacked extension directly from the project root during development.

## 📖 Usage

### Basic Usage

1. **Open a Zammad Ticket**
   - Navigate to any ticket in your Zammad installation

2. **Start Time Tracking**
   - Click on the extension icon in the Chrome toolbar
   - Click the blue "Start" button
   - Timer automatically starts running

3. **End Time Tracking**
   - Open the popup again
   - Click the red "Stop" button
   - Tracked time will be displayed and the timer will reset

### Advanced Features

#### Tabbed Interface
- **Current Tab:** Shows the current tracking status and controls
- **Tickets Tab:** Shows a list of tickets assigned to you
- **History Tab:** Shows your time tracking history

#### Open the Dashboard
- In the popup, go to Settings → Dashboard → Open
- A full-page board (dashboard.html) opens with columns for New, Open, In Progress, Waiting, and Closed tickets
- Use the user filter to switch between "All Users", "My Tickets", or a specific user
- Drag and drop between columns to update ticket states where permitted
- Tickets are automatically sorted by most recent updates (newest first) for optimal workflow

#### Start Tracking from Assigned Tickets
- Click on the "Tickets" tab to view all tickets assigned to you
- Click on any ticket in the list to start tracking time for it
- If tracking is already active for another ticket, you'll be asked to confirm switching

#### View Time Tracking History
- Click on the "History" tab to view your time tracking history
- See a summary of all your time entries, including:
  - Total time spent across all tickets
  - Individual time entries with ticket ID, duration, and date
  - Comments associated with time entries (if available)

#### Activate Debug Mode
- **Double-click** on "Zammad Timetracking" in the popup header
- Yellow debug box will be displayed
- Shows detailed information about all processes

#### Adjust Settings
- **Notifications:** Turn on/off browser notifications when tracking starts/stops
  - When enabled: Shows notifications when time tracking starts/stops
  - When disabled: No notifications are displayed
  - Details: See notifications-explanation.md
- **Auto-Submit Time:** Automatically submit tracked time to Zammad when stopping the timer
  - Toggle in Settings → Auto-Submit Time
  - Details: See auto-submit-explanation.md
- **Language:** Select German or English

#### Configure API Settings
- Click on "Options" next to "API Settings"
- The Options page will open in a new tab
- **Base URL:** The URL of your Zammad installation (e.g., https://zammad.example.com)
- **API Token:** Your personal Zammad API token
- Click on "Save" to apply the settings

#### How User Identity Works
- The extension uses your API token to identify you to the Zammad server
- When you see "me" in the code or logs, it refers to the user associated with the API token
- The Zammad server determines who "me" is based on the token you provided
- Some Zammad instances support the "me" parameter directly in API requests
- If "me" doesn't work, the extension tries to get your actual user ID and uses that instead
- This ensures that you only see your assigned tickets and time entries

#### Create Zammad API Token
1. Log in to your Zammad installation
2. Go to your profile (click on your name in the top right)
3. Select "Token Access" or "API Tokens"
4. Click on "Create new token"
5. Enter a name (e.g., "Timetracking Extension")
6. **Required Permissions:** The "ticket agent" role is sufficient for basic time tracking functionality. The token inherits your user permissions, so you need at least:
   - Read access to tickets
   - Ability to create and view time entries
   - If you can manually add time to tickets in Zammad, your token should have sufficient permissions
7. Copy the generated token and paste it into the extension

#### Persistent Time Tracking
- Timer continues running even when the popup is closed
- Timer continues running even when switching tabs or restarting the browser
- Red badge (⏱) on the extension icon indicates active time tracking

## 🔧 Configuration

### REST API Configuration (recommended)

The extension uses direct Zammad REST API integration for reliable and robust time tracking:

1. **Open API Settings:**
   - Click on "Options" next to "API Settings" in the popup
   - The Options page will open in a new tab

2. **Configure Settings:**
   - **Base URL:** The URL of your Zammad installation (e.g., https://zammad.example.com)
   - **API Token:** Your personal Zammad API token (see "Create Zammad API Token" above)

3. **Benefits of Direct API Integration:**
   - **Reliability:** Independent of changes to the Zammad UI
   - **Accuracy:** Precise ticket information directly from the database
   - **Efficiency:** Fast access to ticket information
   - **Flexibility:** Works even when the ticket is not fully loaded
   - **Robustness:** Less susceptible to errors due to UI changes
   - **Completeness:** Access to all ticket information and time entries

### Customize Zammad URL Detection (Fallback Method)

If your Zammad installation is not automatically detected, adjust the URL patterns in `content.js`:

```javascript
// Line ~15-25 in content.js
function isZammadPage() {
  const indicators = [
    // Add your specific URL patterns
    () => /your-zammad-domain\.com/i.test(window.location.href),
    () => /support\.your-company\.com/i.test(window.location.href)
    // ... existing patterns
  ];
  return indicators.some(check => check());
}
```


## 🐛 Troubleshooting

### Extension Not Loading

**Problem:** Extension does not appear in Chrome
```bash
# Solution:
1. Check the folder structure
2. Make sure manifest.json exists
3. Check chrome://extensions/ for error messages
4. Is Developer mode enabled?
```

**Problem:** Service Worker Error
```bash
# Solution:
1. chrome://extensions/ → Extension Details
2. Check "Service worker" status
3. If errors: Reload extension (Reload button)
4. Restart browser
```

### Timer Not Starting

**Problem:** Start button not responding
```bash
# Solution:
1. Activate Debug mode (Double-click on header)
2. Check Debug messages
3. Open browser console (F12)
4. Reload extension
```

**Problem:** Ticket ID not found
```bash
# Solution:
1. Are you in a Zammad ticket?
2. Does the URL contain a ticket number?
3. Is the Zammad page fully loaded?
4. Is the Content Script working? (Check Debug mode)
```

### API and Permission Issues

**Problem:** "No tickets found" or "No time entries found" errors
```bash
# Solution:
1. Verify your API token has sufficient permissions (ticket agent role is usually enough)
2. Check if you can manually add time to tickets in Zammad with your user account
3. Activate Debug mode and check for API error messages
4. Try creating a new API token with the same permissions
```

**Problem:** API errors in console
```bash
# Solution:
1. Check your API token permissions in Zammad
2. Ensure your user role has access to time tracking features
3. Verify the Base URL is correct in the extension settings
4. Check if your Zammad instance requires additional authentication
```

### Common Solutions

```bash
# 1. Hard Refresh
Ctrl+Shift+R on Zammad page

# 2. Reload Extension
chrome://extensions/ → Reload button

# 3. Clear Browser Cache
Ctrl+Shift+Del → Images and files in cache

# 4. Reinstall Extension
Delete extension → Reload → Reinstall
```

## 📊 Collecting Debug Information

When experiencing problems, collect the following information:

### 1. Browser Information
```bash
# Check Chrome version:
chrome://version/

# Check extension status:
chrome://extensions/
```

### 2. Collect Debug Logs
```bash
1. Activate Debug mode (Double-click on popup header)
2. Perform action (Start/Stop)
3. Copy Debug messages
4. Open browser console (F12) → Console Tab
5. Copy error messages
```

### 3. API Information
```bash
# Check API configuration:
1. Activate Debug mode
2. Open and check API settings
3. Open Network tab in developer tools (F12)
4. Perform action (Start/Stop)
5. Check API requests and responses
6. Note errors in the console
7. Verify HTTP status codes (401/403 indicate permission issues)
8. Check your user role in Zammad (ticket agent permissions are usually sufficient)
```

### 4. Zammad Information
```bash
- Zammad version
- URL schema (e.g., https://support.company.com/ticket/zoom/123)
- Time tracking configuration
- API configuration and permissions
- Browser permissions
```

## 🔄 Updates

### Version 3.0.2 (Latest)
**Recent Improvements:**
- **Simplified Dashboard Sorting:** Tickets now sorted exclusively by last update time for consistent ordering
- **Auto-Refresh Enhancement:** Fixed cache management to detect new tickets even when starting with empty cache
- **Better Workflow:** Prioritizes recently updated tickets across all dashboard views

### Update Extension
1. Copy new files to the extension folder
2. Open `chrome://extensions/`
3. Click the Reload button on the extension
4. New features are immediately available

### Track Changes
- Check the `manifest.json` version
- New features are displayed in Debug mode
- Background Script shows version information

## 🧭 Architecture Overview

For a high-level view of how the extension components interact (popup, background, content script, API), see flow-chart.md.

## ⚙️ Development

### Development Prerequisites
- Node.js (optional, for advanced features)
- Chrome Developer Tools
- Code Editor (e.g., VS Code, IntelliJ)

### Development in IntelliJ IDEA

1. **Open Project:**
   ```bash
   File → Open → Select zammad-timetracking folder
   ```

2. **Enable Chrome Extension APIs:**
   ```bash
   Settings → Languages & Frameworks → JavaScript → Libraries
   → Add... → Download... → Search for "chrome" and install
   ```

3. **TypeScript Support (optional):**
   ```bash
   npm install --save-dev @types/chrome
   ```

4. **Live Development:**
   ```bash
   # Set up file watcher for automatic reload
   Settings → Tools → File Watchers
   ```

### Code Quality

```bash
# ESLint Setup
npm install --save-dev eslint

# .eslintrc.js
module.exports = {
  env: { webextensions: true },
  globals: { chrome: 'readonly' }
};
```

## 📝 License

MIT License - Free use and adaptation allowed.

## 🤝 Support

If you encounter problems or have questions:

1. **Use Debug Mode** - Shows detailed error messages
2. **Check Browser Console** - `F12` → Console Tab
3. **Reload Extension** - Often solves problems
4. **Check Documentation** - All important information is here

## 📈 Roadmap

Completed features:
- [x] REST API Integration
- [x] Assigned tickets list
- [x] Time tracking history
- [x] Dashboard with New/Open/In Progress/Waiting/Closed states
- [x] Auto-refresh and intelligent cache management
- [x] Optimized ticket sorting by update time

Planned features:
- [ ] Project time categories
- [ ] Team statistics
- [ ] Export functions
- [ ] Mobile browser support
- [ ] Advanced filtering options
- [ ] Bulk time entry operations

---

**Good luck with the Zammad Timetracking Extension! ⏱️**
