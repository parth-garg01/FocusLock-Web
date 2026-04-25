const DEFAULT_STATE = {
  blocked_sites: [],
  start_time: null,
  end_time: null,
  strict_mode: false,
  session_active: false
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set(DEFAULT_STATE);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(DEFAULT_STATE, (state) => {
    if (!state.session_active || !state.end_time || Date.now() >= state.end_time) {
      chrome.storage.local.set({ session_active: false });
    }
  });
});
