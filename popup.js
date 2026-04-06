const STORAGE_KEY = 'sc_hide_playlists';
const toggle = document.getElementById('toggleHide');
const status = document.getElementById('status');

function setStatus(enabled) {
  status.textContent = enabled
    ? 'Playlist posts are hidden'
    : 'Playlist posts are visible';
}

// Load current state from storage
chrome.storage.local.get([STORAGE_KEY], result => {
  const enabled = result[STORAGE_KEY] !== false;
  toggle.checked = enabled;
  setStatus(enabled);
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ [STORAGE_KEY]: enabled });
  setStatus(enabled);

  // Tell active SoundCloud tab to update
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SET_HIDE_PLAYLISTS',
        enabled,
      });
    }
  });
});
