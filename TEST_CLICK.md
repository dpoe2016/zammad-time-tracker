# Test Extension Icon Click

## Immediate Steps to Fix

### Step 1: Check Extension Status
1. Open Chrome
2. Go to `chrome://extensions/`
3. Find "Zammad Time Tracking Extension v3.3.0"
4. Make sure it's **ENABLED** (toggle should be blue/on)

### Step 2: Reload Extension
**This is the most important step!**
1. Click the **circular refresh icon** on your extension card
2. Wait for it to reload (should take 1-2 seconds)
3. Now try clicking the extension icon again

### Step 3: Check What Happens
After reloading, click the extension icon and tell me:
- ❓ Does NOTHING happen?
- ❓ Does a popup appear?
- ❓ Does a new tab open?
- ❓ Does an error appear?

## If Still Not Working

### Option A: Check Service Worker Console
1. On `chrome://extensions/`
2. Under your extension, click the blue text **"service worker"**
3. A DevTools window opens
4. Click the extension icon
5. Look at the Console - do you see: "Extension icon clicked - opening dashboard in new tab"?
6. Take a screenshot of any errors

### Option B: Force Open Dashboard
Try opening the dashboard directly:
1. Right-click the extension icon
2. Look for any menu options
3. OR manually visit: Find your extension ID on chrome://extensions (it looks like: `abcdefghijklmnopqrstuvwxyz`)
4. Then visit: `chrome-extension://YOUR_ID/src/dashboard.html` in browser

### Option C: Check Manifest V3 Compatibility
Some Chrome versions have issues. Check your Chrome version:
1. Click the 3-dot menu (⋮) in Chrome
2. Help → About Google Chrome
3. What version do you have?

## Quick Fix: Rebuild

If nothing else works:
```bash
cd /Users/dirk/workspace/zammad-time-tracker

# Rebuild the extension
./build.sh

# Then in Chrome:
# 1. Go to chrome://extensions/
# 2. Click REMOVE on old extension
# 3. Click "Load unpacked"
# 4. Select: /Users/dirk/workspace/zammad-time-tracker folder
```

## Common Causes

1. **Extension not reloaded** - Most common! Just reload it
2. **Service worker crashed** - Reload fixes this
3. **Chrome cache** - Restart Chrome
4. **Wrong branch** - Make sure you're on `feature/sprint-planning` branch
5. **Build issue** - Rebuild with `./build.sh`

## What I Need to Help You

If still broken, please tell me:
1. ✅ Did you reload the extension?
2. ✅ What happens when you click the icon? (nothing/popup/error/etc)
3. ✅ Any errors in Service Worker console?
4. ✅ Your Chrome version
5. ✅ Screenshot of chrome://extensions/ page showing your extension

## Expected Behavior

✅ **What SHOULD happen:**
1. Click extension icon in toolbar
2. New tab opens immediately  
3. Shows the Zammad dashboard
4. URL is: `chrome-extension://[ID]/src/dashboard.html`

## Alternative: Use Right-Click Menu

If icon click doesn't work, we can add a right-click context menu as backup. Let me know if you need this!
