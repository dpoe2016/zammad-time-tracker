# Complete Database Fix

## The Problem
The database is opening but the sprint stores don't exist. This means:
1. Database was created at version 2 BUT without the stores
2. Or something is blocking the upgrade

## The Solution (Follow EXACTLY)

### Step 1: Close EVERYTHING
1. Close ALL browser tabs with:
   - Dashboard
   - Sprint Planning  
   - Any Zammad pages
2. Go to `chrome://extensions/`
3. Find your extension
4. If you see "service worker (active)", click it
5. Close that DevTools window too

### Step 2: Reload Extension
1. Still on `chrome://extensions/`
2. Click the reload icon (↻) on your extension
3. Wait 3 seconds

### Step 3: Open Reset Tool
1. Open new tab
2. Paste this URL:
   ```
   file:///Users/dirk/workspace/zammad-time-tracker/reset-db.html
   ```
3. Press Enter
4. Click "Reset Database Now"
5. Wait for success message
6. **IMPORTANT:** Keep this tab open

### Step 4: Verify Database
1. On the reset-db.html tab, press F12
2. Go to Console tab
3. Paste this and press Enter:
   ```javascript
   indexedDB.open('ZammadTimeTracker', 2).onsuccess = function(e) {
     const db = e.target.result;
     console.log('Version:', db.version);
     console.log('Stores:', Array.from(db.objectStoreNames));
     console.log('Has sprints?', db.objectStoreNames.contains('sprints'));
     console.log('Has sprintAssignments?', db.objectStoreNames.contains('sprintAssignments'));
     db.close();
   };
   ```

**You MUST see:**
```
Version: 2
Stores: (8) ['customerCache', 'ticketCache', 'apiEndpoints', 'apiFeatures', 'userProfile', 'timeEntryCache', 'sprints', 'sprintAssignments']
Has sprints? true
Has sprintAssignments? true
```

### Step 5: Try Sprint Planning
1. Click extension icon (dashboard opens)
2. Click "📋 Sprint Planning"
3. Try creating a sprint

---

## Still Failing?

Try the NUCLEAR option:

### Nuclear Option: Fresh Start

1. **Close ALL Chrome tabs**
2. **Quit Chrome completely** (not just close window)
3. Open Terminal and run:
   ```bash
   # This deletes the Chrome IndexedDB files
   rm -rf ~/Library/Application\ Support/Google/Chrome/Default/IndexedDB/chrome-extension_*
   ```
4. Restart Chrome
5. Go to `chrome://extensions/`
6. Reload your extension
7. Open reset-db.html and reset database
8. Try sprint planning

---

## Debug: Check What's Wrong

Open this file to see database status:
```
file:///Users/dirk/workspace/zammad-time-tracker/check-db.html
```

Send me a screenshot of what it shows!
