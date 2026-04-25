Good move—this is actually **simpler than Android** but still needs a solid design (especially for strict mode).

Here’s a **clean, execution-ready PRD** you can give directly to an AI IDE 👇

---

# 📄 PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 🧩 Project Name

**FocusLock Web – Website Blocking Browser Extension**

---

# 🎯 1. Objective

Build a browser extension that:

* Blocks user-defined websites
* Runs timed focus sessions
* Enforces optional strict mode
* Prevents easy bypass during active sessions

---

# 🌐 2. Target Platform

* Chrome Extension (Manifest V3)
* Later: Edge / Firefox support

---

# 👤 3. User Flow

## First-Time Flow

1. User installs extension
2. Clicks extension icon
3. Opens setup UI
4. Inputs:

   * Websites to block (URLs or domains)
   * Timer duration
   * Strict mode toggle
5. Clicks **Start Session**

---

## Runtime Flow

```id="flowweb1"
User visits blocked site →
Extension intercepts request →
Check session_active == true →
Check current_time < end_time →
Redirect to blocking page →
Display remaining time
```

---

# ⚙️ 4. Core Features

## 4.1 Website Blocking

* Block based on:

  * Full URL
  * Domain (e.g., youtube.com blocks all pages)

* Use:

  * `chrome.declarativeNetRequest` OR
  * `chrome.webRequest` (fallback)

---

## 4.2 Timer System

* Store:

  * start_time
  * end_time
* Auto-expire session

---

## 4.3 Blocking Page

When user tries to open blocked site:

* Redirect to custom HTML page
* Display:

  * “Site Blocked”
  * Remaining time
  * Exit option (if strict mode OFF)

---

## 4.4 Strict Mode

If enabled:

* Disable “Stop Session”
* Prevent editing blocked sites
* Prevent disabling extension UI controls

⚠️ Limitation:

* User can still uninstall extension (browser limitation)

---

## 4.5 Extension Popup UI

Contains:

* Input field for websites
* Timer selector
* Strict mode toggle
* Start / Stop session button
* Status display (active/inactive)

---

## 4.6 Storage

Use:

* `chrome.storage.local`

Data model:

```json id="webdata1"
{
  "blocked_sites": ["youtube.com", "instagram.com"],
  "end_time": 1714048200000,
  "strict_mode": true,
  "session_active": true
}
```
 GitHub Commit Policy


After each feature, commit and push to GitHub before continuing.


One feature = one commit (no batching).



🏷️ Format
<type>: <generic name>[Sanity Check]: Step X/Y → PASS/FAIL

⚠️ Naming Rule


Use simple, generic names (no AI-style long messages)


Examples:
feat: popup uifeat: timerfix: redirect

🚨 Enforcement
If not committed → pause and show warning.
---

# 🧱 5. System Architecture

## High-Level

```id="archweb1"
[Popup UI]
   ↓
[Session Manager]
   ↓
[Storage (chrome.storage)]
   ↓
[Blocking Engine]
   ↓
[Declarative Net Request Rules]
   ↓
[Redirect → Blocking Page]
```

---

## Components

### 1. Popup UI (`popup.html/js`)

* User interaction
* Session control

---

### 2. Background Service Worker (`background.js`)

* Manages session state
* Updates blocking rules

---

### 3. Blocking Engine

* Applies/removes rules dynamically

---

### 4. Blocking Page (`blocked.html`)

* Shows timer + message

---

# 🔁 6. Execution Pipeline (AI IDE)

## Phase 1: Setup

* Create Chrome extension (Manifest V3)
* Configure permissions:

  * storage
  * declarativeNetRequest
  * tabs

---

## Phase 2: UI

* Build popup UI
* Add input + controls

---

## Phase 3: Storage

* Save blocked sites + session data

---

## Phase 4: Blocking Logic

* Implement dynamic rules
* Redirect blocked URLs

---

## Phase 5: Timer System

* Track session expiration

---

## Phase 6: Strict Mode

* Disable controls
* Enforce restrictions

---

## Phase 7: Blocking Page

* Show timer + message

---

## Phase 8: Sanity Check System

---

# 🧪 7. Sanity Check System

## Logging Format

```id="websanity1"
[Sanity Check] Step X/Y: <Description> → PASS/FAIL
```

---

## Steps

1. Storage working
2. Website list saved correctly
3. Session starts properly
4. Timer set correctly
5. Rules applied
6. Blocked site detection works
7. Redirect to blocking page works
8. Timer countdown correct
9. Strict mode enforcement
10. Session ends correctly

---

## Progress UI

```id="websanity2"
Running Sanity Check...
Step 1/10: Storage → PASS
Step 2/10: Rules → IN PROGRESS...
```

---

# 🔄 8. Development Workflow & Commit Policy

* Commit after every feature
* Format:

```id="webcommit1"
feat: <feature name>

[Sanity Check Status]: Step X/Y → PASS/FAIL
```

* No batching features
* Must commit before next step

---

# 🚧 9. Edge Cases

* Subdomains (e.g., m.youtube.com)
* Incognito mode (needs permission)
* User disables extension
* Browser restart
* Time manipulation (user changes system time)

---

# 🔒 10. Anti-Bypass Strategy

* Reapply rules on startup
* Disable UI in strict mode
* Monitor storage changes

⚠️ Cannot fully prevent:

* Extension uninstall
* DevTools bypass

---

# 🚀 11. Future Enhancements

* Daily analytics
* Focus streaks
* Sync across devices
* Password-protected exit
* AI-based distraction detection

---

# 🧠 FINAL NOTE

Tell your AI IDE:

> “Implement incrementally. After each phase, run sanity checks and commit.”

---

If you want next:
I can give you:

* 🔥 Folder structure + exact file code
* ⚡ Chrome extension boilerplate
* 🧠 Prompt for Cursor to build this end-to-end

Just say 👍
