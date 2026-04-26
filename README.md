# FocusLock Web

FocusLock Web is a Chrome Manifest V3 extension for blocking distracting websites during timed focus sessions.

## Features

- Block websites by domain or pasted URL.
- Convert deep links, such as `https://www.youtube.com/watch?v=abc`, into root-site blocks like `youtube.com`.
- Run timed focus sessions with a manually entered duration.
- Redirect blocked sites to a custom blocking page with a countdown.
- Optional strict mode disables early stop and editing while a session is active.
- Reapply blocking rules when Chrome starts.
- Built-in sanity check panel in the popup.

## Load In Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select this project folder.
5. Click the FocusLock Web extension icon to open the popup.

## Usage

1. Enter one website per line.
   Example:

   ```text
   youtube.com
   https://www.instagram.com/reels/
   https://x.com/home
   ```

2. Enter the session duration in minutes.
3. Turn on strict mode if you do not want to allow edits or early stop during the session.
4. Click `Start Session`.
5. Open the sanity check panel and click `Run` if you want to verify the active session.

## Blocking Behavior

FocusLock stores blocked entries as hostnames. This means:

- `https://example.com/page` blocks `example.com`.
- `https://www.example.com/page` blocks `example.com`.
- `example.com` blocks `example.com` and subdomains.

## Project Files

- `manifest.json` - Chrome extension configuration.
- `background.js` - Session storage, timer alarms, strict mode, and dynamic blocking rules.
- `popup.html`, `popup.css`, `popup.js` - Extension popup UI.
- `blocked.html`, `blocked.css`, `blocked.js` - Redirect page for blocked sites.
- `prd.md` - Product requirements document.

## Limitations

Strict mode cannot prevent browser-level actions such as uninstalling or disabling the extension. Incognito blocking requires enabling the extension in incognito from Chrome extension settings.
