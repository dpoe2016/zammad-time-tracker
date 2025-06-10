# Zammad Timetracking Extension

A Chrome extension for time tracking in Zammad tickets.

## 📋 Features

- ⏱️ **Time Tracking** - Start/Stop timer for Zammad tickets
- 🎯 **Automatic Ticket Detection** - Automatically recognizes ticket IDs
- 💾 **Persistent Time Tracking** - Timer continues running even when switching tabs
- 🔧 **Time Recording** - Tracks and displays time spent on tickets
- 🏷️ **Tag Management** - Assign tags to tickets directly from the extension
- 🔔 **Browser Notifications** - Informs about start/stop events
- 🌐 **Direct Zammad API Integration** - Reliable communication via the Zammad REST API
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
   - Select the `zammad-timetracking` folder
   - Click "Select Folder"

4. **Verify Installation:**
   - Extension should appear in the list
   - Icon should be visible in the Chrome toolbar
   - Status should show "Enabled"

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

#### Activate Debug Mode
- **Double-click** on "Zammad Timetracking" in the popup header
- Yellow debug box will be displayed
- Shows detailed information about all processes

#### Manage Tags
- **View Tags:** Current tags for the ticket are displayed in the ticket info section
- **Add/Remove Tags:** 
  - Click the "+" button next to "Tags" to open the tag selector
  - Select one or more tags from the available tags list
  - Click "Apply" to assign the selected tags to the ticket
  - Click "Cancel" to close without changes
- **Remove Individual Tags:** Click the "×" on any tag to remove it from the ticket

#### Adjust Settings
- **Notifications:** Turn on/off browser notifications when tracking starts/stops
  - When enabled: Shows notifications when time tracking starts/stops
  - When disabled: No notifications are displayed
- **Language:** Select German or English

#### Configure API Settings
- Click on "Options" next to "API Settings"
- The Options page will open in a new tab
- **Base URL:** The URL of your Zammad installation (e.g., https://zammad.example.com)
- **API Token:** Your personal Zammad API token
- Click on "Save" to apply the settings

#### Create Zammad API Token
1. Log in to your Zammad installation
2. Go to your profile (click on your name in the top right)
3. Select "Token Access" or "API Tokens"
4. Click on "Create new token"
5. Enter a name (e.g., "Timetracking Extension")
6. Copy the generated token and paste it into the extension

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

### Update Extension
1. Copy new files to the extension folder
2. Open `chrome://extensions/`
3. Click the Reload button on the extension
4. New features are immediately available

### Track Changes
- Check the `manifest.json` version
- New features are displayed in Debug mode
- Background Script shows version information

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

Planned features:
- [x] REST API Integration
- [x] Tag Management
- [ ] Time tracking reports
- [ ] Project time categories
- [ ] Team statistics
- [ ] Export functions
- [ ] Mobile browser support

---

**Good luck with the Zammad Timetracking Extension! ⏱️**
