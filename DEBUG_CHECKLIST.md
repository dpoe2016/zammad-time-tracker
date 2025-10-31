# Debug Checklist - What's Not Working?

Please answer these questions so I can help you:

## 1. Extension Icon
- [ ] Click extension icon - does dashboard open?
- [ ] What happens? (nothing/error/dashboard opens)

## 2. Dashboard
- [ ] Do you see tickets in the dashboard?
- [ ] Which columns have tickets? (New/Open/In Progress/etc.)
- [ ] Or is dashboard empty?

## 3. Sprint Planning
- [ ] Click "📋 Sprint Planning" button - does it open?
- [ ] What do you see in the backlog (left column)?
- [ ] Any error message?

## 4. Console Errors
- [ ] Open Sprint Planning page
- [ ] Press F12 (opens DevTools)
- [ ] Go to Console tab
- [ ] What errors do you see? (copy/paste or screenshot)

## 5. API Configuration
- [ ] Is Zammad URL configured?
- [ ] Is API Token configured?
- [ ] Run check-api.html - what does it show?

---

## Quick Diagnostics

### Test 1: Check API
Open in Chrome:
```
file:///Users/dirk/workspace/zammad-time-tracker/check-api.html
```
Click Steps 1, 2, 3 - what happens?

### Test 2: Check Database
Open in Chrome:
```
file:///Users/dirk/workspace/zammad-time-tracker/check-db.html
```
What version and stores does it show?

### Test 3: Check Console
On Sprint Planning page:
1. Press F12
2. Console tab
3. Type: `console.log(this.tickets)` and Enter
4. What do you see?

---

## Common Issues & Quick Fixes

### Issue: "API not configured"
**Fix:**
- Extension icon → popup → Settings → Options
- Enter URL and Token
- Save

### Issue: "Failed to load data"
**Fix:**
- Check console for actual error
- May need to run add-ticket-cache.html

### Issue: "Backlog is empty"
**Fix:**
- First load dashboard (click extension icon)
- Wait for tickets to appear
- Then open Sprint Planning

### Issue: "Service worker inactive"
**Fix:**
- chrome://extensions/
- Reload extension
- Try again

---

## What I Need to Help You

Please provide:
1. **Screenshot of Sprint Planning page**
2. **Screenshot of Console tab (F12)**
3. **What step fails?** (opening/loading/showing tickets)
4. **Any error messages?**

Or just tell me:
- "Dashboard opens but no tickets"
- "Sprint Planning shows error: [error message]"
- "Backlog is empty"
- "Console shows: [error]"

Let me know and I'll fix it! 🔧
