const DEFAULT_STATE = {
  blocked_sites: [],
  start_time: null,
  end_time: null,
  duration_minutes: 25,
  strict_mode: false,
  session_active: false
};

const RULE_ID_OFFSET = 1000;

const getState = () => chrome.storage.local.get(DEFAULT_STATE);

const normalizeSite = (value) => value.trim().toLowerCase();

const normalizeSites = (sites) => {
  if (!Array.isArray(sites)) {
    return [];
  }

  return [...new Set(sites.map(normalizeSite).filter(Boolean))];
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getSiteRulePattern = (site) => {
  try {
    const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(site) ? site : `https://${site}`;
    const url = new URL(withProtocol);
    const host = escapeRegex(url.hostname.replace(/^www\./, ""));

    if (/^[a-z][a-z\d+.-]*:\/\//i.test(site) && url.pathname !== "/") {
      const path = escapeRegex(url.pathname.replace(/\/$/, ""));
      return `^https?://([^/]+\\.)?${host}${path}(/|[?#]|$)`;
    }

    return `^https?://([^/]+\\.)?${host}([/:?#]|$)`;
  } catch {
    const cleaned = site.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
    return `^https?://([^/]+\\.)?${escapeRegex(cleaned)}([/:?#]|$)`;
  }
};

const getExistingRuleIds = async () => {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.map((rule) => rule.id).filter((id) => id >= RULE_ID_OFFSET);
};

const clearBlockingRules = async () => {
  const removeRuleIds = await getExistingRuleIds();
  if (removeRuleIds.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  }
};

const buildBlockingRules = (sites) =>
  sites.map((site, index) => ({
    id: RULE_ID_OFFSET + index,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: `/blocked.html?site=${encodeURIComponent(site)}`
      }
    },
    condition: {
      regexFilter: getSiteRulePattern(site),
      resourceTypes: ["main_frame"]
    }
  }));

const applyBlockingRules = async (state) => {
  const removeRuleIds = await getExistingRuleIds();
  const addRules =
    state.session_active && state.end_time && Date.now() < state.end_time
      ? buildBlockingRules(normalizeSites(state.blocked_sites))
      : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
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

  const nextState = await getState();
  await applyBlockingRules(nextState);
  return nextState;
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

  const nextState = await getState();
  await applyBlockingRules(nextState);
  return nextState;
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

  await clearBlockingRules();
  return getState();
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set(DEFAULT_STATE);
  clearBlockingRules();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(DEFAULT_STATE, async (state) => {
    if (!state.session_active || !state.end_time || Date.now() >= state.end_time) {
      await chrome.storage.local.set({ session_active: false });
      await clearBlockingRules();
      return;
    }

    await applyBlockingRules(state);
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
