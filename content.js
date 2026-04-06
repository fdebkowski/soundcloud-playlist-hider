// SoundCloud Playlist Hider
// Hides feed items where someone "posted a playlist"

const STORAGE_KEY = 'sc_hide_playlists';
let hideEnabled = true;

// ─── Selector helpers ────────────────────────────────────────────────────────

/**
 * Walk up the DOM from `el` to find the nearest feed-item ancestor.
 * SoundCloud uses several class names across versions.
 */
function findFeedItem(el) {
  let node = el;
  while (node && node !== document.body) {
    const cls = node.className || '';
    if (
      /lazyLoadingList__item/.test(cls) ||
      /soundList__item/.test(cls) ||
      /stream__item/.test(cls) ||
      /streamItem/.test(cls) ||
      /feedItem/.test(cls) ||
      /activityItem/.test(cls) ||
      (node.tagName === 'LI' && node.parentElement && /lazyLoadingList|soundList|stream__list/.test(node.parentElement.className))
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Return true if the feed item describes a "posted a playlist" activity.
 * Checks dedicated subtitle elements first, then falls back to full text.
 */
function isPlaylistPost(item) {
  // Priority 1: look for a small subtitle / context span inside the item header.
  // SoundCloud puts the activity verb ("posted a playlist", "reposted", etc.) in
  // elements like .soundTitle__secondary, .streamContext__actionText, etc.
  const subtitleCandidates = item.querySelectorAll(
    [
      // older SoundCloud
      '.soundTitle__secondary',
      '.soundTitle__subtitle',
      // newer React SoundCloud
      '[class*="streamContext"]',
      '[class*="activityItem__subtitle"]',
      '[class*="activity__subtitle"]',
      '[class*="activitySubtitle"]',
      // generic patterns
      '[class*="secondLine"]',
      '[class*="headerSubline"]',
    ].join(',')
  );

  for (const el of subtitleCandidates) {
    if (el.textContent.toLowerCase().includes('posted a playlist')) return true;
  }

  // Priority 2: scan only text nodes inside any <header> or <h2>/<h3> within the item
  const headerEls = item.querySelectorAll('header, h1, h2, h3, [role="heading"]');
  for (const hEl of headerEls) {
    if (hEl.textContent.toLowerCase().includes('posted a playlist')) return true;
  }

  // Priority 3: scan ALL text nodes at the top of the item (first 300 chars is
  // usually enough to catch the activity description before the track titles).
  // Using a TreeWalker is safer than slicing textContent (avoids track title false-positives).
  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, null);
  let charsSeen = 0;
  let node;
  while ((node = walker.nextNode()) !== null) {
    const text = node.textContent.trim();
    if (!text) continue;
    if (text.toLowerCase().includes('posted a playlist')) return true;
    charsSeen += text.length;
    if (charsSeen > 400) break; // stop early — track titles come after
  }

  return false;
}

// ─── Hide / show logic ────────────────────────────────────────────────────────

function hidePlaylists() {
  // Collect all candidate feed items
  const candidates = document.querySelectorAll(
    [
      'li.lazyLoadingList__item',
      'li.soundList__item',
      'li[class*="stream__list__item"]',
      'li[class*="streamItem"]',
      'li[class*="feedItem"]',
      // React-rendered newer feed
      '[class*="feedItem"]:not(li)',
      '[class*="streamItem"]:not(li)',
      '[class*="activityItem"]:not(li)',
    ].join(',')
  );

  candidates.forEach(item => {
    if (isPlaylistPost(item)) {
      item.style.display = 'none';
      item.dataset.scHidden = 'playlist';
    }
  });
}

function showAll() {
  document.querySelectorAll('[data-sc-hidden="playlist"]').forEach(item => {
    item.style.display = '';
    delete item.dataset.scHidden;
  });
}

function runFilter() {
  if (hideEnabled) hidePlaylists();
  else showAll();
}

// ─── MutationObserver for infinite-scroll ─────────────────────────────────────

let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runFilter, 150);
});

observer.observe(document.body, { childList: true, subtree: true });

// ─── Init ─────────────────────────────────────────────────────────────────────

chrome.storage.local.get([STORAGE_KEY], result => {
  hideEnabled = result[STORAGE_KEY] !== false; // default: enabled
  runFilter();
});

// Listen for toggle messages from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SET_HIDE_PLAYLISTS') {
    hideEnabled = msg.enabled;
    runFilter();
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_STATE') {
    sendResponse({ enabled: hideEnabled });
  }
  return true;
});
