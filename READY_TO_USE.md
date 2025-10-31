# ✅ Sprint Planning Ready - But Needs Tickets First!

## The Issue

Sprint planning backlog is empty because:
- IndexedDB ticket cache is empty
- Tickets need to be loaded from Zammad first

## 🎯 Simple Solution (2 minutes)

### Step 1: Configure API (if not done)
1. Click extension icon
2. Look for popup with tabs
3. Scroll to "Settings" section
4. Click "Options" button
5. Enter:
   - **Zammad URL**: `https://zammad.lohmann-breeders.com` (or your URL)
   - **API Token**: Get from Zammad → Profile → Token Access
6. Click "Save Settings"

### Step 2: Load Tickets to Dashboard
1. Click extension icon (dashboard opens)
2. Wait 5-10 seconds for tickets to load
3. You should see tickets appear in columns (New, Open, In Progress, etc.)
4. **If you see tickets here** → Good! They're now cached ✅

### Step 3: Open Sprint Planning
1. Click "📋 Sprint Planning" button (top right)
2. Now the backlog should show all tickets! 🎉

---

## 📝 Quick Test Without API

If you don't want to configure API yet, here's a test:

1. Open: `file:///Users/dirk/workspace/zammad-time-tracker/check-api.html`
2. It will tell you exactly what's missing

---

## 🔍 What's Happening

**Flow:**
```
Dashboard loads → API fetches tickets → Saves to cache → Sprint Planning reads cache
```

**That's why you need to:**
1. Open dashboard FIRST (to cache tickets)
2. THEN open Sprint Planning (to read from cache)

---

## ✅ Expected Result

**In Dashboard:**
- You see ticket columns with your tickets

**In Sprint Planning:**
- Backlog (left) shows all uncategorized tickets
- Sprint (right) is empty until you drag tickets there

---

## 🆘 Still No Tickets?

Run this diagnostic:
```
file:///Users/dirk/workspace/zammad-time-tracker/check-api.html
```

It will show:
- ✅ If API is configured
- ✅ If connection works
- ✅ If tickets can be loaded

---

**Bottom line: Configure API → Load Dashboard → Then Sprint Planning works!** 🚀
