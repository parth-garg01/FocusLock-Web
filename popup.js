const elements = {
  siteInput: document.getElementById("siteInput"),
  durationSelect: document.getElementById("durationSelect"),
  strictToggle: document.getElementById("strictToggle"),
  startButton: document.getElementById("startButton"),
  stopButton: document.getElementById("stopButton"),
  statusPill: document.getElementById("statusPill"),
  timerText: document.getElementById("timerText"),
  sessionCopy: document.getElementById("sessionCopy"),
  sanityButton: document.getElementById("sanityButton"),
  sanityList: document.getElementById("sanityList")
};

let state = null;
let timerId = null;

const formatRemaining = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const sendMessage = (type, payload) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Request failed."));
        return;
      }

      resolve(response.state);
    });
  });

const parseSites = () =>
  elements.siteInput.value
    .split(/\r?\n|,/)
    .map((site) => site.trim())
    .filter(Boolean);

const setNotice = (message) => {
  elements.sessionCopy.textContent = message;
};

const renderState = (nextState) => {
  state = nextState;
  const active = Boolean(state.session_active && state.end_time && Date.now() < state.end_time);
  const strictLocked = active && state.strict_mode;

  elements.statusPill.textContent = active ? "Active" : "Inactive";
  elements.statusPill.classList.toggle("active", active);
  elements.siteInput.value = (state.blocked_sites || []).join("\n");
  elements.durationSelect.value = String(state.duration_minutes || 25);
  elements.strictToggle.checked = Boolean(state.strict_mode);
  elements.stopButton.disabled = !active || strictLocked;
  elements.startButton.disabled = strictLocked;
  elements.siteInput.disabled = strictLocked;
  elements.durationSelect.disabled = strictLocked;
  elements.strictToggle.disabled = strictLocked;

  if (!active) {
    elements.timerText.textContent = "00:00";
    setNotice("No active session.");
    return;
  }

  elements.timerText.textContent = formatRemaining(state.end_time - Date.now());
  setNotice(strictLocked ? "Strict mode is locking this session." : "Blocking is active.");
};

const refreshState = async () => {
  renderState(await sendMessage("getState"));
};

const tick = () => {
  if (!state?.session_active || !state.end_time) {
    return;
  }

  const remaining = state.end_time - Date.now();
  elements.timerText.textContent = formatRemaining(remaining);
  if (remaining <= 0) {
    refreshState();
  }
};

const startTimer = () => {
  window.clearInterval(timerId);
  timerId = window.setInterval(tick, 1000);
};

const startSession = async () => {
  const payload = {
    blocked_sites: parseSites(),
    duration_minutes: Number(elements.durationSelect.value),
    strict_mode: elements.strictToggle.checked
  };

  renderState(await sendMessage("startSession", payload));
};

const stopSession = async () => {
  renderState(await sendMessage("stopSession"));
};

const saveDraftSettings = async () => {
  if (state?.session_active && state.strict_mode) {
    return;
  }

  state = await sendMessage("saveSettings", {
    blocked_sites: parseSites(),
    duration_minutes: Number(elements.durationSelect.value),
    strict_mode: elements.strictToggle.checked
  });
};

elements.startButton.addEventListener("click", () => {
  startSession().catch((error) => setNotice(error.message));
});

elements.stopButton.addEventListener("click", () => {
  stopSession().catch((error) => setNotice(error.message));
});

elements.siteInput.addEventListener("change", () => {
  saveDraftSettings().catch((error) => setNotice(error.message));
});

elements.durationSelect.addEventListener("change", () => {
  saveDraftSettings().catch((error) => setNotice(error.message));
});

elements.strictToggle.addEventListener("change", () => {
  saveDraftSettings().catch((error) => setNotice(error.message));
});

refreshState()
  .then(startTimer)
  .catch((error) => setNotice(error.message));

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.session_active || changes.end_time)) {
    refreshState().catch((error) => setNotice(error.message));
  }
});
