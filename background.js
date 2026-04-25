const DEFAULT_STATE = {
  blocked_sites: [],
  start_time: null,
  end_time: null,
  duration_minutes: 25,
  strict_mode: false,
  session_active: false
};

const getState = () => chrome.storage.local.get(DEFAULT_STATE);

const normalizeSite = (value) => value.trim().toLowerCase();

const normalizeSites = (sites) => {
  if (!Array.isArray(sites)) {
    return [];
  }

  return [...new Set(sites.map(normalizeSite).filter(Boolean))];
};

const saveSettings = async ({ blocked_sites, duration_minutes, strict_mode }) => {
  const state = await getState();
  if (state.session_active && state.strict_mode) {
    throw new Error("Strict mode prevents editing during an active session.");
  }

  const duration = Number(duration_minutes);
  await chrome.storage.local.set({
    blocked_sites: normalizeSites(blocked_sites),
    duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 25,
    strict_mode: Boolean(strict_mode)
  });

  return getState();
};

const startSession = async ({ blocked_sites, duration_minutes, strict_mode }) => {
  const sites = normalizeSites(blocked_sites);
  const duration = Number(duration_minutes);

  if (!sites.length) {
    throw new Error("Add at least one website to block.");
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Choose a valid duration.");
  }

  const startTime = Date.now();
  const endTime = startTime + duration * 60 * 1000;

  await chrome.storage.local.set({
    blocked_sites: sites,
    duration_minutes: duration,
    strict_mode: Boolean(strict_mode),
    start_time: startTime,
    end_time: endTime,
    session_active: true
  });

  return getState();
};

const stopSession = async () => {
  const state = await getState();
  if (state.session_active && state.strict_mode) {
    throw new Error("Strict mode prevents stopping this session.");
  }

  await chrome.storage.local.set({
    session_active: false,
    start_time: null,
    end_time: null
  });

  return getState();
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const actions = {
    getState,
    saveSettings: () => saveSettings(message.payload || {}),
    startSession: () => startSession(message.payload || {}),
    stopSession
  };

  const action = actions[message?.type];
  if (!action) {
    return false;
  }

  action()
    .then((state) => sendResponse({ ok: true, state }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
