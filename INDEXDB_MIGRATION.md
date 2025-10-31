# Clear IndexedDB for Sprint Planning

## Quick Fix (30 seconds)

The database needs to be upgraded from version 1 to version 2. Here's how:

### Method 1: Console Script (Easiest)

1. Click extension icon → Dashboard opens
2. Click "📋 Sprint Planning" button
3. Press **F12** (opens DevTools)
4. Click **Console** tab
5. **Copy and paste this** and press Enter:

```javascript
indexedDB.deleteDatabase('ZammadTimeTracker').onsuccess = function() {
  console.log('✅ Database cleared! Reloading...');
  setTimeout(() => location.reload(), 1000);
};
```

6. Page will reload automatically
7. Database recreated with sprint stores
8. **Try creating a sprint again!**

---

### Method 2: Via Chrome DevTools

1. Go to Sprint Planning page
2. Press **F12**
3. Click **Application** tab (top menu)
4. Left sidebar: **Storage** → **IndexedDB**
5. Expand to see **"ZammadTimeTracker"**
6. Right-click → **"Delete database"**
7. Reload page (F5)

---

## That's It!

After clearing, try creating a sprint again. It should work! ✅
