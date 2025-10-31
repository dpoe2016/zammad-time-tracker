# Installation & Click Test

## ✅ Step-by-Step Fix

### Step 1: Make Sure You Have the Latest Code
```bash
cd /Users/dirk/workspace/zammad-time-tracker
git status
# Should show: On branch feature/sprint-planning
```

### Step 2: Reload the Extension in Chrome

**IMPORTANT:** You MUST do this after any code changes!

1. Open Chrome
2. Go to: **`chrome://extensions/`**
3. Find "Zammad Time Tracking Extension"
4. Click the **reload icon** (↻ circular arrow)
5. Wait 2-3 seconds

### Step 3: Test the Extension Icon

Click the extension icon in your Chrome toolbar (top-right).

**What should happen:**
- A new tab opens immediately
- Shows the Zammad dashboard
- URL is like: `chrome-extension://abc.../src/dashboard.html`

### Step 4: If Still Not Working

#### A) Check Service Worker Status

1. On `chrome://extensions/` page
2. Under your extension, look for **"service worker"** text
3. Click it (opens DevTools)
4. In the Console tab, you should see:
   ```
   Background Script loaded
   chrome.action.onClicked API is available
   Background script fully loaded with onClicked handler registered
   ```
5. Now click the extension icon
6. You should see: `Extension icon clicked - opening dashboard in new tab`

#### B) Check for Errors

In the Service Worker console:
- ❌ Red errors? Take a screenshot
- ⚠️ Yellow warnings? That's usually OK
- ✅ Green/white logs? Good!

#### C) Manual Test

Find your extension ID on `chrome://extensions/` (looks like: `abcdefgh...xyz`)

Then visit this URL in Chrome:
```
chrome-extension://YOUR_EXTENSION_ID/src/dashboard.html
```

If this works but clicking doesn't, the background script has an issue.

### Step 5: Nuclear Option - Fresh Install

If nothing works, do a clean reinstall:

```bash
cd /Users/dirk/workspace/zammad-time-tracker

# Make sure you're on the right branch
git checkout feature/sprint-planning

# Rebuild
./build.sh
```

Then in Chrome:
1. Go to `chrome://extensions/`
2. Click **"Remove"** on the old extension
3. Click **"Load unpacked"**
4. Navigate to: `/Users/dirk/workspace/zammad-time-tracker`
5. Click **"Select"**
6. Extension should now be loaded fresh

## 🔍 Diagnostic Checklist

Please check these and tell me the results:

- [ ] Extension shows v3.3.0 on `chrome://extensions/`
- [ ] Extension is ENABLED (toggle is blue/on)
- [ ] Service Worker shows "active" status
- [ ] No errors in Service Worker console
- [ ] Chrome version is recent (e.g., 120+)

## 🎯 What I Fixed

**Issue:** The dashboard path was wrong in one place.

**Fix:** Changed `dashboard.html` → `src/dashboard.html` in popup.js

**Why:** The extension structure has all files in the `src/` folder.

## 💡 Quick Debug Commands

Test in Service Worker console:
```javascript
// Test if chrome.tabs API works
chrome.tabs.create({
  url: chrome.runtime.getURL('src/dashboard.html')
}, tab => {
  console.log('Created tab:', tab);
});
```

If that command opens the dashboard, your extension is working fine!

## 🆘 Still Broken?

Please provide:
1. Screenshot of `chrome://extensions/` showing your extension
2. Screenshot of Service Worker console after clicking icon
3. Tell me: What EXACTLY happens when you click? (nothing/popup/error/etc.)
4. Your Chrome version (Help → About Chrome)
5. Operating system (macOS/Windows/Linux)

I'll help you debug further!
