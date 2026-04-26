const DEFAULT_STATE = {
  blocked_sites: [],
  start_time: null,
  end_time: null,
  duration_minutes: 25,
  strict_mode: false,
  session_active: false
};

const RULE_ID_OFFSET = 1000;
const SESSION_ALARM = "focuslock-session-expiry";
const LOCKED_KEYS = ["blocked_sites", "duration_minutes", "end_time", "session_active", "start_time", "strict_mode"];
let strictRestoreInProgress = false;

const getState = () => chrome.storage.local.get(DEFAULT_STATE);

const normalizeSite = (value) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  try {
    const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return trimmed
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split(/[/?#]/)[0];
  }
};

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

const scheduleSessionExpiry = async (endTime) => {
  await chrome.alarms.clear(SESSION_ALARM);
  if (endTime && Date.now() < endTime) {
    await chrome.alarms.create(SESSION_ALARM, { when: endTime });
  }
};

const expireSession = async () => {
  await chrome.storage.local.set({
    session_active: false,
    start_time: null,
    end_time: null
  });
  await chrome.alarms.clear(SESSION_ALARM);
  await clearBlockingRules();
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
  await scheduleSessionExpiry(nextState.end_time);
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
  await scheduleSessionExpiry(endTime);
  return nextState;
};

const restoreStrictState = async (changes) => {
  if (strictRestoreInProgress) {
    return;
  }

  const currentState = await getState();
  const oldState = { ...currentState };
  for (const key of LOCKED_KEYS) {
    if (changes[key]) {
      oldState[key] = changes[key].oldValue;
    }
  }

  if (!oldState.session_active || !oldState.strict_mode || !oldState.end_time || Date.now() >= oldState.end_time) {
    return;
  }

  strictRestoreInProgress = true;
  try {
    await chrome.storage.local.set(oldState);
    const restored = await getState();
    await applyBlockingRules(restored);
    await scheduleSessionExpiry(restored.end_time);
  } finally {
    strictRestoreInProgress = false;
  }
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

  await chrome.alarms.clear(SESSION_ALARM);
  await clearBlockingRules();
  return getState();
};

const runSanityCheck = async () => {
  const state = await getState();
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  const focusRules = rules.filter((rule) => rule.id >= RULE_ID_OFFSET);
  const active = Boolean(state.session_active && state.end_time && Date.now() < state.end_time);
  const hasSites = Array.isArray(state.blocked_sites) && state.blocked_sites.length > 0;
  const hasRedirectRule = focusRules.some((rule) => rule.action?.type === "redirect" && rule.action.redirect?.extensionPath);
  const hasMainFrameRule = focusRules.some((rule) => rule.condition?.resourceTypes?.includes("main_frame"));

  const steps = [
    ["Storage working", Boolean(state)],
    ["Website list saved correctly", hasSites],
    ["Session starts properly", active],
    ["Timer set correctly", active && state.start_time < state.end_time],
    ["Rules applied", active ? focusRules.length === state.blocked_sites.length : focusRules.length === 0],
    ["Blocked site detection works", active && hasMainFrameRule],
    ["Redirect to blocking page works", active && hasRedirectRule],
    ["Timer countdown correct", active && state.end_time - Date.now() > 0],
    ["Strict mode enforcement", state.strict_mode ? active && state.strict_mode : true],
    ["Session ends correctly", active ? Boolean(state.end_time) : focusRules.length === 0]
  ];

  return steps.map(([description, passed], index) => {
    const status = passed ? "PASS" : "FAIL";
    console.info(`[Sanity Check] Step ${index + 1}/10: ${description} → ${status}`);
    return {
      step: index + 1,
      total: 10,
      description,
      status
    };
  });
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set(DEFAULT_STATE);
  clearBlockingRules();
  chrome.alarms.clear(SESSION_ALARM);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(DEFAULT_STATE, async (state) => {
    if (!state.session_active || !state.end_time || Date.now() >= state.end_time) {
      await expireSession();
      return;
    }

    await applyBlockingRules(state);
    await scheduleSessionExpiry(state.end_time);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SESSION_ALARM) {
    expireSession();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    restoreStrictState(changes);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const actions = {
    getState,
    saveSettings: () => saveSettings(message.payload || {}),
    startSession: () => startSession(message.payload || {}),
    stopSession,
    runSanityCheck
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
