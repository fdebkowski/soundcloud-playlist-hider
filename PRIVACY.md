# Privacy Policy — SoundCloud Playlist Hider

**Last updated:** 2026-04-06

## Overview

SoundCloud Playlist Hider is an open-source Chrome extension that hides "posted a playlist" items from your SoundCloud feed.

## Data Collection

This extension **does not collect, transmit, or share any personal data.**

- It does not communicate with any external server.
- It does not track your browsing activity.
- It does not read or store any SoundCloud account information.

## Local Storage

The extension saves a single boolean preference (whether hiding is enabled or disabled) to your browser's local storage via the `chrome.storage.local` API. This data:

- Never leaves your device.
- Is never shared with any third party.
- Can be cleared at any time by removing the extension.

## Permissions

| Permission | Why it's needed |
|---|---|
| `storage` | Save your on/off toggle preference locally |
| `https://soundcloud.com/*` | Run the content script that hides playlist posts on SoundCloud pages |

## Contact

This extension is open source. If you have questions or concerns, please open an issue at:  
https://github.com/fdebkowski/soundcloud-playlist-hider/issues
