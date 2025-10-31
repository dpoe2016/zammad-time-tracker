# Diagnostic Script for Extension Click Issue

## Step 1: Open Service Worker Console

1. Open Chrome
2. Go to: `chrome://extensions/`
3. Find "Zammad Time Tracking Extension"
4. Look for the blue text **"service worker"** or **"Inspect views: service worker"**
5. Click it - a DevTools window opens
6. Make sure you're on the **Console** tab

## Step 2: Check Current Status

Look at the console output. You should see messages like:
```
Background Script loaded
chrome.action.onClicked API is available
Background script fully loaded with onClicked handler registered
```

**If you see errors in red, take a screenshot!**

## Step 3: Test Manual Dashboard Open

Copy and paste this into the Console and press Enter:

```javascript
chrome.tabs.create({
  url: chrome.runtime.getURL('src/dashboard.html'),
  active: true
}, function(tab) {
  console.log('✅ Tab created:', tab);
  if (chrome.runtime.lastError) {
    console.error('❌ Error:', chrome.runtime.lastError);
  }
});
```

**What should happen:**
- Dashboard opens in a new tab
- Console shows: `✅ Tab created: {id: 123, ...}`

**If this works, the extension files are OK but the click handler has a problem.**

## Step 4: Test Click Handler Registration

Copy and paste this into the Console:

```javascript
console.log('Testing click handler...');
console.log('chrome.action exists:', !!chrome.action);
console.log('chrome.action.onClicked exists:', !!chrome.action?.onClicked);

// Try to manually trigger (won't work but shows if API is available)
if (chrome.action && chrome.action.onClicked) {
  console.log('✅ chrome.action.onClicked API is available');
} else {
  console.error('❌ chrome.action.onClicked API is NOT available');
}
```

## Step 5: Re-register Click Handler

If the handler isn't working, try registering it manually:

```javascript
// Remove existing listeners (if any)
chrome.action.onClicked.removeListener();

// Re-register
chrome.action.onClicked.addListener(function(tab) {
  console.log('🎉 Icon clicked! Opening dashboard...');
  chrome.tabs.create({
    url: chrome.runtime.getURL('src/dashboard.html'),
    active: true
  }, function(newTab) {
    if (chrome.runtime.lastError) {
      console.error('❌ Error:', chrome.runtime.lastError);
    } else {
      console.log('✅ Dashboard opened:', newTab);
    }
  });
});

console.log('✅ Click handler re-registered. Try clicking the icon now!');
```

**Now click the extension icon.** If it works after this, there's an issue with the background script initialization order.

## Step 6: Check Manifest

Copy and paste this:

```javascript
fetch(chrome.runtime.getURL('manifest.json'))
  .then(r => r.json())
  .then(manifest => {
    console.log('Manifest version:', manifest.version);
    console.log('Action config:', manifest.action);
    if (manifest.action.default_popup) {
      console.error('❌ PROBLEM: default_popup is set to:', manifest.action.default_popup);
      console.error('This prevents onClicked from firing!');
    } else {
      console.log('✅ No popup configured, onClicked should work');
    }
  });
```

## Common Issues & Solutions

### Issue: "service worker (inactive)"
**Solution:** Click the extension icon or refresh the extension to activate it.

### Issue: Error messages about importScripts
**Solution:** The background script failed to load. Check file paths.

### Issue: "chrome.action.onClicked API is NOT available"
**Solution:** You might be running an old Chrome version. Update Chrome.

### Issue: Manual test works but clicking doesn't
**Solution:** 
1. The manifest might have a popup configured (check Step 6)
2. Or there's a JavaScript error preventing the handler from registering

### Issue: "Cannot read property 'create' of undefined"
**Solution:** The `tabs` permission is missing from manifest.json

## What to Report

After running these tests, please tell me:

1. ✅ What do you see when you open Service Worker console? (any errors?)
2. ✅ Does Step 3 (manual test) open the dashboard?
3. ✅ What does Step 6 show for manifest.action?
4. ✅ Does Step 5 (re-register) fix the clicking?
5. ✅ Screenshot of the Service Worker console

## Quick Fix Commands

If the manual registration (Step 5) works, the issue is in the background.js initialization. Try this:

```bash
cd /Users/dirk/workspace/zammad-time-tracker

# Check which branch you're on
git branch

# Make sure you're on feature/sprint-planning
git checkout feature/sprint-planning

# Pull latest changes
git pull

# Rebuild
./build.sh
```

Then reload the extension in Chrome.

## Still Not Working?

If nothing works, we may need to:
1. Check Chrome version (needs to be 88+)
2. Try a different approach (context menu as fallback)
3. Check for conflicting extensions
4. Try in Chrome Incognito mode (disables other extensions)

Let me know the results and I'll help you fix it! 🔧
