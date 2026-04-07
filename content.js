// SoundCloud Playlist Hider
// Hides playlist feed items from the SoundCloud stream

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
 * Return true if the feed item is a playlist.
 * Uses language-independent DOM structure checks instead of text matching.
 */
function isPlaylistPost(item) {
  // Check 1: SoundCloud adds a "playlist" class to the .sound element for playlist items
  if (item.querySelector('.sound.playlist')) return true;

  // Check 2: playlist title links contain /sets/ in the URL path
  if (item.querySelector('.soundTitle__title[href*="/sets/"]')) return true;

  // Check 3: playlists render a compact track list that single tracks don't have
  if (item.querySelector('[class*="compactTrackList"]')) return true;

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

// ─── Quick Delete Repost ─────────────────────────────────────────────────────

const QUICK_DEL_ATTR  = 'data-sc-qdel';      // on the injected button
const REPOST_REF_ATTR = 'data-sc-qdel-ref';  // on the repost button when processed

/**
 * Returns true when the repost button is in the "already reposted" active state.
 */
function isRepostActive(btn) {
  return (
    /\bsc-button-selected\b/.test(btn.className) ||
    btn.getAttribute('aria-pressed') === 'true' ||
    btn.classList.contains('active') ||
    btn.classList.contains('selected')
  );
}

/**
 * Find all repost buttons on the page.
 */
function findRepostButtons() {
  return document.querySelectorAll([
    'button.sc-button-repost',
    'button[title="Repost"]',
    'button[title="Reposted"]',
    'button[aria-label="Repost"]',
    'button[aria-label="Reposted"]',
    '[class*="repostButton"]',
  ].join(','));
}

/**
 * Scan the live DOM for a "Delete repost" menu item that SoundCloud rendered
 * after we clicked the repost button.
 */
function findDeleteRepostMenuItem() {
  const candidates = document.querySelectorAll([
    '[class*="dropdownMenu"] button',
    '[class*="dropdown__item"]',
    '[class*="contextMenu"] button',
    '[class*="menu__item"] button',
    '[role="menuitem"]',
    '[role="option"]',
  ].join(','));

  for (const el of candidates) {
    const text = el.textContent.trim().toLowerCase();
    if (text.includes('delete') && text.includes('repost')) return el;
    if (text === 'remove repost') return el;
  }
  return null;
}

/**
 * Automate the two-step delete:
 *   1. Click the repost button to open the dropdown.
 *   2. Poll for the "Delete repost" menu item and click it.
 */
async function doDeleteRepost(repostBtn, qBtn) {
  qBtn.disabled = true;
  qBtn.style.opacity = '0.5';

  repostBtn.click();

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 100));
    const deleteItem = findDeleteRepostMenuItem();
    if (deleteItem) {
      deleteItem.click();
      return; // next observer run will clean up qBtn
    }
  }

  // Couldn't find menu — dismiss and restore
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  qBtn.disabled = false;
  qBtn.style.opacity = '1';
}

/**
 * Inject quick-delete buttons next to active repost buttons,
 * and remove them when a repost has been removed.
 */
function injectQuickDeleteButtons() {
  // Clean up buttons whose repost is no longer active
  document.querySelectorAll(`[${REPOST_REF_ATTR}]`).forEach(repostBtn => {
    if (!isRepostActive(repostBtn)) {
      const parent = repostBtn.parentElement;
      if (parent) {
        parent.querySelectorAll(`[${QUICK_DEL_ATTR}]`).forEach(b => b.remove());
      }
      repostBtn.removeAttribute(REPOST_REF_ATTR);
    }
  });

  // Inject next to newly-active repost buttons
  findRepostButtons().forEach(btn => {
    if (!isRepostActive(btn)) return;
    if (btn.hasAttribute(REPOST_REF_ATTR)) return; // already handled

    btn.setAttribute(REPOST_REF_ATTR, '');

    const qBtn = document.createElement('button');
    qBtn.setAttribute(QUICK_DEL_ATTR, '');
    qBtn.title = 'Delete repost';
    qBtn.textContent = '\u00d7'; // ×
    qBtn.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'margin-left:4px',
      'padding:0 7px',
      'height:24px',
      'font-size:14px',
      'line-height:1',
      'color:#f50',
      'background:transparent',
      'border:1px solid #f50',
      'border-radius:3px',
      'cursor:pointer',
      'vertical-align:middle',
      'transition:background .15s,color .15s',
    ].join(';');

    qBtn.addEventListener('mouseenter', () => {
      qBtn.style.background = '#f50';
      qBtn.style.color = '#fff';
    });
    qBtn.addEventListener('mouseleave', () => {
      qBtn.style.background = 'transparent';
      qBtn.style.color = '#f50';
    });
    qBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      doDeleteRepost(btn, qBtn);
    });

    btn.insertAdjacentElement('afterend', qBtn);
  });
}

// ─── MutationObserver for infinite-scroll ─────────────────────────────────────

let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runFilter();
    injectQuickDeleteButtons();
  }, 150);
});

observer.observe(document.body, { childList: true, subtree: true });

// ─── Init ─────────────────────────────────────────────────────────────────────

chrome.storage.local.get([STORAGE_KEY], result => {
  hideEnabled = result[STORAGE_KEY] !== false; // default: enabled
  runFilter();
  injectQuickDeleteButtons();
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
